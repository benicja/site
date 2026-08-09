import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getApprovedUser, getUserFromSession } from '../../../lib/auth';
import { getAlbumIdForToken, isAlbumCoverUrl, isKnownMediaUrl, isMediaUrlInAlbum } from '../../../lib/galleryAccess';

export const prerender = false;

// Photos are private. Serving one requires a signed-in user who is either an
// approved member, or presenting a valid share token for the album this exact
// URL belongs to. Album covers are the one exception: the public album list
// shows them, so they're served without a session. The DB membership check
// also stops the proxy being used as an open relay for arbitrary Google URLs
async function authorise(cookies: any, decodedUrl: string, shareToken: string | null): Promise<boolean> {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  const user = sessionId ? await getUserFromSession(sessionId) : null;

  if (user) {
    if (shareToken) {
      const albumId = await getAlbumIdForToken(shareToken);
      if (albumId && (await isMediaUrlInAlbum(albumId, decodedUrl))) return true;
    }

    const approvedUser = await getApprovedUser(user.user_email);
    if (approvedUser && (await isKnownMediaUrl(decodedUrl))) return true;
  }

  return await isAlbumCoverUrl(decodedUrl);
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const imageUrl = url.searchParams.get('url');
  const width = url.searchParams.get('w') || '800';
  const shareToken = url.searchParams.get('share');

  if (!imageUrl) {
    return new Response('Missing image URL', { status: 400 });
  }

  try {
    // Decode the URL
    const decodedUrl = decodeURIComponent(imageUrl);

    if (!(await authorise(cookies, decodedUrl, shareToken))) {
      return new Response('Not authorised', { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const imageWithSizing = `${decodedUrl}=w${width}`;

    // Fetch from Google
    const response = await fetch(imageWithSizing, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://photos.google.com/',
      },
    });

    if (!response.ok) {
      return new Response('Failed to fetch image', { status: response.status });
    }

    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        // private: the browser may cache for a week, shared caches may not
        'Cache-Control': 'private, max-age=604800',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new Response('Error fetching image', { status: 500 });
  }
};
