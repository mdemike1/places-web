// business/tour-shared.js — tour guiado del panel: navega de página en página
// y señala 2-3 elementos por sección con globos explicativos.
// Requiere business-auth.js cargado antes (usa `sb`, esc()).
//
// tour_seen_at se marca al ARRANCAR, no al cerrar: con 12 paradas y
// navegación real entre páginas, forzar el recorrido entero de nuevo solo
// porque alguien cerró la pestaña a mitad sería un incordio. El botón de
// relanzar (mountTourRelaunchButton) es la vía explícita para verlo de nuevo
// o continuar, sin límite de usos.
//
// El progreso entre páginas vive en sessionStorage, no en la base de datos:
// sobrevive a F5 y a "atrás" del navegador, pero no a cerrar la pestaña —
// cerrar y volver otro día empieza una sesión nueva a propósito, no un
// resumen a ciegas de una pantalla que puede haber cambiado.

const TOUR_STOPS = [
  { key: 'dashboard-intro', page: '/business/dashboard', title: 'Dashboard',
    text: 'Aquí ves de un vistazo cómo va tu restaurante en yumlist: menciones recientes y lo último que ha pasado. Es tu punto de partida cada vez que entres.' },
  { key: 'dashboard-stats', page: '/business/dashboard', title: 'Tus números',
    text: 'Estos cuatro datos resumen tu mes: menciones, nota media, cuánta gente te tiene guardado y tus posts totales.' },
  { key: 'dashboard-menciones', page: '/business/dashboard', title: 'Menciones recientes',
    text: 'Aquí aparecerán las opiniones de tus clientes en cuanto lleguen — siempre con foto real, nunca anónimas.' },

  { key: 'perfil-intro', page: '/business/perfil', title: 'Mi perfil',
    text: 'Tus datos, fotos y horario — lo primero que ve alguien que busca tu restaurante. Mantenlo al día, es tu carta de presentación.' },

  { key: 'carta-intro', page: '/business/carta', title: 'Carta',
    text: 'Aquí creas y editas tu carta digital: secciones, platos, precios y alérgenos. También descargas aquí el código QR para tus mesas.' },
  { key: 'carta-publico', page: '/business/carta', title: 'Tu enlace público',
    text: 'Este es el enlace y el código QR de tu carta — imprímelo para las mesas o compártelo donde quieras.' },
  { key: 'carta-crear', page: '/business/carta', title: 'Varias cartas',
    text: 'Puedes tener más de una carta (general, mediodía, temporada…). Entra en cada una para añadir secciones y platos.' },

  { key: 'reviews-intro', page: '/business/reviews', title: 'Reviews',
    text: 'Lo que tus clientes publican sobre ti, siempre con foto real — nada de reseñas anónimas. Con el plan Pro puedes responder directamente.' },
  { key: 'reviews-lista', page: '/business/reviews', title: 'Qué vas a ver aquí',
    text: 'Cada reseña con su nota y su foto real. En cuanto lleguen las primeras, aparecerán en esta lista.' },

  { key: 'analytics-intro', page: '/business/analytics', title: 'Analytics',
    text: 'Cuánta gente escanea tu QR y abre tu carta. Con el plan Pro ves también qué platos miran más y cuánto tiempo pasan leyendo.' },
  { key: 'analytics-visitas', page: '/business/analytics', title: 'Visitantes de tu carta',
    text: 'Cuánta gente distinta abrió tu carta este mes — la señal más directa de si tu QR y tu enlace están funcionando.' },

  { key: 'planes-intro', page: '/business/planes', title: 'Planes',
    text: 'Con el plan gratuito ya tienes perfil, carta digital y QR. Aquí puedes ver qué añaden los planes de pago, sin ningún compromiso.' },
];

const TOUR_RETRY_MAX = 8;      // ~1.2s de reintentos (8 x 150ms) antes de saltar la parada en silencio
const TOUR_RETRY_DELAY = 150;

let tourStepIndex = -1;
let tourAccountId = null;
let tourEls = null; // { blocker, spot, tooltip }
let tourRetryTimer = null;

function isMobileTourLayout() {
  return window.matchMedia('(max-width: 900px)').matches;
}

async function markTourSeen(accountId) {
  await sb.from('business_accounts').update({ tour_seen_at: new Date().toISOString() }).eq('id', accountId);
}

// ── Progreso entre navegaciones (sessionStorage, por cuenta) ──────────────

function tourProgressKey(accountId) {
  return `yumlist_tour_progress_${accountId}`;
}
function saveTourProgress(accountId, index) {
  try { sessionStorage.setItem(tourProgressKey(accountId), String(index)); } catch (e) { /* modo privado, etc. */ }
}
function loadTourProgress(accountId) {
  try {
    const raw = sessionStorage.getItem(tourProgressKey(accountId));
    return raw === null ? null : parseInt(raw, 10);
  } catch (e) { return null; }
}
function clearTourProgress(accountId) {
  try { sessionStorage.removeItem(tourProgressKey(accountId)); } catch (e) { /* noop */ }
}

// ── Ciclo de vida ───────────────────────────────────────────────────────

// Arranca siempre desde la parada 0 — la usa el botón de relanzar y el
// auto-arranque la primera vez. Si la parada 0 no es de esta página, navega.
function startTour(account) {
  if (!account?.id) return;
  clearTourProgress(account.id); // por si el botón de relanzar pisa un progreso a medias
  tourAccountId = account.id;
  markTourSeen(account.id);
  goToStopIndex(0);
}

// Llamada por cada página del panel al terminar de pintar su contenido:
// retoma un progreso guardado, o arranca solo la primera vez (tour_seen_at
// a null), o no hace nada si ya se vio y no hay tour en marcha.
function initTourForPage(account) {
  if (!account?.id) return;
  const stored = loadTourProgress(account.id);

  if (stored === null) {
    if (!account.tour_seen_at) startTour(account);
    return;
  }

  tourAccountId = account.id;
  const currentPath = window.location.pathname;
  let idx = stored;
  if (!TOUR_STOPS[idx] || TOUR_STOPS[idx].page !== currentPath) {
    // El índice guardado no es de esta página (llegó aquí con "atrás", o
    // recargó tras una navegación a medias) — no confiamos en el número a
    // ciegas, buscamos la primera parada real de la página donde estamos.
    idx = TOUR_STOPS.findIndex(s => s.page === currentPath);
    if (idx === -1) { clearTourProgress(account.id); return; }
  }
  goToStopIndex(idx);
}

function endTour() {
  if (tourAccountId) clearTourProgress(tourAccountId);
  unmountTourUI();
  tourAccountId = null;
  tourStepIndex = -1;
}

// Único punto que decide "muéstrame la parada N": si es de esta página la
// pinta (con reintento si el elemento aún no existe); si es de otra, navega.
function goToStopIndex(index) {
  if (index >= TOUR_STOPS.length) { endTour(); return; }

  const stop = TOUR_STOPS[index];
  const currentPath = window.location.pathname;

  if (stop.page !== currentPath) {
    saveTourProgress(tourAccountId, index);
    window.location.href = stop.page;
    return;
  }

  tourStepIndex = index;
  saveTourProgress(tourAccountId, index);
  mountTourUI();
  renderCurrentStop();
}

// ── Montaje / pintado ───────────────────────────────────────────────────

function mountTourUI() {
  if (tourEls) return;
  document.body.classList.add('tour-active');

  const blocker = document.createElement('div');
  blocker.className = 'tour-blocker';

  const spot = document.createElement('div');
  spot.className = 'tour-spot';

  const tooltip = document.createElement('div');
  tooltip.className = 'tour-tooltip';

  document.body.appendChild(blocker);
  document.body.appendChild(spot);
  document.body.appendChild(tooltip);
  tourEls = { blocker, spot, tooltip };

  window.addEventListener('resize', repositionCurrentStop);
  window.addEventListener('orientationchange', repositionCurrentStop);
}

function unmountTourUI() {
  clearTimeout(tourRetryTimer);
  if (!tourEls) return;
  tourEls.blocker.remove();
  tourEls.spot.remove();
  tourEls.tooltip.remove();
  tourEls = null;
  document.body.classList.remove('tour-active');
  window.removeEventListener('resize', repositionCurrentStop);
  window.removeEventListener('orientationchange', repositionCurrentStop);
}

function renderCurrentStop(attempt) {
  attempt = attempt || 0;
  if (!tourEls) return;
  const stop = TOUR_STOPS[tourStepIndex];
  const target = document.querySelector(`[data-tour="${stop.key}"]`);

  if (!target) {
    // El contenido puede seguir cargando (fetch a Supabase todavía en
    // vuelo) — reintenta un rato antes de asumir que el elemento no existe.
    if (attempt < TOUR_RETRY_MAX) {
      tourRetryTimer = setTimeout(() => renderCurrentStop(attempt + 1), TOUR_RETRY_DELAY);
      return;
    }
    // Degrada con dignidad: salta esta parada en silencio, nunca se queda
    // esperando ni muestra un globo señalando el vacío.
    goToStopIndex(tourStepIndex + 1);
    return;
  }

  // scroll instantáneo a propósito — business.css pone scroll-behavior:smooth
  // en <html>, y si dejamos que anime, medimos la posición a mitad de scroll.
  target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  requestAnimationFrame(() => paintStep(target, stop));
}

function paintStep(target, stop) {
  if (!tourEls) return;
  const rect = target.getBoundingClientRect();
  positionSpot(rect);

  const { tooltip } = tourEls;
  const isLast  = tourStepIndex === TOUR_STOPS.length - 1;
  const isFirst = tourStepIndex === 0;

  tooltip.innerHTML = `
    <div class="tour-step-count">${tourStepIndex + 1} de ${TOUR_STOPS.length}</div>
    <div class="tour-tooltip-title">${esc(stop.title)}</div>
    <div class="tour-tooltip-text">${esc(stop.text)}</div>
    <div class="tour-tooltip-footer">
      <button type="button" class="tour-skip" data-tour-action="skip">Saltar</button>
      <div class="tour-tooltip-nav">
        ${!isFirst ? `<button type="button" class="btn-ghost" data-tour-action="prev">Atrás</button>` : ''}
        <button type="button" class="btn-primary" data-tour-action="next">${isLast ? 'Terminar' : 'Siguiente'}</button>
      </div>
    </div>
  `;

  tooltip.querySelector('[data-tour-action="skip"]').onclick = endTour;
  tooltip.querySelector('[data-tour-action="next"]').onclick = () => goToStopIndex(tourStepIndex + 1);
  const prevBtn = tooltip.querySelector('[data-tour-action="prev"]');
  if (prevBtn) prevBtn.onclick = () => goToStopIndex(tourStepIndex - 1);

  positionTourTooltip(rect);
}

// Recoloca el globo y el hueco sin repintar textos — usado en resize/rotación.
function repositionCurrentStop() {
  if (!tourEls || tourStepIndex < 0) return;
  const stop = TOUR_STOPS[tourStepIndex];
  const target = document.querySelector(`[data-tour="${stop.key}"]`);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  positionSpot(rect);
  positionTourTooltip(rect);
}

function positionSpot(rect) {
  const { spot } = tourEls;
  const pad = 6;
  spot.style.top    = `${rect.top - pad}px`;
  spot.style.left   = `${rect.left - pad}px`;
  spot.style.width  = `${rect.width + pad * 2}px`;
  spot.style.height = `${rect.height + pad * 2}px`;
}

// Un solo algoritmo para sidebar, tarjetas anchas y bloques de contenido:
// debajo del elemento si cabe, si no encima; siempre centrado en horizontal
// y sujeto a los bordes de la ventana. En móvil reserva sitio para la barra
// inferior fija (business.css, @media max-width:900px) para que el globo
// nunca quede tapado por ella.
function positionTourTooltip(rect) {
  const { tooltip } = tourEls;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  const margin = 14;
  const bottomReserved = isMobileTourLayout() ? 74 : 0;

  const spaceBelow = window.innerHeight - bottomReserved - rect.bottom;
  const spaceAbove = rect.top;

  let top = (spaceBelow >= th + margin || spaceBelow >= spaceAbove)
    ? rect.bottom + margin
    : rect.top - th - margin;
  top = Math.max(margin, Math.min(top, window.innerHeight - bottomReserved - th - margin));

  let left = rect.left + rect.width / 2 - tw / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));

  tooltip.style.top    = `${top}px`;
  tooltip.style.bottom = 'auto';
  tooltip.style.left   = `${left}px`;
}

// Botón fijo arriba a la derecha del panel, en las 6 páginas, para relanzar
// el tour cuantas veces quieran — no es de un solo uso. Siempre reinicia
// desde la parada 0 (ver startTour).
function mountTourRelaunchButton(account) {
  if (document.querySelector('.tour-relaunch-btn')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tour-relaunch-btn';
  btn.setAttribute('data-tooltip', 'Ver tour guiado');
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.5 9a2.5 2.5 0 0 1 4.6-1.4c.5.7.5 1.7-.2 2.3l-.9.8a2 2 0 0 0-.7 1.5"/>
    <circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none"/>
  </svg>`;
  btn.onclick = () => startTour(account);

  document.body.appendChild(btn);
}
