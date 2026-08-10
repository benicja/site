import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getUserFromSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';

export const POST: APIRoute = async (context) => {
  try {
    // Check authentication
    const sessionId = context.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401 }
      );
    }

    const user = await getUserFromSession(sessionId);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Session invalid' }),
        { status: 401 }
      );
    }

    if (user.banned) {
      return new Response(
        JSON.stringify({ error: 'This account is restricted from commenting and hearting' }),
        { status: 403 }
      );
    }

    // Parse request body
    const body = await context.request.json();
    const { comment_id } = body;

    if (!comment_id || typeof comment_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid comment_id' }),
        { status: 400 }
      );
    }

    // Check if comment exists
    const { data: comment, error: commentError } = await supabaseAdmin
      .from('comments')
      .select('id')
      .eq('id', comment_id)
      .single();

    if (commentError || !comment) {
      return new Response(
        JSON.stringify({ error: 'Comment not found' }),
        { status: 404 }
      );
    }

    // Try to insert heart (will fail if already exists due to unique constraint)
    const { data, error } = await supabaseAdmin
      .from('comment_hearts')
      .insert({
        comment_id,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      // If constraint violation, user already hearted this comment
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Already hearted', alreadyHearted: true }),
          { status: 409 }
        );
      }
      console.error('Heart creation error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to heart comment' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        heart: data 
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Heart API error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    // Check authentication
    const sessionId = context.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401 }
      );
    }

    const user = await getUserFromSession(sessionId);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Session invalid' }),
        { status: 401 }
      );
    }

    // Parse request body
    const body = await context.request.json();
    const { comment_id } = body;

    if (!comment_id || typeof comment_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid comment_id' }),
        { status: 400 }
      );
    }

    // Delete the heart
    const { error } = await supabaseAdmin
      .from('comment_hearts')
      .delete()
      .eq('comment_id', comment_id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Delete heart error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to unheart comment' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Unheart API error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
};
