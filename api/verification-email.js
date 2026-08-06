// Vercel Serverless Function — sends the verification approved/rejected
// email via Resend. Called by /business/admin right after an admin approves
// or rejects a restaurant's verification documents. Replaces the Edge
// Function "send-business-email", which was never actually deployed.
//
// Only a verified admin (checked via admin_users, same gate business-auth.js
// already uses client-side) can trigger this. The recipient is never trusted
// from the request body — it's looked up from business_accounts using the
// admin's own access token, so a tampered payload can't redirect the email
// anywhere else. Only account_id, decision and admin_note travel in the body.

const { renderEmailHtml, sendViaResend, escapeHtml } = require('./_lib/email');
const { getVerifiedUser, isAdmin, SUPABASE_URL, SUPABASE_ANON_KEY } = require('./_lib/supabase');

async function getBusinessAccount(accountId, accessToken) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/business_accounts?select=email,restaurant_name&id=eq.${encodeURIComponent(accountId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

function approvedEmail(restaurantName) {
  const subject = 'Tu restaurante ya está verificado en yumlist';
  const heading = 'Tu perfil ya está activo';
  const greetingHtml = restaurantName ? `Hola, ${escapeHtml(restaurantName)}` : 'Hola';
  const greetingText = restaurantName ? `Hola, ${restaurantName}` : 'Hola';
  const bodyHtml = `
    <p style="margin:0 0 16px;">${greetingHtml}</p>
    <p style="margin:0 0 16px;">Buenas noticias: hemos verificado tu documentación y tu perfil ya está activo en yumlist.</p>
    <p style="margin:0;color:#F5F0E8;">Ahora es buen momento para completarlo — añade fotos del local, tu carta y revisa que todo esté al día. Un perfil completo se ve mejor cuando alguien llega hasta ti gracias a la recomendación de un amigo.</p>
  `;
  const text = `${heading}\n\n${greetingText}\n\nBuenas noticias: hemos verificado tu documentación y tu perfil ya está activo en yumlist.\n\nAhora es buen momento para completarlo — añade fotos del local, tu carta y revisa que todo esté al día. Un perfil completo se ve mejor cuando alguien llega hasta ti gracias a la recomendación de un amigo.\n\n— El equipo de yumlist\nyumlist.app/business/dashboard`;
  const html = renderEmailHtml({
    preheader: 'Tu perfil ya está activo en yumlist.',
    heading,
    bodyHtml,
    ctaLabel: 'Ir a mi panel',
    ctaUrl: 'https://yumlist.app/business/dashboard',
    footerNote: 'Recibes este email porque tu restaurante está registrado en yumlist.app.',
  });
  return { subject, html, text };
}

function rejectedEmail(restaurantName, adminNote) {
  const subject = 'No hemos podido verificar tu documentación todavía';
  const heading = 'Nos falta un paso';
  const greetingHtml = restaurantName ? `Hola, ${escapeHtml(restaurantName)}` : 'Hola';
  const greetingText = restaurantName ? `Hola, ${restaurantName}` : 'Hola';
  const noteHtml = adminNote
    ? `<p style="margin:0 0 16px;">Esto es lo que hemos visto: &ldquo;${escapeHtml(adminNote)}&rdquo;</p>`
    : '';
  const noteText = adminNote ? `\n\nEsto es lo que hemos visto: "${adminNote}"` : '';
  const bodyHtml = `
    <p style="margin:0 0 16px;">${greetingHtml}</p>
    <p style="margin:0 0 16px;">Hemos revisado la documentación que enviaste y todavía no hemos podido verificarla.</p>
    ${noteHtml}
    <p style="margin:0;color:#F5F0E8;">No pasa nada — puedes volver a intentarlo cuando quieras. Sube un documento nuevo desde tu panel y lo revisamos de nuevo, normalmente en 24–48h.</p>
  `;
  const text = `${heading}\n\n${greetingText}\n\nHemos revisado la documentación que enviaste y todavía no hemos podido verificarla.${noteText}\n\nNo pasa nada — puedes volver a intentarlo cuando quieras. Sube un documento nuevo desde tu panel y lo revisamos de nuevo, normalmente en 24–48h.\n\n— El equipo de yumlist\nyumlist.app/business/verificacion`;
  const html = renderEmailHtml({
    preheader: 'Necesitamos un documento más para verificarte.',
    heading,
    bodyHtml,
    ctaLabel: 'Subir documento',
    ctaUrl: 'https://yumlist.app/business/verificacion',
    footerNote: 'Recibes este email porque tu restaurante está registrado en yumlist.app.',
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
  if (!user) {
    return res.status(401).json({ ok: false, error: 'invalid_token' });
  }

  const admin = await isAdmin(user.id, accessToken).catch(() => false);
  if (!admin) {
    return res.status(403).json({ ok: false, error: 'not_admin' });
  }

  const body = req.body || {};
  const accountId = typeof body.account_id === 'string' ? body.account_id.trim() : '';
  const decision = body.decision === 'approved' || body.decision === 'rejected' ? body.decision : '';
  const adminNote = typeof body.admin_note === 'string' ? body.admin_note.trim().slice(0, 1000) : '';

  if (!accountId || !decision) {
    return res.status(400).json({ ok: false, error: 'invalid_request' });
  }

  const account = await getBusinessAccount(accountId, accessToken);
  if (!account || !account.email) {
    return res.status(200).json({ ok: true, sent: false });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('verification-email: RESEND_API_KEY is not configured');
    return res.status(200).json({ ok: true, sent: false });
  }

  const { subject, html, text } = decision === 'approved'
    ? approvedEmail(account.restaurant_name)
    : rejectedEmail(account.restaurant_name, adminNote);

  try {
    await sendViaResend({ apiKey, to: account.email, subject, html, text });
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error('verification-email: unexpected error sending email', err);
    return res.status(200).json({ ok: true, sent: false });
  }
};
