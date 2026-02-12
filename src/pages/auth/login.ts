import type { APIRoute } from 'astro';
import { getGoogleClient, generateState, generateCodeVerifier } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect, url }) => {
  try {
    // Capture the target redirect path if provided
    const next = url.searchParams.get('next');
    if (next) {
      cookies.set('auth_redirect', next, {
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        maxAge: 60 * 10,
        path: '/'
      });
    }

    // Generate state and code verifier for secure OAuth
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const google = getGoogleClient(url.origin);
    
    // Store both in cookies for validation in the callback
    cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/'
    });

    cookies.set('oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/'
    });
    
    const scopes = ['openid', 'profile', 'email'];
    
    // Use the library to create the URL (fixes the PKCE/Security handshake)
    const authorizationUrl = google.createAuthorizationURL(state, codeVerifier, scopes);
    
    return redirect(authorizationUrl.toString());
  } catch (error) {
    console.error('OAuth initialization error:', error);
    return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
};
