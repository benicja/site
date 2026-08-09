import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getUserFromSession, isUserAdmin } from '../../../lib/auth';
import {
  deleteShareToken,
  generateShareToken,
  getShareTokenForAlbum,
  setShareToken
} from '../../../lib/galleryAccess';

export const prerender = false;

// Admin-only management of an album's share link.
// action: 'enable'  - returns the existing token, creating one if needed
//         'rotate'  - replaces the token, invalidating every old link
//         'disable' - removes the token entirely
export const POST: APIRoute = async ({ request, cookies }) => {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId || !(await isUserAdmin(sessionId))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
  }
  const user = await getUserFromSession(sessionId);

  let body: { album_id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const albumId = body.album_id;
  const action = body.action;
  if (!albumId || !action || !['enable', 'rotate', 'disable'].includes(action)) {
    return new Response(JSON.stringify({ error: 'album_id and a valid action are required' }), {
      status: 400
    });
  }

  if (action === 'disable') {
    const ok = await deleteShareToken(albumId);
    return new Response(JSON.stringify({ success: ok, token: null }), {
      status: ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }

  let token = action === 'rotate' ? null : await getShareTokenForAlbum(albumId);
  if (!token) {
    token = generateShareToken();
    const ok = await setShareToken(albumId, token, user?.user_email || 'unknown');
    if (!ok) {
      return new Response(
        JSON.stringify({
          error:
            'Could not save the share token. If sharing was never used before, apply migration 008 in Supabase first.'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(JSON.stringify({ success: true, token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
};
