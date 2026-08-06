// business-auth.js — Yumlist Business Panel shared utilities
// Requires @supabase/supabase-js (UMD) loaded before this script

const SUPABASE_URL = 'https://klkksarpfcohfqirxwoe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtsa2tzYXJwZmNvaGZxaXJ4d29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDMwMTUsImV4cCI6MjA4OTYxOTAxNX0.ep8NgjugAIAW07qRdlM4A2ScHEHteDBaRQMOmGKPTtE';

// ⚠️  Cambia esto por tu email personal — solo tú podrás acceder a /business/admin
const ADMIN_EMAIL = 'admin@yumlist.app';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Auth ──────────────────────────────────────────────────────────────────────

async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.replace('/business/login'); return null; }
  return session;
}

async function requireAdmin() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.replace('/business/login'); return null; }

  const { data: adminRow } = await sb
    .from('admin_users')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!adminRow) {
    // Authenticated but not an admin — show denial screen instead of redirecting to login
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;
        justify-content:center;background:#0e0d0c;font-family:'DM Sans',sans-serif;
        gap:16px;text-align:center;padding:32px">
        <div style="font-size:40px;color:rgba(245,240,232,0.12)">⊘</div>
        <h1 style="color:#F5F0E8;font-size:20px;font-weight:500;margin:0">Acceso denegado</h1>
        <p style="color:rgba(245,240,232,0.45);font-size:14px;margin:0;max-width:320px;line-height:1.6">
          Tu cuenta no tiene permisos de administración de Yumlist.
        </p>
        <button onclick="doSignOut()"
          style="margin-top:8px;background:rgba(245,240,232,0.06);color:#F5F0E8;
            border:0.5px solid rgba(245,240,232,0.18);border-radius:8px;
            padding:10px 22px;font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif;
            transition:background .2s"
          onmouseover="this.style.background='rgba(245,240,232,0.12)'"
          onmouseout="this.style.background='rgba(245,240,232,0.06)'">
          Cerrar sesión
        </button>
      </div>`;
    return null;
  }

  return session;
}

async function getBusinessAccount(userId) {
  const { data, error } = await sb
    .from('business_accounts')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (expected for new users)
    console.warn('[business-auth] getBusinessAccount error:', error.message,
      '\n→ Comprueba que la tabla business_accounts existe y que RLS permite SELECT con auth.uid() = id');
  }
  return data ?? null;
}

// Guard for every page under /business/* except /business/admin (which uses
// requireAdmin) and the auth pages themselves (login/registro have their own
// "already logged in" checks). Redirects away and never returns a value the
// caller can render with — no session data or nav should reach the page
// unless there's a confirmed business_accounts row for it.
async function requireBusinessAccount() {
  const session = await requireAuth();
  if (!session) return null; // requireAuth() already redirected to /business/login

  const account = await getBusinessAccount(session.user.id);
  if (!account) {
    window.location.replace('/business/registro?motivo=sin-cuenta');
    return null;
  }

  return { session, account };
}

async function doSignOut() {
  await sb.auth.signOut();
  window.location.replace('/business/login');
}

// ── Geo ───────────────────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fetch all posts within 50m of the restaurant (bounding box + Haversine filter)
// Adjust column names below to match your actual posts table schema
async function fetchRestaurantPosts(account, options = {}) {
  if (!account?.lat || !account?.lng) return [];
  const { lat, lng } = account;
  const delta = 0.0015; // ~150m bounding box pre-filter

  let q = sb
    .from('posts')
    .select('*, profiles(username, avatar_url)')  // adjust join if needed
    .gte('lat', lat - delta).lte('lat', lat + delta)
    .gte('lng', lng - delta).lte('lng', lng + delta)
    .order('created_at', { ascending: false });

  if (options.limit) q = q.limit(options.limit * 6);

  const { data: posts, error } = await q;
  if (error || !posts) return [];

  const nearby = posts.filter(p => p.lat && p.lng && haversine(lat, lng, p.lat, p.lng) <= 50);
  return options.limit ? nearby.slice(0, options.limit) : nearby;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function buildSidebar(account, activePage) {
  const status = account?.status || 'pending';
  const plan   = account?.plan   || 'free';

  const badgeClass = { verified: 'badge-verified', rejected: 'badge-rejected', pending: 'badge-pending' }[status] ?? 'badge-pending';
  const badgeText  = { verified: 'Verificado ✓', rejected: 'Rechazado', pending: 'Pendiente de verificación' }[status] ?? 'Pendiente';
  const planLabel  = { free: 'Free', pro: 'Pro', premium: 'Premium' }[plan] ?? 'Free';

  const nav = [
    { href: '/business/dashboard', label: 'Dashboard',
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
    { href: '/business/perfil',    label: 'Mi perfil',
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
    { href: '/business/reviews',   label: 'Reviews',
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' },
    { href: '/business/analytics', label: 'Analytics',
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
    { href: '/business/planes',    label: 'Planes',
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>' },
  ];

  return `<aside class="sidebar">
    <div class="sidebar-logo">
      <a href="/business/dashboard" style="text-decoration:none">
        <svg width="98" viewBox="0 0 120 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="18" r="10" fill="#C4622D"/>
          <circle cx="19" cy="18" r="10" fill="#F5F0E8" fill-opacity="0.1" stroke="#F5F0E8" stroke-width="0.8"/>
          <text x="34" y="24" font-family="'Cormorant Garamond',Georgia,serif" font-size="22" font-weight="300" letter-spacing="-1" fill="#F5F0E8">yumlist</text>
        </svg>
      </a>
    </div>
    <div class="sidebar-restaurant">${account?.restaurant_name ?? '—'}</div>
    <div class="sidebar-status">
      <span class="badge ${badgeClass}">${badgeText}</span>
      <span class="badge badge-plan">${planLabel}</span>
    </div>
    <nav class="sidebar-nav">
      ${nav.map(n => `<a href="${n.href}" class="sidebar-link${activePage === n.href ? ' active' : ''}">${n.icon} ${n.label}</a>`).join('')}
    </nav>
    <div class="sidebar-footer">
      <button class="btn-signout" onclick="doSignOut()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Cerrar sesión
      </button>
    </div>
  </aside>`;
}

// ── Email notifications ───────────────────────────────────────────────────────

async function sendEmailNotification(to, subject, body) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-business-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? SUPABASE_KEY}` },
      body: JSON.stringify({ to, subject, body })
    });
    if (!res.ok) throw new Error('non-ok');
  } catch {
    // Edge function not yet deployed — continue, do not break flow
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// Average of array, rounded to 1 decimal
function avg(arr) {
  if (!arr.length) return '—';
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
}
