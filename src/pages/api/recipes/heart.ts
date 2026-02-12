import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getUserFromSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  const user = sessionId ? await getUserFromSession(sessionId) : null;

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { slug } = await request.json();
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing recipe slug' }), { status: 400 });
  }

  const email = user.user_email;

  // Check if already hearted
  const { data: existing } = await supabaseAdmin
    .from('recipe_hearts')
    .select('id')
    .eq('user_email', email)
    .eq('recipe_slug', slug)
    .single();

  if (existing) {
    // Unheart
    const { error } = await supabaseAdmin
      .from('recipe_hearts')
      .delete()
      .eq('user_email', email)
      .eq('recipe_slug', slug);

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to unheart' }), { status: 500 });
    }

    return new Response(JSON.stringify({ action: 'unhearted' }), { status: 200 });
  } else {
    // Heart
    const { error } = await supabaseAdmin
      .from('recipe_hearts')
      .insert({
        user_email: email,
        recipe_slug: slug
      });

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to heart' }), { status: 500 });
    }

    return new Response(JSON.stringify({ action: 'hearted' }), { status: 200 });
  }
};
