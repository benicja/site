import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '../../lib/auth';

export const prerender = false;

// A speculative fetch of this URL (hover prefetch, prerender) must not end
// the session, so those requests are answered without touching cookies
function isSpeculative(request: Request) {
  const secPurpose = request.headers.get('sec-purpose') || '';
  const purpose = request.headers.get('purpose') || '';
  const moz = request.headers.get('x-moz') || '';
  return (
    secPurpose.includes('prefetch') ||
    secPurpose.includes('prerender') ||
    purpose === 'prefetch' ||
    moz === 'prefetch'
  );
}

// Only same-site paths are valid return targets — anything else falls back
// to home so the redirect can't be pointed off-site
function safeNext(url: URL): string {
  const next = url.searchParams.get('next') || '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}

export const GET: APIRoute = async ({ cookies, redirect, request }) => {
  if (isSpeculative(request)) {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }

  // Clear session cookie
  cookies.delete(SESSION_COOKIE, { path: '/' });

  // Return to the page the user logged out from; its own auth gating
  // decides what a signed-out visitor may still see
  return redirect(safeNext(new URL(request.url)));
};

export const POST: APIRoute = async ({ cookies, redirect, request }) => {
  // Clear session cookie
  cookies.delete(SESSION_COOKIE, { path: '/' });

  return redirect(safeNext(new URL(request.url)));
};
