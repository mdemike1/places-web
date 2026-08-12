// business/geocode-shared.js — geocoding compartido por registro.html y perfil.html
// (cualquier página que deje editar la dirección de un negocio).
//
// Mismo criterio de extracción de ciudad en toda la plataforma (ver
// yumlist-app/app/(tabs)/create.tsx): city -> town -> village -> municipality,
// nunca county/state, para no guardar una ciudad "confiadamente incorrecta".
function extractCity(address) {
  if (!address) return null;
  return address.city ?? address.town ?? address.village ?? address.municipality ?? null;
}

// Devuelve { lat, lng, city, addressComponents, displayName } o null si Nominatim
// no encuentra nada o falla la petición. Nunca lanza — quien llama decide qué
// hacer con un resultado nulo (seguir sin coordenadas, avisar, etc.).
async function geocodeAddress(direccion, ciudad) {
  if (!direccion || !ciudad) return null;
  try {
    const q = encodeURIComponent(`${direccion}, ${ciudad}`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&addressdetails=1`, {
      headers: { 'Accept-Language': 'es', 'User-Agent': 'YumlistBusiness/1.0' }
    });
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      city: extractCity(data[0].address),
      addressComponents: data[0].address ?? null,
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}
