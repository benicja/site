import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // Get count of all photos
    const { count, error } = await supabaseAdmin
      .from('gallery_photos')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    // Get total of all photo_count fields from albums as verification
    const { data: albums, error: albumError } = await supabaseAdmin
      .from('gallery_albums')
      .select('photo_count');

    if (albumError) throw albumError;

    const albumTotalCount = albums?.reduce((sum, album) => sum + (album.photo_count || 0), 0) || 0;

    return new Response(JSON.stringify({ 
      total_photos: count || 0,
      album_count_total: albumTotalCount,
      verified: count === albumTotalCount
    }));

  } catch (error: any) {
    console.error('Stats error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
