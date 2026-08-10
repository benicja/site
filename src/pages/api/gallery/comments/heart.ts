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

    const body = await context.request.json();
    const { comment_id } = body;

    if (!comment_id) {
      return new Response(
        JSON.stringify({ error: 'comment_id is required' }),
        { status: 400 }
      );
    }

    // Insert heart
    const { error } = await supabaseAdmin
      .from('comment_hearts')
      .insert({
        comment_id,
        user_id: user.id,
      });

    if (error) {
      // If it's a duplicate, that's fine - user already hearted it
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ alreadyHearted: true }),
          { status: 200 }
        );
      }

      console.error('Heart insert error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to heart comment' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
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

    const body = await context.request.json();
    const { comment_id } = body;

    if (!comment_id) {
      return new Response(
        JSON.stringify({ error: 'comment_id is required' }),
        { status: 400 }
      );
    }

    // Delete heart
    const { error } = await supabaseAdmin
      .from('comment_hearts')
      .delete()
      .eq('comment_id', comment_id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Heart delete error:', error);
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
