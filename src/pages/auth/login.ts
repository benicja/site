import type { APIRoute } from 'astro';
import { getGoogleClient, generateState, generateCodeVerifier } from '../../lib/auth';

export const prerender = false;

// Browsers and Astro's prefetcher may fetch this URL speculatively (hover
// prefetch, prerender). Those requests must not mint OAuth state or we
// clobber the cookie of the attempt the user actually clicked
function isSpeculative(request: Request) {
  const secPurpose = request.headers.get('sec-purpose') || '';
  const purpose = request.headers.get('purpose') || '';
  const moz = request.headers.get('x-moz') || '';
  return (
    secPurpose.includes('prefetch') ||
    secPurpose.includes('prerender') ||
    purpose === 'prefetch' ||
    moz === 'prefetch'
  );
}

export const GET: APIRoute = async ({ cookies, redirect, url, request }) => {
  try {
    if (isSpeculative(request)) {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

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

    // The verifier cookie is keyed by the state value, so a second login
    // initiation (double tap, prefetch that slipped through, two tabs) gets
    // its own cookie instead of overwriting this attempt's. The callback
    // looks the verifier up under the state Google echoes back
    cookies.set(`oauth_v_${state}`, codeVerifier, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/'
    });

    // Clean up cookies from the pre-keyed scheme so old sessions can't confuse
    // the callback
    cookies.delete('oauth_state', { path: '/' });
    cookies.delete('oauth_code_verifier', { path: '/' });

    const scopes = ['openid', 'profile', 'email'];

    // Use the library to create the URL (fixes the PKCE/Security handshake)
    const authorizationUrl = google.createAuthorizationURL(state, codeVerifier, scopes);

    return redirect(authorizationUrl.toString());
  } catch (error) {
    console.error('OAuth initialization error:', error);
    return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
};
