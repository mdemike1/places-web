// Vercel Serverless Function — sends the "you just signed up in the app"
// welcome email via Resend. Called by the mobile app right after registration.
//
// Unlike the waitlist endpoint, this isn't reachable by an anonymous form
// submission, so it can't lean on a honeypot for abuse protection. Instead it
// requires a valid Supabase access token and sends only to the email Supabase
// itself confirms for that token — a caller can't direct this at an arbitrary
// address without first creating a real, authenticated account.

const { renderEmailHtml, sendViaResend } = require('./_lib/email');
const { getVerifiedUser } = require('./_lib/supabase');

function welcomeEmail() {
  const subject = 'Bienvenido a yumlist 🍴';
  const heading = 'Ya estás dentro';
  const bodyHtml = `
    <p style="margin:0 0 16px;">yumlist es lo que comen tus amigos de verdad — sin algoritmos, sin reseñas patrocinadas.</p>
    <p style="margin:0;color:#F5F0E8;">Pero el feed solo cobra vida cuando tus amigos están dentro. Invítalos y empieza a ver dónde comen de verdad.</p>
  `;
  const text = `Ya estás dentro\n\nyumlist es lo que comen tus amigos de verdad — sin algoritmos, sin reseñas patrocinadas.\n\nPero el feed solo cobra vida cuando tus amigos están dentro. Invítalos y empieza a ver dónde comen de verdad.\n\n— El equipo de yumlist`;
  const html = renderEmailHtml({
    preheader: 'Invita a tus amigos y dale vida a tu feed.',
    heading,
    bodyHtml,
    ctaLabel: 'Invitar amigos',
    ctaUrl: 'yumlist://invite',
    footerNote: 'Recibes este email porque creaste una cuenta en yumlist.',
  });
  return { subject, html, text };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!accessToken) {
    return res.status(401).json({ ok: false, error: 'missing_token' });
  }

  const user = await getVerifiedUser(accessToken).catch(() => null);

  if (!user || !user.email) {
    return res.status(401).json({ ok: false, error: 'invalid_token' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('app-welcome: RESEND_API_KEY is not configured');
    return res.status(200).json({ ok: true, sent: false });
  }

  const { subject, html, text } = welcomeEmail();

  try {
    await sendViaResend({ apiKey, to: user.email, subject, html, text });
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error('app-welcome: unexpected error sending email', err);
    return res.status(200).json({ ok: true, sent: false });
  }
};
