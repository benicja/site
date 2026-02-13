import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getApprovedUser, getUserFromSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

async function getAdminFromSession(cookies: APIRoute['cookies']) {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  const user = sessionId ? await getUserFromSession(sessionId) : null;
  if (!user) return null;

  const approvedUser = await getApprovedUser(user.user_email);
  if (approvedUser?.role !== 'admin') return null;
  return user;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const admin = await getAdminFromSession(cookies);
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id } = await request.json();
  if (!id) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { error } = await supabaseAdmin
    .from('approved_users')
    .delete()
    .eq('id', id);

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to revoke access' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
