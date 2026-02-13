import { Resend } from 'resend';

const resendApiKey = import.meta.env.RESEND_API_KEY;
const resendFrom = import.meta.env.RESEND_FROM || 'no-reply@benicja.com';
const adminEmail = import.meta.env.ADMIN_REQUESTS_EMAIL || 'ben.horton.business@gmail.com';
const siteUrl = (import.meta.env.SITE_URL || 'https://benicja.com').replace(/\/$/, '');
const portalUrl = `${siteUrl}/portal`;
const requestActionSecret = import.meta.env.REQUEST_ACTION_SECRET;

function getClient() {
  if (!resendApiKey) {
    console.warn('Missing RESEND_API_KEY; skipping email send.');
    return null;
  }

  return new Resend(resendApiKey);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendAdminAccessRequestEmail(input: {
  email: string;
  fullName: string;
  message: string;
  requestToken: string;
}) {
  const client = getClient();
  if (!client) return;

  const safeMessage = input.message?.trim() ? escapeHtml(input.message) : 'No message provided.';
  const safeName = escapeHtml(input.fullName);
  const safeEmail = escapeHtml(input.email);

  const actionLinks = requestActionSecret
    ? await buildActionLinks(input.requestToken)
    : null;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif; line-height:1.6; color:#111;">
      <h2>Benicja View Gallery Request</h2>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Message:</strong><br/>${safeMessage.replace(/\n/g, '<br/>')}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p><a href="${portalUrl}">Go here to review</a></p>
      ${
        actionLinks
          ? `<p style="margin-top:12px;">
              <a href="${actionLinks.approve}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">Approve</a>
              <a href="${actionLinks.deny}" style="display:inline-block;margin-left:8px;border:1px solid #ddd;color:#555;padding:10px 16px;border-radius:999px;text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">Reject</a>
            </p>`
          : ''
      }
    </div>
  `;

  const text = `Benicja View Gallery Request\n\nEmail: ${input.email}\nName: ${input.fullName}\nMessage: ${input.message || 'No message provided.'}\n\nGo here to review: ${portalUrl}`
    + (actionLinks
      ? `\n\nApprove: ${actionLinks.approve}\nReject: ${actionLinks.deny}`
      : '');

  await client.emails.send({
    from: resendFrom,
    to: adminEmail,
    subject: 'Benicja View Gallery Request',
    html,
    text
  });
}

async function buildActionLinks(requestToken: string) {
  if (!requestActionSecret) {
    return null;
  }

  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const approve = await buildSignedActionLink('approve', requestToken, expiresAt);
  const deny = await buildSignedActionLink('deny', requestToken, expiresAt);

  return { approve, deny, expiresAt };
}

async function buildSignedActionLink(action: 'approve' | 'deny', requestToken: string, expiresAt: number) {
  const signature = await signRequestAction(`${requestToken}:${action}:${expiresAt}`);
  const params = new URLSearchParams({
    action,
    token: requestToken,
    expires: String(expiresAt),
    sig: signature
  });

  return `${siteUrl}/api/admin/request-action?${params.toString()}`;
}

async function signRequestAction(payload: string) {
  if (!requestActionSecret) {
    return '';
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(requestActionSecret);
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

export async function sendUserAccessDecisionEmail(input: {
  email: string;
  fullName: string;
  status: 'approved' | 'denied';
}) {
  const client = getClient();
  if (!client) return;

  const safeName = escapeHtml(input.fullName || 'there');
  const galleryUrl = `${siteUrl}/gallery`;
  const subject = 'Your gallery access request';

  const isApproved = input.status === 'approved';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif; line-height:1.6; color:#111;">
      <p>Hi ${safeName},</p>
      <p>
        ${
          isApproved
            ? 'Your request has been approved. You can now access the gallery.'
            : 'Thanks for your request. At this time, access has not been approved.'
        }
      </p>
      ${isApproved ? `<p><a href="${galleryUrl}">Go to the gallery</a></p>` : ''}
      <p>Benicja&#39;s Kitchen</p>
    </div>
  `;

  const text = `Hi ${input.fullName || 'there'},\n\n${
    isApproved
      ? 'Your request has been approved. You can now access the gallery.'
      : 'Thanks for your request. At this time, access has not been approved.'
  }${isApproved ? `\n\nGo to the gallery: ${galleryUrl}` : ''}\n\nBenicja's Kitchen`;

  await client.emails.send({
    from: resendFrom,
    to: input.email,
    subject,
    html,
    text
  });
}
