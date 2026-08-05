// Shared email building blocks for all Resend-backed serverless functions.
// Files under api/_lib/ are ignored by Vercel's routing (underscore prefix),
// so this never becomes a public endpoint on its own.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM = 'yumlist <hola@yumlist.app>';
const LOGO_URL = 'https://yumlist.app/assets/email/yumlist-logo-email.png';

const BRAND_FONT = "'Cormorant Garamond',Georgia,serif";
const BODY_FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

// Dark-brand shell: logo header, container, optional CTA button, footer.
// Tables + inline styles only — mobile-first, no flexbox/grid (email clients
// don't reliably support either).
function renderEmailHtml({ preheader, heading, bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<title>yumlist</title>
</head>
<body style="margin:0;padding:0;background:#0e0d0c;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0e0d0c;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0c;">
<tr>
<td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
<tr>
<td align="center" style="padding-bottom:28px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td valign="middle" style="padding-right:10px;">
<img src="${LOGO_URL}" width="44" height="32" alt="yumlist" style="display:block;border:0;">
</td>
<td valign="middle">
<span style="font-family:${BRAND_FONT};font-size:30px;font-weight:300;letter-spacing:-1px;color:#F5F0E8;">yumlist</span>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td align="center" style="font-family:${BRAND_FONT};font-weight:300;font-size:26px;color:#F5F0E8;line-height:1.3;padding-bottom:16px;">
${heading}
</td>
</tr>
<tr>
<td style="font-family:${BODY_FONT};font-size:15px;line-height:1.7;color:#B89F87;padding-bottom:28px;">
${bodyHtml}
</td>
</tr>
${ctaUrl ? `<tr>
<td align="center" style="padding-bottom:32px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="background:#F5F0E8;border-radius:999px;">
<a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${BODY_FONT};font-size:14px;font-weight:bold;color:#0e0d0c;text-decoration:none;">${ctaLabel}</a>
</td>
</tr>
</table>
</td>
</tr>` : ''}
<tr>
<td align="center" style="border-top:1px solid rgba(245,240,232,0.1);padding-top:20px;font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:#7A756E;">
© 2026 Yumlist · Barcelona<br>${footerNote}
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

// Sends via Resend's REST API. Throws on failure — callers decide how to
// handle that (the app's own transactional sends swallow it; a future bulk
// sender might retry or report it).
async function sendViaResend({ apiKey, to, subject, html, text, headers }) {
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      ...(headers ? { headers } : {}),
    }),
  });

  if (!resendRes.ok) {
    const detail = await resendRes.text().catch(() => '');
    throw new Error(`Resend request failed (${resendRes.status}): ${detail}`);
  }

  return resendRes.json();
}

module.exports = { EMAIL_RE, FROM, LOGO_URL, renderEmailHtml, sendViaResend };
