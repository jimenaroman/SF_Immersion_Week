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

  // Without a deadline a hung connection leaves the page on "Loading…"
  // indefinitely, which is worse than a visible error the reader can retry.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions_public?${params}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Supabase returned ${res.status}. ${(await res.text()).slice(0, 160)}`);
  }

  const rows = await res.json();
  // An empty result is what a removed RLS read policy looks like — Supabase
  // returns 200 with [] rather than an error, so it would otherwise render as
  // a normal "no sessions" state and hide a broken database.
  if (rows.length === 0) {
    throw new Error(
      "The database returned no sessions. The table may be empty, or the public read policy may be missing.",
    );
  }
  return rows;
}
