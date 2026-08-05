// One-off generator for the "beta is live" broadcast (correo 2), sent once
// to the whole `waitlist` Audience via Resend Broadcasts — not a serverless
// endpoint, just a local script that prints the subject/HTML/text to paste
// into the Broadcast composer. Uses the same shared template as the
// transactional emails so the three stay visually identical.
//
// Run: node scripts/render-beta-launch-email.js
// Writes subject.txt, email.html and email.txt next to this script.

const fs = require('fs');
const path = require('path');
const { renderEmailHtml } = require('../api/_lib/email');

const subject = '¿Te acuerdas de yumlist? Ya está aquí 🍴';

const heading = 'Ya puedes entrar';

const bodyHtml = `
    <p style="margin:0 0 16px;">Hola,</p>
    <p style="margin:0 0 16px;">Te apuntaste a la lista de espera de yumlist hace un tiempo — puede que ya ni te acordaras. Pues ha llegado el momento: la beta ya está viva en Barcelona.</p>
    <p style="margin:0 0 16px;">Eres de los primeros en poder entrar. Sin estrellitas, sin reseñas pagadas — solo lo que tus amigos comen de verdad.</p>
    <p style="margin:0;color:#F5F0E8;font-style:italic;">Tus amigos no mienten.</p>
  `;

const text = `Ya puedes entrar

Hola,

Te apuntaste a la lista de espera de yumlist hace un tiempo — puede que ya ni te acordaras. Pues ha llegado el momento: la beta ya está viva en Barcelona.

Eres de los primeros en poder entrar. Sin estrellitas, sin reseñas pagadas — solo lo que tus amigos comen de verdad.

Tus amigos no mienten.

Entrar en yumlist: https://yumlist.app

— El equipo de yumlist

Darte de baja: {{{RESEND_UNSUBSCRIBE_URL}}}`;

// {{{RESEND_UNSUBSCRIBE_URL}}} only resolves when this Broadcast is sent to
// an Audience — exactly the CSV-imported one this is meant for.
const html = renderEmailHtml({
  preheader: 'La beta ya está viva en Barcelona. Eres de los primeros en entrar.',
  heading,
  bodyHtml,
  ctaLabel: 'Entrar en yumlist',
  // TODO: si para el lanzamiento ya existe una página de descarga real
  // (App Store / Play Store / smart link), cambia esta URL antes de enviar.
  ctaUrl: 'https://yumlist.app',
  footerNote:
    'Recibes este email porque te apuntaste a la lista de espera de yumlist. ' +
    '<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:inherit;text-decoration:underline;">Darte de baja</a>.',
});

fs.writeFileSync(path.join(__dirname, 'subject.txt'), subject);
fs.writeFileSync(path.join(__dirname, 'email.html'), html);
fs.writeFileSync(path.join(__dirname, 'email.txt'), text);

console.log('Asunto:', subject);
console.log('Escrito: scripts/email.html, scripts/email.txt, scripts/subject.txt');
