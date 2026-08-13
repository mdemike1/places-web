// business/tour-shared.js — tour guiado del panel (globos señalando el sidebar)
// Requiere business-auth.js cargado antes (usa `sb`, esc()).
//
// Arranca solo la primera vez que una cuenta con onboarding completo llega al
// panel (tour_seen_at es null en business_accounts). El botón de relanzar
// (mountTourRelaunchButton) lo vuelve a lanzar cuando quieran, sin límite de usos.
//
// No navega entre páginas: todas las paradas señalan enlaces del sidebar desde
// la página donde arrancó. El sidebar tiene los mismos 6 enlaces en las 6
// páginas del panel, así que no hace falta ir a cada sección para señalarla.

const TOUR_STEPS = [
  { key: 'dashboard', title: 'Dashboard',
    text: 'Aquí ves de un vistazo cómo va tu restaurante en yumlist: menciones recientes y lo último que ha pasado. Es tu punto de partida cada vez que entres.' },
  { key: 'perfil', title: 'Mi perfil',
    text: 'Tus datos, fotos y horario — lo primero que ve alguien que busca tu restaurante. Mantenlo al día, es tu carta de presentación.' },
  { key: 'carta', title: 'Carta',
    text: 'Aquí creas y editas tu carta digital: secciones, platos, precios y alérgenos. También descargas aquí el código QR para tus mesas.' },
  { key: 'reviews', title: 'Reviews',
    text: 'Lo que tus clientes publican sobre ti, siempre con foto real — nada de reseñas anónimas. Con el plan Pro puedes responder directamente.' },
  { key: 'analytics', title: 'Analytics',
    text: 'Cuánta gente escanea tu QR y abre tu carta. Con el plan Pro ves también qué platos miran más y cuánto tiempo pasan leyendo.' },
  { key: 'planes', title: 'Planes',
    text: 'Con el plan gratuito ya tienes perfil, carta digital y QR. Aquí puedes ver qué añaden los planes de pago, sin ningún compromiso.' },
];

let tourStepIndex = 0;
let tourAccountId = null;
let tourEls = null; // { overlay, tooltip }

function isMobileTourLayout() {
  return window.matchMedia('(max-width: 900px)').matches;
}

async function markTourSeen(accountId) {
  await sb.from('business_accounts').update({ tour_seen_at: new Date().toISOString() }).eq('id', accountId);
}

function startTour(account) {
  if (!account?.id || tourEls) return;
  tourAccountId = account.id;
  tourStepIndex = 0;

  document.body.classList.add('tour-active');

  const overlay = document.createElement('div');
  overlay.className = 'tour-overlay';

  const tooltip = document.createElement('div');
  tooltip.className = 'tour-tooltip';

  document.body.appendChild(overlay);
  document.body.appendChild(tooltip);
  tourEls = { overlay, tooltip };

  window.addEventListener('resize', renderTourStep);
  window.addEventListener('orientationchange', renderTourStep);

  renderTourStep();
}

function endTour() {
  if (!tourEls) return;

  const prevLink = document.querySelector('.sidebar-link.tour-spotlight');
  if (prevLink) prevLink.classList.remove('tour-spotlight');

  tourEls.overlay.remove();
  tourEls.tooltip.remove();
  tourEls = null;
  document.body.classList.remove('tour-active');

  window.removeEventListener('resize', renderTourStep);
  window.removeEventListener('orientationchange', renderTourStep);

  if (tourAccountId) markTourSeen(tourAccountId);
  tourAccountId = null;
}

function renderTourStep() {
  if (!tourEls) return;

  const prevLink = document.querySelector('.sidebar-link.tour-spotlight');
  if (prevLink) prevLink.classList.remove('tour-spotlight');

  const step = TOUR_STEPS[tourStepIndex];
  const link = document.querySelector(`.sidebar-link[data-tour="${step.key}"]`);
  if (!link) { endTour(); return; }

  link.classList.add('tour-spotlight');
  link.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  const rect = link.getBoundingClientRect();
  const { tooltip } = tourEls;
  const isLast = tourStepIndex === TOUR_STEPS.length - 1;
  const isFirst = tourStepIndex === 0;

  tooltip.innerHTML = `
    <div class="tour-step-count">${tourStepIndex + 1} de ${TOUR_STEPS.length}</div>
    <div class="tour-tooltip-title">${esc(step.title)}</div>
    <div class="tour-tooltip-text">${esc(step.text)}</div>
    <div class="tour-tooltip-footer">
      <button type="button" class="tour-skip" data-tour-action="skip">Saltar</button>
      <div class="tour-tooltip-nav">
        ${!isFirst ? `<button type="button" class="btn-ghost" data-tour-action="prev">Atrás</button>` : ''}
        <button type="button" class="btn-primary" data-tour-action="next">${isLast ? 'Terminar' : 'Siguiente'}</button>
      </div>
    </div>
  `;

  tooltip.querySelector('[data-tour-action="skip"]').onclick = endTour;
  tooltip.querySelector('[data-tour-action="next"]').onclick = () => {
    if (isLast) { endTour(); return; }
    tourStepIndex++;
    renderTourStep();
  };
  const prevBtn = tooltip.querySelector('[data-tour-action="prev"]');
  if (prevBtn) prevBtn.onclick = () => { tourStepIndex--; renderTourStep(); };

  positionTourTooltip(rect);
}

function positionTourTooltip(rect) {
  const { tooltip } = tourEls;
  // Mide después de pintar el contenido, para conocer su tamaño real
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  const margin = 14;

  if (isMobileTourLayout()) {
    // Sidebar convertido en barra inferior (business.css, @media max-width:900px):
    // el globo va ENCIMA del enlace, nunca debajo (se saldría de la pantalla).
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
    const bottom = window.innerHeight - rect.top + margin;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = 'auto';
    tooltip.style.bottom = `${bottom}px`;
  } else {
    // Sidebar vertical a la izquierda: el globo va al lado del enlace.
    let top = rect.top + rect.height / 2 - th / 2;
    top = Math.max(margin, Math.min(top, window.innerHeight - th - margin));
    tooltip.style.left = `${rect.right + margin}px`;
    tooltip.style.bottom = 'auto';
    tooltip.style.top = `${top}px`;
  }
}

// Arranca solo si el onboarding ya está completo (quien llama ya pasó por
// requireBusinessAccount() sin allowIncomplete) y tour_seen_at sigue a null.
function maybeAutoStartTour(account) {
  if (account && !account.tour_seen_at) startTour(account);
}

// Botón fijo arriba a la derecha del panel, en las 6 páginas, para relanzar
// el tour cuantas veces quieran — no es de un solo uso.
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
