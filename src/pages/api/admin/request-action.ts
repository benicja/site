import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { sendUserAccessDecisionEmail } from '../../../lib/email';

export const prerender = false;

const requestActionSecret = import.meta.env.REQUEST_ACTION_SECRET;
const siteUrl = (import.meta.env.SITE_URL || 'https://benicja.com').replace(/\/$/, '');
const portalUrl = `${siteUrl}/portal`;

export const GET: APIRoute = async ({ url }) => {
  const action = url.searchParams.get('action');
  const token = url.searchParams.get('token');
  const expires = url.searchParams.get('expires');
  const signature = url.searchParams.get('sig');

  if (!requestActionSecret) {
    return htmlResponse('Request action not configured.', 500);
  }

  if (!action || !token || !expires || !signature) {
    return htmlResponse('Invalid request link.', 400);
  }

  if (action !== 'approve' && action !== 'deny') {
    return htmlResponse('Invalid action.', 400);
  }

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt)) {
    return htmlResponse('Invalid expiry.', 400);
  }

  if (Date.now() > expiresAt) {
    return htmlResponse('This link has expired.', 410);
  }

  const expected = await signRequestAction(`${token}:${action}:${expiresAt}`);
  if (!timingSafeEqual(signature, expected)) {
    return htmlResponse('Invalid signature.', 403);
  }

  const { data: accessRequest, error: accessError } = await supabaseAdmin
    .from('access_requests')
    .select('*')
    .eq('request_token', token)
    .single();

  if (accessError || !accessRequest) {
    return htmlResponse('Request not found.', 404);
  }

  const now = new Date().toISOString();
  const status = action === 'approve' ? 'approved' : 'denied';

  if (status === 'approved') {
    const { error: approveError } = await supabaseAdmin
      .from('approved_users')
      .upsert({
        email: accessRequest.email,
        role: 'user',
        approved_by: 'email_link',
        approved_at: now
      }, {
        onConflict: 'email'
      });

    if (approveError) {
      return htmlResponse('Failed to approve request.', 500);
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('access_requests')
    .update({
      status,
      reviewed_by: 'email_link',
      reviewed_at: now
    })
    .eq('id', accessRequest.id);

  if (updateError) {
    return htmlResponse('Failed to update request.', 500);
  }

  await sendUserAccessDecisionEmail({
    email: accessRequest.email,
    fullName: accessRequest.full_name || accessRequest.email,
    status
  });

  return htmlResponse(
    status === 'approved'
      ? `Approved. The user has been notified. <a href="${portalUrl}">Go to portal</a>.`
      : `Rejected. The user has been notified. <a href="${portalUrl}">Go to portal</a>.`
  );
};

async function signRequestAction(payload: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(requestActionSecret || '');
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toBase64Url(signature);
}

function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
}

function htmlResponse(message: string, status = 200) {
  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Request Update</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding: 40px; color: #111; }
          a { color: #111; }
        </style>
      </head>
      <body>
        <p>${message}</p>
      </body>
    </html>
  `;

  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
