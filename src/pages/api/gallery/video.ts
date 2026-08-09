import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getApprovedUser, getUserFromSession } from '../../../lib/auth';
import { getAlbumIdForToken, isKnownMediaUrl, isMediaUrlInAlbum } from '../../../lib/galleryAccess';

export const prerender = false;

// Same authorisation as the image proxy: signed in, then approved membership
// or a share token matching the album this exact URL belongs to
async function authorise(cookies: any, decodedUrl: string, shareToken: string | null): Promise<boolean> {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  const user = sessionId ? await getUserFromSession(sessionId) : null;
  if (!user) return false;

  if (shareToken) {
    const albumId = await getAlbumIdForToken(shareToken);
    if (albumId && (await isMediaUrlInAlbum(albumId, decodedUrl))) return true;
  }

  const approvedUser = await getApprovedUser(user.user_email);
  if (approvedUser && (await isKnownMediaUrl(decodedUrl))) return true;

  return false;
}

export const GET: APIRoute = async ({ request, url, cookies }) => {
  const baseUrl = url.searchParams.get('url');
  const shareToken = url.searchParams.get('share');

  if (!baseUrl) {
    return new Response('Missing video URL', { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(baseUrl);

    if (!(await authorise(cookies, decodedUrl, shareToken))) {
      return new Response('Not authorised', { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const videoUrl = `${decodedUrl}=dv`;
    const range = request.headers.get('range') || undefined;
    const wantsHead = request.method === 'HEAD';
    const upstreamRange = range || (wantsHead ? undefined : 'bytes=0-');

    const response = await fetch(videoUrl, {
      method: wantsHead ? 'HEAD' : 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://photos.google.com/',
        ...(upstreamRange ? { Range: upstreamRange } : {})
      }
    });

    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');

    if (!response.ok && response.status !== 206) {
      return new Response('Failed to fetch video', { status: response.status });
    }

    if (contentType.includes('text/html')) {
      return new Response('Upstream returned HTML instead of video', { status: 502 });
    }

    const headers = new Headers();
    if (contentType) {
      headers.set('Content-Type', contentType);
    } else {
      headers.set('Content-Type', 'video/mp4');
    }
    if (contentLength) headers.set('Content-Length', contentLength);
    if (contentRange) headers.set('Content-Range', contentRange);
    if (acceptRanges) {
      headers.set('Accept-Ranges', acceptRanges);
    } else {
      headers.set('Accept-Ranges', 'bytes');
    }

    headers.set('Cache-Control', 'private, max-age=604800');

    return new Response(wantsHead ? null : response.body, {
      status: response.status,
      headers
    });
  } catch (error) {
    console.error('Video proxy error:', error);
    return new Response('Error fetching video', { status: 500 });
  }
};
