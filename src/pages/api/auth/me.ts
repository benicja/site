import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getApprovedUser, getUserFromSession } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const user = await getUserFromSession(sessionId);
  if (!user) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const approvedUser = await getApprovedUser(user.user_email);
  const isAdmin = approvedUser?.role === 'admin';

  return new Response(
    JSON.stringify({
      authenticated: true,
      isAdmin,
      user: {
        email: user.user_email,
        name: user.user_name || null,
        avatar: user.user_avatar || null
      }
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
