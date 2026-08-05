// Vercel Serverless Function — sends the waitlist welcome email via Resend.
// Best-effort: the user is already saved in Supabase before this runs, so any
// failure here is logged and swallowed rather than surfaced to the client.

const { EMAIL_RE, renderEmailHtml, sendViaResend, escapeHtml } = require('./_lib/email');

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
  const html = renderEmailHtml({
    preheader: 'Gracias por unirte a la lista de espera de yumlist.',
    heading,
    bodyHtml,
    ctaLabel: 'Visitar yumlist.app',
    ctaUrl: 'https://yumlist.app',
    footerNote: 'Recibes este email porque te apuntaste en yumlist.app.',
  });
  return { subject, html, text };
}

function businessEmail(restaurantName) {
  const subject = 'Tu restaurante ya está en la lista de espera de yumlist';
  const heading = 'Ya estás en la lista';
  const greetingHtml = restaurantName ? `Hola, ${escapeHtml(restaurantName)}` : 'Hola';
  const greetingText = restaurantName ? `Hola, ${restaurantName}` : 'Hola';
  const bodyHtml = `
    <p style="margin:0 0 16px;">${greetingHtml}</p>
    <p style="margin:0 0 16px;">Gracias por apuntar tu restaurante a yumlist. Cuando abramos el panel de negocios, serás de los primeros en entrar y reclamar tu perfil.</p>
    <p style="margin:0;color:#F5F0E8;">En yumlist, la gente decide dónde comer por lo que le cuenta un amigo — no un desconocido, no un anuncio. Cuando alguien recomienda tu restaurante, sus amigos lo ven, y van.</p>
  `;
  const text = `${heading}\n\n${greetingText}\n\nGracias por apuntar tu restaurante a yumlist. Cuando abramos el panel de negocios, serás de los primeros en entrar y reclamar tu perfil.\n\nEn yumlist, la gente decide dónde comer por lo que le cuenta un amigo — no un desconocido, no un anuncio. Cuando alguien recomienda tu restaurante, sus amigos lo ven, y van.\n\n— El equipo de yumlist\nyumlist.app/negocios`;
  const html = renderEmailHtml({
    preheader: 'Tu restaurante ya está en la lista de espera de yumlist.',
    heading,
    bodyHtml,
    ctaLabel: 'Ver yumlist para negocios',
    ctaUrl: 'https://yumlist.app/negocios',
    footerNote: 'Recibes este email porque te apuntaste en yumlist.app.',
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
  const restaurantName = typeof body.restaurant_name === 'string' ? body.restaurant_name.trim().slice(0, 200) : '';

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('waitlist-welcome: RESEND_API_KEY is not configured');
    return res.status(200).json({ ok: true, sent: false });
  }

  const { subject, html, text } = audience === 'business' ? businessEmail(restaurantName) : userEmail();

  try {
    await sendViaResend({ apiKey, to: email, subject, html, text });
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error('waitlist-welcome: unexpected error sending email', err);
    return res.status(200).json({ ok: true, sent: false });
  }
};
