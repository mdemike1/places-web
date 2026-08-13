// business/onboarding-shared.js — barra de progreso compartida por las páginas
// reutilizadas como paso de onboarding (perfil.html, verificacion.html, carta.html)
// y por onboarding.html / onboarding-final.html. Un solo sitio para el orden de
// pasos y su presentación — si cambia el número de pasos o sus nombres, se toca
// aquí, no en cada página.
//
// Requiere business-auth.js cargado antes (usa doSignOut()).

const ONBOARDING_STEPS = [
  { key: 'bienvenida',    label: 'Bienvenida' },
  { key: 'perfil',        label: 'Tu restaurante' },
  { key: 'verificacion',  label: 'Verificación' },
  { key: 'carta',         label: 'Tu carta' },
  { key: 'final',         label: 'Listo' },
];

function isOnboardingMode() {
  return new URLSearchParams(location.search).get('onboarding') === '1';
}

// Marca de "saltó la verificación", guardada en este navegador — no en la
// base de datos. No hay forma de derivar "la saltó" de "no ha llegado
// todavía" a partir de business_verification_docs (saltar no deja ninguna
// fila), así que sin esta marca el router de /business/onboarding
// recalcularía nextStep='verificacion' cada vez y devolvería al usuario a la
// misma pantalla que acaba de saltar.
//
// Es local al navegador a propósito: si el usuario retoma el onboarding
// desde otro dispositivo antes de terminar la carta, se le ofrecerá
// verificar una vez más — un paso opcional de un clic, no un bloqueo. No
// merece una columna nueva en business_accounts para ese caso límite.
function verificacionSkipKey(businessId) {
  return `yumlist_verificacion_skipped_${businessId}`;
}

function markVerificacionSkipped(businessId) {
  try { localStorage.setItem(verificacionSkipKey(businessId), '1'); } catch (e) { /* Safari modo privado, etc. */ }
}

function wasVerificacionSkipped(businessId) {
  try { return localStorage.getItem(verificacionSkipKey(businessId)) === '1'; } catch (e) { return false; }
}

// Monta la barra superior y activa el layout de ancho completo (ver business.css,
// body.onboarding-mode). Sustituye a buildSidebar() para las páginas en modo
// onboarding — mount debe ser el mismo #sidebar-mount que ya usan.
function renderOnboardingChrome(mountId, stepKey) {
  document.body.classList.add('onboarding-mode');

  const el = document.getElementById(mountId);
  if (!el) return;

  const idx = ONBOARDING_STEPS.findIndex(s => s.key === stepKey);
  const stepNum = idx + 1;
  const total = ONBOARDING_STEPS.length;
  const pct = Math.round((stepNum / total) * 100);

  el.innerHTML = `
    <div class="onboarding-topbar">
      <div class="onboarding-topbar-inner">
        <svg width="88" viewBox="0 0 120 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="18" r="10" fill="#C4622D"/>
          <circle cx="19" cy="18" r="10" fill="#F5F0E8" fill-opacity="0.1" stroke="#F5F0E8" stroke-width="0.8"/>
          <text x="34" y="24" font-family="'Cormorant Garamond',Georgia,serif" font-size="22" font-weight="300" letter-spacing="-1" fill="#F5F0E8">yumlist</text>
        </svg>
        <div class="onboarding-progress">
          <div class="onboarding-progress-label">Paso ${stepNum} de ${total} — ${esc(ONBOARDING_STEPS[idx]?.label ?? '')}</div>
          <div class="onboarding-progress-track"><div class="onboarding-progress-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="onboarding-topbar-actions">
          <a href="/business/ayuda" target="_blank" rel="noopener" class="onboarding-help-link">Preguntas frecuentes ↗</a>
          <button class="onboarding-signout" onclick="doSignOut()">Cerrar sesión</button>
        </div>
      </div>
    </div>
  `;
}

// Único punto que decide "a dónde te mando ahora" durante el recorrido — cada
// página que reutiliza un paso llama a esto al terminar en vez de conocer ella
// misma cuál es el siguiente paso. Recalcula el estado desde cero cada vez
// (nunca asume un orden fijo "grabado"), así que es robusto si se entra a mitad
// del flujo o si algo ya estaba hecho de antes.
function goToNextOnboardingStep() {
  window.location.href = '/business/onboarding';
}
