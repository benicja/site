import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getApprovedUser, getUserFromSession } from '../../../lib/auth';
import { sendUserAccessDecisionEmail } from '../../../lib/email';
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

export const GET: APIRoute = async ({ cookies }) => {
  const admin = await getAdminFromSession(cookies);
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to load requests' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ requests: data || [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const admin = await getAdminFromSession(cookies);
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id, action } = await request.json();
  if (!id || !['approve', 'deny'].includes(action)) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { data: accessRequest, error: accessError } = await supabaseAdmin
    .from('access_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (accessError || !accessRequest) {
    return new Response(JSON.stringify({ error: 'Request not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const now = new Date().toISOString();
  const status = action === 'approve' ? 'approved' : 'denied';

  if (status === 'approved') {
    const { error: approveError } = await supabaseAdmin
      .from('approved_users')
      .upsert({
        email: accessRequest.email,
        role: 'user',
        approved_by: admin.user_email,
        approved_at: now
      }, {
        onConflict: 'email'
      });

    if (approveError) {
      return new Response(JSON.stringify({ error: 'Failed to approve user' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('access_requests')
    .update({
      status,
      reviewed_by: admin.user_email,
      reviewed_at: now
    })
    .eq('id', id);

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  await sendUserAccessDecisionEmail({
    email: accessRequest.email,
    fullName: accessRequest.full_name || accessRequest.email,
    status
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
