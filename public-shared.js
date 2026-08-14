// public-shared.js — utilidades compartidas entre las páginas públicas de un
// restaurante (carta-publica.html, perfil-publico.html). Reglas de negocio que
// podrían divergir entre las dos si se duplicaran; el CSS y el marcado de cada
// página se quedan aparte a propósito, son layouts distintos.
//
// Requiere el UMD de @supabase/supabase-js cargado ANTES que este script.

const SUPABASE_URL = 'https://klkksarpfcohfqirxwoe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtsa2tzYXJwZmNvaGZxaXJ4d29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDMwMTUsImV4cCI6MjA4OTYxOTAxNX0.ep8NgjugAIAW07qRdlM4A2ScHEHteDBaRQMOmGKPTtE';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Mismo radio que RESTAURANT_PROXIMITY_M en yumlist-app/lib/constants.ts —
// "es sobre este restaurante" se decide igual en toda la plataforma.
const RESTAURANT_PROXIMITY_M = 50;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function fmtPrice(n) { return Number(n).toFixed(2).replace('.', ','); }

function avg(arr) {
  if (!arr || arr.length === 0) return null;
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
}

function yumlistLogo(size) {
  const w = size || 110;
  return `<svg width="${w}" viewBox="0 0 120 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="18" r="10" fill="#C4622D"/>
    <circle cx="19" cy="18" r="10" fill="#F5F0E8" fill-opacity="0.1" stroke="#F5F0E8" stroke-width="0.8"/>
    <text x="34" y="24" font-family="'Cormorant Garamond',Georgia,serif" font-size="22" font-weight="300" letter-spacing="-1" fill="#F5F0E8">yumlist</text>
  </svg>`;
}

// DUPLICADO-HAVERSINE: esta formula existe tambien en otros 4 sitios
// (places-web: admin.html, business/business-auth.js; yumlist-app: lib/geo.ts,
// lib/hooks/useBusinessAccount.ts). Busca "DUPLICADO-HAVERSINE" para
// encontrarlos todos si alguna vez hay que tocar el radio de la Tierra o la formula.
function haversineM(la1, lo1, la2, lo2) {
  const R = 6371000, dL = (la2 - la1) * Math.PI / 180, dO = (lo2 - lo1) * Math.PI / 180,
    a = Math.sin(dL / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Trae los posts a ≤50m del negocio (caja de coordenadas + Haversine exacto),
// con todas las columnas que cualquiera de las dos páginas públicas pueda
// necesitar (fotos y valoraciones) — quien llama decide qué subconjunto usar,
// para no filtrar aquí de una forma que le venga bien a una página y le
// descuente datos a la otra (p. ej. exigir foto descartaría valoraciones
// válidas de posts sin foto).
//
// Columnas de nota verificadas en vivo contra el esquema real: posts solo
// tiene rating_food/rating_service/rating_price — los alias nota_comida/nota/
// nota_servicio/nota_precio que usa el ?? de dashboard.html no existen en esta
// tabla (ahí no rompen porque ese select() es '*'; aquí sí romperían, un
// select() con nombre explícito de columna que no existe es un error 42703).
async function fetchNearbyPosts(account) {
  if (!account?.lat || !account?.lng) return [];
  const delta = 0.0007; // ~75m de caja, filtro exacto a 50m con Haversine después
  const { data } = await sb.from('posts')
    .select('photo_url, lat, lng, rating_food, rating_service, rating_price, created_at')
    .gte('lat', account.lat - delta).lte('lat', account.lat + delta)
    .gte('lng', account.lng - delta).lte('lng', account.lng + delta)
    .order('created_at', { ascending: false })
    .limit(60);

  if (!data) return [];
  return data.filter(p => p.lat && p.lng && haversineM(account.lat, account.lng, p.lat, p.lng) <= RESTAURANT_PROXIMITY_M);
}

// ── Horario ──────────────────────────────────────────────────────────────
// DUPLICADO-HORARIO: esta logica existe tambien en
// yumlist-app/lib/businessHours.ts (computeOpenStatus). Si cambias la regla
// aqui, cambiala alli tambien. Busca "DUPLICADO-HORARIO" para encontrar las dos.
// Duplicado a propósito entre repos (no una RPC): el cálculo tiene que poder
// rehacerse en el cliente sin red, para que "abierto ahora" siga siendo
// correcto aunque el móvil pierda cobertura un momento. Dentro de places-web,
// en cambio, SÍ se comparte entre carta-publica.html y perfil-publico.html —
// mismo repo, mismo runtime, sin motivo para dos copias.
const DAYS_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo' };
const WEEKDAY_TO_KEY = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Hora y día locales del NEGOCIO (su huso horario guardado), no los del
// visitante — Intl.DateTimeFormat con timeZone gestiona el cambio de hora
// solo, sin aritmética manual de desplazamientos.
function getLocalDayAndTime(timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const weekday = parts.find(p => p.type === 'weekday').value;
  let hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  if (hour === '24') hour = '00'; // quirk conocido de Intl a medianoche exacta
  return { dayKey: WEEKDAY_TO_KEY[weekday], minutes: parseInt(hour, 10) * 60 + parseInt(minute, 10) };
}

// Devuelve { open: bool, until } si está abierto ahora, o { open: false, next }
// con la próxima apertura (hoy más tarde, mañana, o hasta 7 días vista).
function computeOpenStatus(hours) {
  const { dayKey, minutes } = getLocalDayAndTime(hours.timezone);
  const todayIdx = DAYS_ORDER.indexOf(dayKey);
  const yesterdayKey = DAYS_ORDER[(todayIdx + 6) % 7];

  // Un turno de ayer que cruza medianoche puede seguir vivo ahora mismo.
  for (const s of (hours.days[yesterdayKey] || [])) {
    const open = toMinutes(s.open), close = toMinutes(s.close);
    if (close <= open && minutes < close) return { open: true, until: s.close };
  }

  const todayShifts = hours.days[dayKey] || [];
  for (const s of todayShifts) {
    const open = toMinutes(s.open), close = toMinutes(s.close);
    const crossesMidnight = close <= open;
    const effectiveClose = crossesMidnight ? close + 24 * 60 : close;
    if (minutes >= open && minutes < effectiveClose) return { open: true, until: s.close };
  }

  const laterToday = todayShifts
    .filter(s => toMinutes(s.open) > minutes)
    .sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0];
  if (laterToday) return { open: false, next: `hoy a las ${laterToday.open}` };

  for (let i = 1; i <= 7; i++) {
    const key = DAYS_ORDER[(todayIdx + i) % 7];
    const shifts = (hours.days[key] || []).slice().sort((a, b) => toMinutes(a.open) - toMinutes(b.open));
    if (shifts.length) {
      const when = i === 1 ? 'mañana' : DAY_LABELS[key].toLowerCase();
      return { open: false, next: `${when} a las ${shifts[0].open}` };
    }
  }
  return { open: false, next: null }; // cerrado toda la semana
}

// Pinta dentro de #hours-section (id fijo, lo esperan las dos páginas). Mismas
// clases CSS en las dos — cada página las define en su propio <style>, pero
// el HTML que genera esta función es idéntico para ambas.
function renderHoursSection(account) {
  const el = document.getElementById('hours-section');
  if (!el) return;

  // Convivencia: sin hours estructurado, se cae al texto libre — sin punto de
  // color ni "abierto/cerrado", porque no se puede afirmar eso con certeza de
  // un texto sin estructura. En cuanto hours tiene valor, manda él solo.
  if (!account.hours || !account.hours.days) {
    el.innerHTML = account.schedule ? `<div class="hours-fallback">${esc(account.schedule)}</div>` : '';
    return;
  }

  const status = computeOpenStatus(account.hours);
  const statusText = status.open
    ? `Abierto ahora · cierra a las ${status.until}`
    : (status.next ? `Cerrado · abre ${status.next}` : 'Cerrado');
  const todayKey = getLocalDayAndTime(account.hours.timezone).dayKey;

  el.innerHTML = `
    <div class="hours-toggle" onclick="toggleHoursAccordion()">
      <span class="hours-dot ${status.open ? 'open' : 'closed'}"></span>
      <span class="hours-status-text">${esc(statusText)}</span>
      <span class="hours-chevron" id="hours-chevron">▾</span>
    </div>
    <div class="hours-week" id="hours-week" hidden>
      ${DAYS_ORDER.map(key => {
        const shifts = account.hours.days[key] || [];
        const text = shifts.length ? shifts.map(s => `${s.open}–${s.close}`).join(', ') : 'Cerrado';
        return `<div class="hours-week-row${key === todayKey ? ' hours-today' : ''}"><span>${DAY_LABELS[key]}</span><span>${esc(text)}</span></div>`;
      }).join('')}
    </div>
  `;
}

function toggleHoursAccordion() {
  const week = document.getElementById('hours-week');
  const chevron = document.getElementById('hours-chevron');
  if (!week || !chevron) return;
  week.hidden = !week.hidden;
  chevron.classList.toggle('open', !week.hidden);
}

// Lee el id del negocio del pathname de una rewrite de vercel.json (/r/:id,
// /n/:id, …) sin depender de que Vercel reescriba nada dentro del destino —
// se probó interpolar :id en la query del destino y no llegaba; el pathname
// es la fuente robusta porque solo depende de la URL que ya trae el
// navegador. prefixes es un array ('r', 'n', ...) para que cada página
// reconozca su propio patrón. Fallback ?business= para pruebas locales.
function getBusinessIdFromUrl(prefixes) {
  for (const prefix of prefixes) {
    const match = location.pathname.match(new RegExp(`^/${prefix}/([^/]+)/?$`));
    if (match) return decodeURIComponent(match[1]);
  }
  return new URLSearchParams(location.search).get('business');
}
