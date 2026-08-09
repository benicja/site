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

export const GET: APIRoute = async ({ cookies, redirect, request }) => {
  if (isSpeculative(request)) {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }

  // Clear session cookie
  cookies.delete(SESSION_COOKIE, { path: '/' });

  // Redirect to home
  return redirect('/');
};

export const POST: APIRoute = async ({ cookies, redirect }) => {
  // Clear session cookie
  cookies.delete(SESSION_COOKIE, { path: '/' });

  // Redirect to home
  return redirect('/');
};
