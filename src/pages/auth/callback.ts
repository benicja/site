import type { APIRoute } from 'astro';
import { getGoogleClient, isEmailApproved, createUserSession, SESSION_COOKIE } from '../../lib/auth';
import { OAuth2RequestError } from 'arctic';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('oauth_state')?.value;
  const storedVerifier = cookies.get('oauth_code_verifier')?.value;
  const isLinkingPhotos = cookies.get('link_photos_mode')?.value === 'true';
  
  // Validate request integrity
  if (!code || !state || !storedState || !storedVerifier || state !== storedState) {
    console.error('Auth Validation Failed:', { 
      hasCode: !!code, 
      hasState: !!state, 
      hasStoredState: !!storedState, 
      hasStoredVerifier: !!storedVerifier,
      stateMatch: state === storedState 
    });
    return new Response('Invalid request parameters', { status: 400 });
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
      cookies.delete('oauth_state', { path: '/' });
      cookies.delete('oauth_code_verifier', { path: '/' });
      cookies.delete('link_photos_mode', { path: '/' });
      return redirect('/gallery?linked=success');
    }

    // Check if email is approved
    const approved = await isEmailApproved(userInfo.email);
    
    // Get target redirect
    const targetRedirect = cookies.get('auth_redirect')?.value || '/gallery';

    // Clean up OAuth cookies
    cookies.delete('oauth_state', { path: '/' });
    cookies.delete('oauth_code_verifier', { path: '/' });
    cookies.delete('auth_redirect', { path: '/' });

    if (!approved) {
      // Redirect to access request page (user now has a session so they can view it)
      return redirect('/gallery/request-access');
    }
    
    // Redirect to target or gallery
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
      return new Response(`Invalid authorization code: ${error.message}`, { status: 400 });
    }
    
    return new Response(`Internal server error: ${errorMessage}`, { status: 500 });
  }
};
