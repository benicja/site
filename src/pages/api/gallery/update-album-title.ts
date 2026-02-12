import type { APIRoute } from 'astro';
import { isUserAdmin, SESSION_COOKIE } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'No session found. Please sign in again.' }), { status: 401 });
  }

  const isAdmin = await isUserAdmin(sessionId);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Admin role required' }), { status: 403 });
  }

  const { albumId, newTitle } = await request.json();
  if (!albumId || !newTitle) {
    return new Response(JSON.stringify({ error: 'Album ID and new title required' }), { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('gallery_albums')
      .update({ 
        title: newTitle,
        updated_at: new Date().toISOString()
      })
      .eq('google_album_id', albumId);

    if (error) throw error;

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Album title updated to: ${newTitle}`
    }));

  } catch (error: any) {
    console.error('Update title error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
