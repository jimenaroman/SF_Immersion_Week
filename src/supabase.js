// Queried straight from the browser over PostgREST.
//
// These two values are public by design. The publishable key is meant to ship
// in client code; what actually protects the data is Row Level Security, set
// up in supabase/migrations/0001_init.sql — anon may SELECT the two tables and
// nothing else, so the worst a reader can do is read the sessions this site
// exists to show. SUPABASE_SECRET_KEY bypasses RLS and must never appear here.
const SUPABASE_URL = "https://qlfgurtidvrcqviiywbr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VJiQHAqmHgBdvetTuSPEsA_EWmhVfWO";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const ACTIVITIES = [
  "cafe_hangout", "class_workshop", "park_event", "food_tasting",
  "arts_craft", "community_meetup", "fitness_casual", "family_playtime",
];

const AUDIENCES = ["kids", "teens", "adults", "seniors", "all_ages"];

export const ENUMS = { days: DAYS, activities: ACTIVITIES, audiences: AUDIENCES };

function applyFilter(params, column, value, allowed) {
  if (!value) return;
  if (allowed && !allowed.includes(value)) return;
  params.set(column, `eq.${value}`);
}

export async function fetchSessions(filters = {}) {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "day_index.asc,time.asc");

  applyFilter(params, "neighborhood", filters.neighborhood);
  applyFilter(params, "day", filters.day, DAYS);
  applyFilter(params, "activity_label", filters.activity, ACTIVITIES);
  applyFilter(params, "audience_age", filters.audience, AUDIENCES);
  if (filters.availableOnly) params.set("maxed_out", "is.false");

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

// Neighbourhoods come from the data so a new one appears without a code
// change. The other three are fixed by CHECK constraints in the schema, so
// they are listed in full rather than derived — otherwise an option would
// vanish as soon as nothing matched it.
export async function fetchMeta() {
  const sessions = await fetchSessions();
  return {
    neighborhoods: [...new Set(sessions.map((s) => s.neighborhood))].sort(),
    days: DAYS,
    activities: ACTIVITIES,
    audiences: AUDIENCES,
  };
}
