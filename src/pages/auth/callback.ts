import type { APIRoute } from 'astro';
import { getGoogleClient, createUserSession, getUserFromSession, SESSION_COOKIE } from '../../lib/auth';
import { OAuth2RequestError } from 'arctic';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // The verifier lives in a cookie keyed by the state value (see login.ts),
  // so a concurrent login initiation can't clobber this attempt's verifier
  const storedVerifier = state ? cookies.get(`oauth_v_${state}`)?.value : undefined;
  const isLinkingPhotos = cookies.get('link_photos_mode')?.value === 'true';

  // PRAGMATIC CHECK: If we already have a session, maybe this is a double-tap/refresh
  // This happens in some browsers (like Chrome) when they pre-fetch or double-request URLs
  // Check this FIRST before validating OAuth parameters to handle accidental requests
  const existingSessionId = cookies.get(SESSION_COOKIE)?.value;
  if (existingSessionId && !isLinkingPhotos) {
    const user = await getUserFromSession(existingSessionId);
    if (user) {
      console.log('Session already exists, skipping OAuth exchange and redirecting');
      const targetRedirect = cookies.get('auth_redirect')?.value || '/gallery';
      if (state) cookies.delete(`oauth_v_${state}`, { path: '/' });
      cookies.delete('auth_redirect', { path: '/' });
      cookies.delete('oauth_retry', { path: '/' });
      return redirect(targetRedirect);
    }
  }

  // Validate request integrity. A missing verifier cookie means this attempt's
  // cookie expired or was never set (third-party cookie blocking, a stale
  // callback URL). Retry the whole login once automatically; if that also
  // fails, show a real error page instead of dying on a black screen
  if (!code || !state || !storedVerifier) {
    console.error('Auth Validation Failed: Missing OAuth parameters', {
      hasCode: !!code,
      hasState: !!state,
      hasStoredVerifier: !!storedVerifier
    });
    if (isLinkingPhotos) {
      return new Response('Invalid request parameters', { status: 400 });
    }

    const alreadyRetried = cookies.get('oauth_retry')?.value === '1';
    if (alreadyRetried) {
      cookies.delete('oauth_retry', { path: '/' });
      return redirect('/auth/error');
    }
    cookies.set('oauth_retry', '1', {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 2,
      path: '/'
    });
    const next = cookies.get('auth_redirect')?.value;
    return redirect(`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  }

  try {
    // Exchange code for tokens using the stored verifier
    const google = getGoogleClient(url.origin);
    const tokens = await google.validateAuthorizationCode(code, storedVerifier);
    
    // Fetch user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`
      }
    });
    
    if (!userInfoResponse.ok) {
      return new Response('Failed to fetch user info', { status: 500 });
    }
    
    const userInfo: { 
      email: string; 
      id: string; 
      verified_email: boolean;
      name?: string;
      picture?: string;
    } = await userInfoResponse.json();
    
    // Create or update session for the user immediately
    const sessionId = await createUserSession(
      userInfo.email,
      userInfo.id,
      tokens.accessToken(),
      tokens.hasRefreshToken() ? tokens.refreshToken() : undefined,
      userInfo.name,
      userInfo.picture
    );
    
    // Set session cookie
    cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: import.meta.env.PROD, // true in production
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    // If we are in "Link Photos" mode, save the refresh token to site config
    if (isLinkingPhotos) {
      const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : undefined;
      if (!refreshToken) {
        return new Response('No refresh token received. Try removing the app from Google account security and linking again.', { status: 400 });
      }

      const { supabaseAdmin } = await import('../../lib/supabase');
      const { error: configError } = await supabaseAdmin
        .from('site_config')
        .upsert({
          id: 'current',
          photos_refresh_token: refreshToken,
          source_email: userInfo.email,
          updated_at: new Date().toISOString()
        });

      if (configError) throw configError;

      // Clean up and redirect back to gallery
      cookies.delete(`oauth_v_${state}`, { path: '/' });
      cookies.delete('link_photos_mode', { path: '/' });
      cookies.delete('oauth_retry', { path: '/' });
      return redirect('/gallery?linked=success');
    }

    // Get target redirect
    const targetRedirect = cookies.get('auth_redirect')?.value || '/gallery';

    // Clean up OAuth cookies
    cookies.delete(`oauth_v_${state}`, { path: '/' });
    cookies.delete('auth_redirect', { path: '/' });
    cookies.delete('oauth_retry', { path: '/' });

    // Always return to where the user was. Approval is enforced by the pages
    // themselves; the request-access page is only reachable from an album's
    // no-access screen
    return redirect(targetRedirect);
    
  } catch (error) {
    console.error('OAuth error Details:', error);
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      errorMessage = String((error as any).message);
    } else {
      errorMessage = JSON.stringify(error);
    }
    
    if (error instanceof OAuth2RequestError) {
      console.error('OAuth2 Error:', error.message, error.description);
      
      // If we see "invalid_grant", it's extremely likely the code was already redeemed 
      // by a concurrent request (especially common in Chrome with pre-fetching/pre-rendering)
      // or a manual refresh. If we redirect to /gallery, the user will either see 
      // the success (if a session was created) or be prompted to login again naturally.
      if (error.message === 'invalid_grant' || error.message.includes('authorization code')) {
        console.log('Detected invalid_grant (likely double-exchange), attempting redirect to gallery');
        return redirect('/gallery');
      }

      return new Response(`Invalid authorization code: ${error.message}. Please try logging in again.`, { status: 400 });
    }
    
    return new Response(`Internal server error: ${errorMessage}. Please try refreshing or logging in again.`, { status: 500 });
  }
};
