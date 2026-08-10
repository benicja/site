import type { APIRoute, APIContext } from 'astro';
import { SESSION_COOKIE, getApprovedUser, getUserFromSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

async function getAdminFromSession(cookies: APIContext['cookies']) {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  const user = sessionId ? await getUserFromSession(sessionId) : null;
  if (!user) return null;

  const approvedUser = await getApprovedUser(user.user_email);
  if (approvedUser?.role !== 'admin') return null;
  return user;
}

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

// Remove everything a user has authored: comments (their received comment
// hearts cascade via FK), the comment hearts they gave, and recipe hearts
async function deleteUserContent(userId: string, email: string) {
  const { error: commentsError } = await supabaseAdmin
    .from('comments')
    .delete()
    .eq('user_id', userId);
  if (commentsError) throw new Error('Failed to delete comments');

  const { error: heartsError } = await supabaseAdmin
    .from('comment_hearts')
    .delete()
    .eq('user_id', userId);
  if (heartsError) throw new Error('Failed to delete comment hearts');

  const { error: recipeHeartsError } = await supabaseAdmin
    .from('recipe_hearts')
    .delete()
    .eq('user_email', email);
  if (recipeHeartsError) throw new Error('Failed to delete recipe hearts');
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const admin = await getAdminFromSession(cookies);
  if (!admin) return json({ error: 'Unauthorized' }, 401);

  const { action, email } = await request.json();
  if (!email || !['approve', 'revoke', 'ban', 'unban', 'delete'].includes(action)) {
    return json({ error: 'Invalid request' }, 400);
  }

  if (email === admin.user_email) {
    return json({ error: 'You cannot perform this action on your own account' }, 400);
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from('user_sessions')
    .select('*')
    .eq('user_email', email)
    .single();

  if (targetError || !target) {
    return json({ error: 'User not found' }, 404);
  }

  // Admins are protected from ban/delete; demote them first
  if (action !== 'approve') {
    const targetApproved = await getApprovedUser(email);
    if (targetApproved?.role === 'admin') {
      return json({ error: 'Remove their admin role before banning or deleting this user' }, 400);
    }
  }

  try {
    if (action === 'approve') {
      const { error } = await supabaseAdmin
        .from('approved_users')
        .upsert(
          {
            email,
            role: 'user',
            approved_by: admin.user_email,
            approved_at: new Date().toISOString()
          },
          { onConflict: 'email' }
        );
      if (error) throw new Error('Failed to approve user');
      return json({ success: true });
    }

    if (action === 'revoke') {
      const { error } = await supabaseAdmin
        .from('approved_users')
        .delete()
        .eq('email', email);
      if (error) throw new Error('Failed to revoke access');
      return json({ success: true });
    }

    if (action === 'ban' || action === 'unban') {
      const banned = action === 'ban';
      const { error } = await supabaseAdmin
        .from('user_sessions')
        .update({ banned })
        .eq('user_email', email);
      if (error) {
        throw new Error(
          'Failed to update ban flag — has migration 009_add_user_ban.sql been applied?'
        );
      }
      if (banned) await deleteUserContent(target.id, email);
      return json({ success: true });
    }

    // action === 'delete' — full wipe, e.g. a data-removal request
    await deleteUserContent(target.id, email);

    const { error: requestsError } = await supabaseAdmin
      .from('access_requests')
      .delete()
      .eq('email', email);
    if (requestsError) throw new Error('Failed to delete access requests');

    const { error: approvedError } = await supabaseAdmin
      .from('approved_users')
      .delete()
      .eq('email', email);
    if (approvedError) throw new Error('Failed to delete approval');

    const { error: sessionError } = await supabaseAdmin
      .from('user_sessions')
      .delete()
      .eq('user_email', email);
    if (sessionError) throw new Error('Failed to delete account');

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message || 'Action failed' }, 500);
  }
};
