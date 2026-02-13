import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getApprovedUser, getUserFromSession } from '../../lib/auth';
import { sendAdminAccessRequestEmail } from '../../lib/email';
import { supabaseAdmin } from '../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const sessionId = cookies.get(SESSION_COOKIE)?.value;
    const user = sessionId ? await getUserFromSession(sessionId) : null;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { fullName, message } = await request.json();
    const email = user.user_email;

    const approvedUser = await getApprovedUser(email);
    if (approvedUser) {
      return new Response(JSON.stringify({ 
        error: 'Your access has already been approved. Try signing in.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!email || !fullName) {
      return new Response(JSON.stringify({ error: 'Email and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate unique request token
    const requestToken = crypto.randomUUID();
    
    // Check if request already exists
    const { data: existingRequest } = await supabaseAdmin
      .from('access_requests')
      .select('id, status')
      .eq('email', email)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return new Response(JSON.stringify({ 
          error: 'You already have a pending request' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Create access request
    const { error } = await supabaseAdmin
      .from('access_requests')
      .insert({
        email,
        full_name: fullName,
        message: message || '',
        request_token: requestToken,
        status: 'pending'
      });
    
    if (error) throw error;
    
    await sendAdminAccessRequestEmail({
      email,
      fullName,
      message: message || '',
      requestToken
    });
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Request submitted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Access request error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to submit request' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
