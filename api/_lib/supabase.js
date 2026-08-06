// Same Supabase project + anon key already embedded (publicly) in every page
// of this site — reusing it server-side adds no new exposure.
const SUPABASE_URL = 'https://klkksarpfcohfqirxwoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtsa2tzYXJwZmNvaGZxaXJ4d29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDMwMTUsImV4cCI6MjA4OTYxOTAxNX0.ep8NgjugAIAW07qRdlM4A2ScHEHteDBaRQMOmGKPTtE';

// Verifies a Supabase access token by asking Supabase Auth who it belongs to.
// Returns the verified user (including its confirmed email) or null if the
// token is missing, expired, or invalid. This is what stands in for auth on
// endpoints that must only act on behalf of a real, logged-in user.
async function getVerifiedUser(accessToken) {
  if (!accessToken) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (!res.ok) return null;
  return res.json();
}

// Checks admin_users membership for a verified user, using that user's own
// access token — the exact same REST call business-auth.js's requireAdmin()
// already makes from the browser, just replicated server-side. Relies on
// admin_users' existing RLS (self-check), not a new trust mechanism.
async function isAdmin(userId, accessToken) {
  if (!userId || !accessToken) return false;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
    }
  );

  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = { getVerifiedUser, isAdmin, SUPABASE_URL, SUPABASE_ANON_KEY };
