import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getApprovedUser, getUserFromSession } from '../../../lib/auth';
import { getPhotosByAlbumId } from '../../../lib/gallery';
import { getAlbumIdForToken } from '../../../lib/galleryAccess';

export const prerender = false;

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }
  });

// Photo list for an album, fetched client-side so the album page itself can
// render instantly. Access mirrors the page exactly: a signed-in approved
// member, or any signed-in user carrying a valid share token for this album.
export const GET: APIRoute = async ({ url, cookies }) => {
  const albumId = url.searchParams.get('album_id');
  if (!albumId) return json({ error: 'Missing album_id' }, 400);

  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  const user = sessionId ? await getUserFromSession(sessionId) : null;
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const shareParam = url.searchParams.get('share');
  const [approvedUser, tokenAlbum] = await Promise.all([
    getApprovedUser(user.user_email),
    shareParam ? getAlbumIdForToken(shareParam) : Promise.resolve(null)
  ]);

  if (!approvedUser && tokenAlbum !== albumId) {
    return json({ error: 'Not authorised for this album' }, 403);
  }

  const photos = await getPhotosByAlbumId(albumId);
  return json({
    photos: photos.map((p) => ({ image_url: p.image_url, media_type: p.media_type }))
  });
};
