import { fetchSessions, fetchMeta } from "./supabase.js";

function multi(url, key) {
  return url.searchParams.getAll(key).flatMap((v) => v.split(",")).filter(Boolean);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/meta") {
        return Response.json(await fetchMeta(env));
      }

      if (url.pathname === "/api/sessions") {
        const sessions = await fetchSessions(env, {
          neighborhoods: multi(url, "neighborhood"),
          days: multi(url, "day"),
          activities: multi(url, "activity"),
          audiences: multi(url, "audience"),
          onlyAvailable: url.searchParams.get("available") === "true",
        });
        return Response.json({ count: sessions.length, sessions });
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
};
