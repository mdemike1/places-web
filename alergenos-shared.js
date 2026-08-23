// alergenos-shared.js — fuente única de los 14 alérgenos del Reglamento (UE)
// 1169/2011, compartida entre el editor de carta del panel (business/carta.html)
// y la carta pública (carta-publica.html).
//
// Estaba duplicada palabra por palabra en las dos páginas. Mientras coincidieran
// no se notaba, pero al añadir un alérgeno en una sola la carta pública habría
// mostrado el slug crudo ("frutos_cascara") por el fallback de ALLERGEN_LABELS.
//
// NO tiene dependencias a propósito: no puede vivir dentro de public-shared.js
// ni de business-auth.js porque los dos declaran `sb`, `esc` y SUPABASE_URL en
// el ámbito global, y cargar cualquiera de ellos junto al otro rompe la página
// con un "Identifier already declared". Así se puede cargar desde cualquier
// sitio sin colisiones.
//
// IMPORTANTE — `slug` es el valor que viaja a Postgres y está bajo un CHECK en
// la columna menu_items.allergens: cambiar uno rompe la validación y deja
// platos ya guardados fuera del CHECK. Sin tildes ni ñ, y nunca se traduce.
// Lo que se muestra es SIEMPRE `label`.
const ALLERGENS = [
  { slug: 'gluten',         label: 'Gluten' },
  { slug: 'crustaceos',     label: 'Crustáceos' },
  { slug: 'huevos',         label: 'Huevos' },
  { slug: 'pescado',        label: 'Pescado' },
  { slug: 'cacahuetes',     label: 'Cacahuetes' },
  { slug: 'soja',           label: 'Soja' },
  { slug: 'lacteos',        label: 'Lácteos' },
  { slug: 'frutos_cascara', label: 'Frutos de cáscara' },
  { slug: 'apio',           label: 'Apio' },
  { slug: 'mostaza',        label: 'Mostaza' },
  { slug: 'sesamo',         label: 'Sésamo' },
  { slug: 'sulfitos',       label: 'Sulfitos' },
  { slug: 'altramuces',     label: 'Altramuces' },
  { slug: 'moluscos',       label: 'Moluscos' },
];

const ALLERGEN_LABELS = Object.fromEntries(ALLERGENS.map(a => [a.slug, a.label]));
