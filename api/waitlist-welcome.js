// Vercel Serverless Function — sends the waitlist welcome email via Resend.
// Best-effort: the user is already saved in Supabase before this runs, so any
// failure here is logged and swallowed rather than surfaced to the client.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM = 'yumlist <hola@yumlist.app>';

const BRAND_FONT = "Georgia,'Times New Roman',serif";
const BODY_FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function baseTemplate({ preheader, heading, bodyHtml, ctaLabel, ctaUrl }) {
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
<td width="20" height="20" style="background:#C4622D;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
<td width="6" style="font-size:0;line-height:0;">&nbsp;</td>
<td width="20" height="20" style="background:rgba(245,240,232,0.12);border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
<td width="10" style="font-size:0;line-height:0;">&nbsp;</td>
<td style="font-family:${BRAND_FONT};font-size:20px;color:#F5F0E8;letter-spacing:-0.5px;">yumlist</td>
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
<td align="center" style="border-top:1px solid rgba(245,240,232,0.1);padding-top:20px;font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:rgba(245,240,232,0.35);">
© 2026 Yumlist · Barcelona<br>Recibes este email porque te apuntaste en yumlist.app.
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function userEmail() {
  const subject = 'Ya estás dentro 🍴 bienvenido a yumlist';
  const heading = 'Ya estás en la lista';
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hola,</p>
    <p style="margin:0 0 16px;">Gracias por apuntarte a yumlist. Te acabamos de guardar un sitio en la lista de espera — en cuanto abramos la beta en Barcelona, serás de los primeros en enterarte.</p>
    <p style="margin:0 0 16px;">Mientras tanto, una cosa: yumlist no va de estrellitas ni de reseñas patrocinadas. Va de lo que de verdad piensan tus amigos sobre dónde comer. Sin filtros, sin postureo.</p>
    <p style="margin:0;color:#F5F0E8;font-style:italic;">Tus amigos no mienten.</p>
  `;
  const text = `Ya estás en la lista\n\nHola,\n\nGracias por apuntarte a yumlist. Te acabamos de guardar un sitio en la lista de espera — en cuanto abramos la beta en Barcelona, serás de los primeros en enterarte.\n\nMientras tanto, una cosa: yumlist no va de estrellitas ni de reseñas patrocinadas. Va de lo que de verdad piensan tus amigos sobre dónde comer. Sin filtros, sin postureo.\n\nTus amigos no mienten.\n\n— El equipo de yumlist\nyumlist.app`;
  const html = baseTemplate({
    preheader: 'Gracias por unirte a la lista de espera de yumlist.',
    heading,
    bodyHtml,
    ctaLabel: 'Visitar yumlist.app',
    ctaUrl: 'https://yumlist.app',
  });
  return { subject, html, text };
}

function businessEmail() {
  const subject = 'Tu restaurante ya está en la lista de espera 🍽️';
  const heading = 'Tu sitio, reservado';
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hola,</p>
    <p style="margin:0 0 16px;">Gracias por apuntar tu restaurante a yumlist. Te hemos guardado un hueco en la lista de espera — en cuanto abramos el panel de negocios, te escribimos para que reclames tu perfil.</p>
    <p style="margin:0 0 16px;">yumlist conecta a la gente con recomendaciones reales de sus amigos, no con reseñas compradas ni posicionamiento pagado. Que tu restaurante aparezca ahí es aparecer donde la gente realmente confía.</p>
    <p style="margin:0;color:#F5F0E8;font-style:italic;">Tus amigos no mienten — y pronto, tampoco tus clientes.</p>
  `;
  const text = `Tu sitio, reservado\n\nHola,\n\nGracias por apuntar tu restaurante a yumlist. Te hemos guardado un hueco en la lista de espera — en cuanto abramos el panel de negocios, te escribimos para que reclames tu perfil.\n\nyumlist conecta a la gente con recomendaciones reales de sus amigos, no con reseñas compradas ni posicionamiento pagado. Que tu restaurante aparezca ahí es aparecer donde la gente realmente confía.\n\nTus amigos no mienten — y pronto, tampoco tus clientes.\n\n— El equipo de yumlist\nyumlist.app/negocios`;
  const html = baseTemplate({
    preheader: 'Tu restaurante ya está en la lista de espera de yumlist.',
    heading,
    bodyHtml,
    ctaLabel: 'Ver yumlist para negocios',
    ctaUrl: 'https://yumlist.app/negocios',
  });
  return { subject, html, text };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = req.body || {};

  // Honeypot: a bot calling this endpoint directly (skipping the form and its
  // own honeypot check) is caught here too. Same generic response either way,
  // so there's no observable difference between "caught" and "email skipped".
  if (typeof body.hp === 'string' && body.hp.trim() !== '') {
    return res.status(200).json({ ok: true, sent: false });
  }

  const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';

  if (!rawEmail || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  const email = rawEmail.toLowerCase();
  const audience = body.type === 'business' ? 'business' : 'user';

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('waitlist-welcome: RESEND_API_KEY is not configured');
    return res.status(200).json({ ok: true, sent: false });
  }

  const { subject, html, text } = audience === 'business' ? businessEmail() : userEmail();

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [email], subject, html, text }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text().catch(() => '');
      console.error('waitlist-welcome: Resend request failed', resendRes.status, detail);
      return res.status(200).json({ ok: true, sent: false });
    }

    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error('waitlist-welcome: unexpected error sending email', err);
    return res.status(200).json({ ok: true, sent: false });
  }
};
