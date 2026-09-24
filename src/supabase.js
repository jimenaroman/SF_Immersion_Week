// Queried straight from the browser over PostgREST.
//
// These two values are public by design. The publishable key is meant to ship
// in client code; what actually protects the data is Row Level Security, set
// up in supabase/migrations/0001_init.sql — anon may SELECT the two tables and
// nothing else, so the worst a reader can do is read the sessions this site
// exists to show. SUPABASE_SECRET_KEY bypasses RLS and must never appear here.
const SUPABASE_URL = "https://qlfgurtidvrcqviiywbr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VJiQHAqmHgBdvetTuSPEsA_EWmhVfWO";

// The whole dataset is a few dozen rows, so it is fetched once and every
// filter, search and sort runs in memory. No network round trip per keystroke.
export async function fetchAllSessions() {
  const params = new URLSearchParams({
    select: "*",
    order: "day_index.asc,time.asc",
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions_public?${params}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}
