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

  const { albumIds } = await request.json();
  if (!albumIds || !Array.isArray(albumIds)) {
    return new Response(JSON.stringify({ error: 'Album IDs array required' }), { status: 400 });
  }

  try {
    // Check if display_order column exists by trying to fetch with it
    const { data: testData, error: testError } = await supabaseAdmin
      .from('gallery_albums')
      .select('display_order')
      .limit(1);

    if (testError && testError.message.includes('display_order')) {
      // Column doesn't exist yet - need to add it to Supabase first
      return new Response(JSON.stringify({ 
        error: 'The display_order column does not exist in your gallery_albums table. Please add it to your Supabase schema (type: integer, nullable).',
        needsSetup: true
      }), { status: 400 });
    }

    // Update all albums with their new display order
    const updates = albumIds.map((id: string, index: number) => ({
      google_album_id: id,
      display_order: index
    }));

    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from('gallery_albums')
        .update({ display_order: update.display_order })
        .eq('google_album_id', update.google_album_id);

      if (error) throw error;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Album order updated'
    }));

  } catch (error: any) {
    console.error('Reorder error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

