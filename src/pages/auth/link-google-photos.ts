import type { APIRoute } from 'astro';
import { generateState, generateCodeVerifier, SESSION_COOKIE, isUserAdmin } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  try {
    // 1. Verify the requester is actually an admin
    const sessionId = cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId || !(await isUserAdmin(sessionId))) {
      return new Response('Unauthorized: Admins only', { status: 403 });
    }

    // 2. Generate OAuth state and verifier
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    
    // 3. Store the verifier keyed by state (same scheme as login.ts, so
    //    concurrent attempts can't clobber each other) - mark as "link_photos"
    cookies.set(`oauth_v_${state}`, codeVerifier, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/'
    });

    cookies.set('link_photos_mode', 'true', {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/'
    });
    
    // 4. Create URL with special Photo Scopes + Force Refresh Token
    const scopes = [
        'openid', 
        'profile', 
        'email', 
        'https://www.googleapis.com/auth/photoslibrary.readonly'
    ];
    
    // Use manual URL generation to ensure prompt=consent (required for refresh token)
    const siteUrl = import.meta.env.SITE_URL || 'http://localhost:4321';
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", import.meta.env.GOOGLE_CLIENT_ID);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("scope", scopes.join(" "));
    authorizationUrl.searchParams.set("redirect_uri", `${siteUrl}/auth/callback`);
    authorizationUrl.searchParams.set("access_type", "offline"); // Crucial for refresh token
    authorizationUrl.searchParams.set("prompt", "consent");      // Crucial for refresh token
    authorizationUrl.searchParams.set("code_challenge", await getCodeChallenge(codeVerifier));
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    
    return redirect(authorizationUrl.toString());
  } catch (error) {
    console.error('Photo Link Init Error:', error);
    return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown'}`, { status: 500 });
  }
};

// Helper for PKCE challenge (simplified version for manually building URL)
async function getCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
