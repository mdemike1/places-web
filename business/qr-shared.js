// business/qr-shared.js — generación del QR de la carta pública, compartida entre
// carta.html y onboarding-final.html. Si cambia el formato (pendiente: GIF -> SVG/PNG
// para imprenta) o la librería, se toca aquí una sola vez.
//
// Requiere, en este orden, cargados antes en la página:
//   1. https://cdn.jsdelivr.net/npm/qrcode-generator@.../dist/qrcode.js (define `qrcode`)
//   2. business-auth.js (define `esc()`)

// La URL nunca lleva el nombre del restaurante, solo business_accounts.id — es lo
// único que no cambia nunca, aunque el restaurante se renombre. El QR impreso en
// las mesas depende de que esto no se toque jamás.
function publicMenuUrl(businessId) {
  return `https://yumlist.app/r/${businessId}`;
}

function copyPublicLink(businessId) {
  const url = publicMenuUrl(businessId);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(
      () => alert('Enlace copiado.'),
      () => prompt('Copia el enlace manualmente:', url)
    );
  } else {
    prompt('Copia el enlace manualmente:', url);
  }
}

function downloadQR(businessId) {
  // Comprobación explícita: si el CDN falla o tarda, esto evita un error mudo
  // en consola y le dice al dueño qué hacer.
  if (typeof qrcode === 'undefined') {
    alert('No se pudo cargar el generador de QR (fallo de red con el CDN). Recarga la página y vuelve a intentarlo — si sigue sin funcionar, avísanos.');
    return;
  }
  try {
    const qr = qrcode(0, 'M'); // 0 = detecta automáticamente el tamaño necesario; M = corrección de errores media
    qr.addData(publicMenuUrl(businessId));
    qr.make();
    const link = document.createElement('a');
    link.download = `yumlist-qr-${businessId}.gif`; // qrcode-generator produce GIF (sin canvas), no PNG — perfecto para blanco y negro, sin pérdida
    link.href = qr.createDataURL(10, 4);
    link.click();
  } catch (e) {
    alert('No se pudo generar el QR: ' + e.message);
  }
}

// Pinta la tarjeta de enlace + botones dentro del contenedor dado. Cada página
// decide dónde montarla — solo necesita un <div id="..."></div> vacío.
function renderPublicLinkCard(containerId, businessId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const url = publicMenuUrl(businessId);
  el.innerHTML = `
    <div>
      <div class="public-link-label">Tu página pública</div>
      <div class="public-link-url">${esc(url.replace('https://', ''))}</div>
      <div class="public-link-hint">Compártelo o descarga el QR para las mesas. No cambia nunca, aunque renombres el restaurante — pégalo en la mesa con confianza.</div>
    </div>
    <div class="public-link-actions">
      <button class="btn-sm" onclick="copyPublicLink('${businessId}')">Copiar enlace</button>
      <button class="btn-primary" style="width:auto;padding:10px 20px;margin-top:0" onclick="downloadQR('${businessId}')">Descargar QR</button>
    </div>
  `;
}
