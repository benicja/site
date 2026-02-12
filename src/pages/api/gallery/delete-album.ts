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

  const { albumId } = await request.json();
  if (!albumId) {
    return new Response(JSON.stringify({ error: 'Album ID required' }), { status: 400 });
  }

  try {
    // Delete all photos in this album first
    const { error: photoError } = await supabaseAdmin
      .from('gallery_photos')
      .delete()
      .eq('album_id', albumId);

    if (photoError) throw photoError;

    // Then delete the album
    const { error: albumError } = await supabaseAdmin
      .from('gallery_albums')
      .delete()
      .eq('google_album_id', albumId);

    if (albumError) throw albumError;

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Album and all photos deleted successfully'
    }));

  } catch (error: any) {
    console.error('Delete error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
