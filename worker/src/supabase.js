// Reads the sessions_public view over Supabase's PostgREST endpoint.
// No client library — PostgREST is a REST API and fetch is already in Workers.

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const ACTIVITIES = [
  "cafe_hangout", "class_workshop", "park_event", "food_tasting",
  "arts_craft", "community_meetup", "fitness_casual", "family_playtime",
];

const AUDIENCES = ["kids", "teens", "adults", "seniors", "all_ages"];

export const ENUMS = { days: DAYS, activities: ACTIVITIES, audiences: AUDIENCES };

// PostgREST reads in.(a,b) as a list, so an unescaped comma or quote inside a
// value would silently widen the filter. Quote every element and escape what
// could close the quote.
function inList(values) {
  const quoted = values.map(
    (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
  );
  return `in.(${quoted.join(",")})`;
}

function applyFilter(params, column, values, allowed) {
  const clean = allowed ? values.filter((v) => allowed.includes(v)) : values;
  if (clean.length === 0) return;
  params.set(column, clean.length === 1 ? `eq.${clean[0]}` : inList(clean));
}

// filters: { neighborhoods, days, activities, audiences, onlyAvailable }
export async function fetchSessions(env, filters = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL in wrangler.toml and " +
        "SUPABASE_ANON_KEY with: npx wrangler secret put SUPABASE_ANON_KEY",
    );
  }

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "day_index.asc,time.asc");

  applyFilter(params, "neighborhood", filters.neighborhoods ?? []);
  applyFilter(params, "day", filters.days ?? [], DAYS);
  applyFilter(params, "activity_label", filters.activities ?? [], ACTIVITIES);
  applyFilter(params, "audience_age", filters.audiences ?? [], AUDIENCES);
  if (filters.onlyAvailable) params.set("maxed_out", "is.false");

  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/sessions_public?${params}`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

// Filter options come from the data itself, so a new neighbourhood appears in
// the UI without a code change. Days and the two label sets are constrained by
// CHECK constraints in the schema, so they are listed in full rather than
// derived — otherwise an option vanishes as soon as nothing matches it.
export async function fetchMeta(env) {
  const sessions = await fetchSessions(env);
  return {
    neighborhoods: [...new Set(sessions.map((s) => s.neighborhood))].sort(),
    days: DAYS,
    activities: ACTIVITIES,
    audiences: AUDIENCES,
    total: sessions.length,
  };
}
