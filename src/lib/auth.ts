import { Google, generateState, generateCodeVerifier } from 'arctic';

// Session cookie name
export const SESSION_COOKIE = 'gallery_session';

export { generateState, generateCodeVerifier };

// Initialize Google OAuth provider at runtime
export function getGoogleClient(origin?: string): Google {
  const googleClientId = import.meta.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;
  
  // Use the provided origin or fall back to 'http://localhost:4321'
  let siteUrl = origin || import.meta.env.SITE_URL || 'http://localhost:4321';
  
  // Clean up the URL (remove trailing slash and any path components)
  try {
    const urlObj = new URL(siteUrl);
    siteUrl = urlObj.origin;
  } catch (e) {
    // If it's not a valid URL, default to localhost
    siteUrl = 'http://localhost:4321';
  }
  
  if (!googleClientId || !googleClientSecret) {
    throw new Error('Missing Google OAuth environment variables');
  }
  
  const redirectUri = `${siteUrl}/auth/callback`;
  
  console.log('OAuth Redirect URI:', redirectUri);

  return new Google(
    googleClientId,
    googleClientSecret,
    redirectUri
  );
}

// Check if email is approved and return user data
export async function getApprovedUser(email: string) {
  const { supabaseAdmin } = await import('./supabase');
  
  const { data, error } = await supabaseAdmin
    .from('approved_users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error || !data) return null;
  return data;
}

// Check if email is approved (boolean check)
export async function isEmailApproved(email: string): Promise<boolean> {
  const user = await getApprovedUser(email);
  return !!user;
}

// Check if user is authenticated and is an admin
export async function isUserAdmin(sessionId: string): Promise<boolean> {
  const user = await getUserFromSession(sessionId);
  if (!user) return false;
  
  const approved = await getApprovedUser(user.user_email);
  return approved?.role === 'admin';
}

// Get site configuration (including photos refresh token)
export async function getSiteConfig() {
  const { supabaseAdmin } = await import('./supabase');
  
  const { data, error } = await supabaseAdmin
    .from('site_config')
    .select('*')
    .eq('id', 'current')
    .single();
  
  if (error) return null;
  return data;
}

// Create or update user session
export async function createUserSession(
  email: string,
  googleId: string,
  accessToken: string,
  refreshToken?: string,
  userName?: string,
  userAvatar?: string
): Promise<string> {
  const { supabaseAdmin } = await import('./supabase');
  
  const { data, error } = await supabaseAdmin
    .from('user_sessions')
    .upsert({
      user_email: email,
      google_id: googleId,
      access_token: accessToken,
      refresh_token: refreshToken,
      user_name: userName,
      user_avatar: userAvatar,
      last_login: new Date().toISOString()
    }, {
      onConflict: 'user_email'
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

// Get user from session ID
export async function getUserFromSession(sessionId: string) {
  const { supabaseAdmin } = await import('./supabase');
  
  const { data, error } = await supabaseAdmin
    .from('user_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  
  if (error) return null;
  return data;
}
