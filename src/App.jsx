import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAllSessions } from "./supabase.js";
import SessionArt from "./SessionArt.jsx";
import SessionModal from "./SessionModal.jsx";
import "./App.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EMPTY = { neighborhood: "", day: "", activity: "", audience: "" };
const THEMES = ["auto", "light", "dark"];

function label(value) {
  const spaced = String(value).replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function clockTime(value) {
  const [h, m] = String(value ?? "").split(":");
  const hour = Number(h);
  if (!Number.isFinite(hour) || m === undefined) return "—";
  const h24 = hour % 24;
  return `${h24 % 12 === 0 ? 12 : h24 % 12}:${m.padStart(2, "0")}${h24 < 12 ? "am" : "pm"}`;
}

// A session can be over-booked: the schema caps neither attendance at capacity
// nor the ratio, so both are clamped before they reach a width or a count.
// Math.max does not rescue NaN, so non-numeric input has to be coerced
// before it reaches a clamp, a width or a headline total.
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function fillRatio(s) {
  const cap = num(s.capacity);
  if (cap <= 0) return 0;
  return Math.min(1, Math.max(0, num(s.people_attending) / cap));
}

export function spotsLeft(s) {
  return Math.max(0, num(s.capacity) - num(s.people_attending));
}

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "auto");
  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return [theme, setTheme];
}

export default function App() {
  const [all, setAll] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("discover");
  const [filters, setFilters] = useState(EMPTY);
  const [query, setQuery] = useState("");
  const [openSuggest, setOpenSuggest] = useState(false);
  const [sort, setSort] = useState("spots");
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(null);
  const searchBox = useRef(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAllSessions()
      .then(setAll)
      .catch((e) =>
        setError(
          e.name === "TimeoutError"
            ? "Supabase did not respond within 10 seconds."
            : e.message,
        ),
      )
      .finally(() => setLoading(false));
  }, [attempt]);

  useEffect(() => {
    const close = (e) => {
      if (searchBox.current && !searchBox.current.contains(e.target)) setOpenSuggest(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const options = useMemo(() => {
    const uniq = (fn) => [...new Set(all.map(fn).filter(Boolean))].sort();
    return {
      neighborhood: uniq((s) => s.neighborhood),
      day: DAYS.filter((d) => all.some((s) => s.day === d)),
      activity: uniq((s) => s.activity_label),
      audience: uniq((s) => s.audience_age),
    };
  }, [all]);

  // Suggestions come from the loaded rows, so typing never hits the network.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const pool = [
      ...options.neighborhood.map((v) => ({ kind: "Neighborhood", value: v })),
      ...options.activity.map((v) => ({ kind: "Activity", value: v })),
      ...[...new Set(all.map((s) => s.business_name).filter(Boolean))].map((v) => ({
        kind: "Venue",
        value: v,
      })),
    ];
    return pool.filter((o) => String(o.value).toLowerCase().replace(/_/g, " ").includes(q)).slice(0, 6);
  }, [query, options, all]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = all.filter((s) => {
      if (filters.neighborhood && s.neighborhood !== filters.neighborhood) return false;
      if (filters.day && s.day !== filters.day) return false;
      if (filters.activity && s.activity_label !== filters.activity) return false;
      if (filters.audience && s.audience_age !== filters.audience) return false;
      if (q) {
        const hay = [s.business_name, s.neighborhood, s.activity_label, s.audience_age, s.day]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .replace(/_/g, " ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (tab === "open") rows = rows.filter((s) => fillRatio(s) < 0.7);

    const open = (s) => s.capacity - s.people_attending;
    if (sort === "spots") rows = [...rows].sort((a, b) => open(b) - open(a));
    else rows = [...rows].sort((a, b) => (a.day_index ?? 99) - (b.day_index ?? 99) || String(a.time ?? "").localeCompare(String(b.time ?? "")));
    return rows;
  }, [all, filters, query, sort, tab]);

  const stats = useMemo(() => {
    const seats = all.reduce((n, s) => n + Math.max(0, num(s.capacity)), 0);
    const taken = all.reduce((n, s) => n + Math.max(0, Math.min(num(s.people_attending), num(s.capacity))), 0);
    return {
      open: Math.max(0, seats - taken),
      sessions: all.length,
      venues: new Set(all.map((s) => s.business_name)).size,
    };
  }, [all]);

  const active = Object.values(filters).some(Boolean) || query || sort !== "spots" || tab !== "discover";

  function pickSuggestion(s) {
    if (s.kind === "Neighborhood") setFilters({ ...filters, neighborhood: s.value });
    else if (s.kind === "Activity") setFilters({ ...filters, activity: s.value });
    else setQuery(s.value);
    if (s.kind !== "Venue") setQuery("");
    setOpenSuggest(false);
  }

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1>Things to do in San Francisco</h1>
          <p>Sessions at small businesses around the city.</p>
        </div>
        <div className="themer" role="group" aria-label="Colour theme">
          {THEMES.map((t) => (
            <button
              key={t}
              className={theme === t ? "on" : ""}
              onClick={() => setTheme(t)}
              aria-pressed={theme === t}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {!error && !loading && (
        <div className="stats">
          <div className="stat">
            <strong>{stats.open}</strong>
            <span>seats open this week</span>
          </div>
          <div className="stat">
            <strong>{stats.sessions}</strong>
            <span>sessions</span>
          </div>
          <div className="stat">
            <strong>{stats.venues}</strong>
            <span>local venues</span>
          </div>
        </div>
      )}

      <nav className="tabs">
        <button className={tab === "discover" ? "on" : ""} onClick={() => setTab("discover")}>
          Discover
        </button>
        <button className={tab === "open" ? "on" : ""} onClick={() => setTab("open")}>
          Spots open
        </button>
      </nav>

      {tab === "open" && (
        <p className="blurb">
          Sessions running under 70% full — the ones most likely to want you there.
        </p>
      )}

      <div className="filters">
        <div className="field grow" ref={searchBox}>
          <label htmlFor="q">Search</label>
          <input
            id="q"
            type="text"
            autoComplete="off"
            placeholder="Venue, neighborhood or activity…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenSuggest(true);
            }}
            onFocus={() => setOpenSuggest(true)}
          />
          {openSuggest && suggestions.length > 0 && (
            <ul className="suggest">
              {suggestions.map((s) => (
                <li key={s.kind + s.value}>
                  <button onClick={() => pickSuggestion(s)}>
                    <span>{label(s.value)}</span>
                    <em>{s.kind}</em>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {["neighborhood", "day", "activity", "audience"].map((key) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label(key)}</label>
            <select
              id={key}
              value={filters[key]}
              onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            >
              <option value="">All</option>
              {options[key].map((o) => (
                <option key={o} value={o}>
                  {label(o)}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="field">
          <label htmlFor="sort">Sort</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="spots">Most spots left</option>
            <option value="day">Day &amp; time</option>
          </select>
        </div>

        {active && (
          <button
            className="reset"
            onClick={() => {
              setFilters(EMPTY);
              setQuery("");
              setSort("spots");
              setTab("discover");
            }}
          >
            Clear
          </button>
        )}
      </div>

      {error ? (
        <div className="notice bad">
          <strong>Couldn&apos;t load sessions.</strong>
          <p>{error}</p>
          <button className="reset" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <p className="count">
            {loading ? "Loading…" : `${shown.length} session${shown.length === 1 ? "" : "s"}`}
          </p>

          {!loading && shown.length === 0 ? (
            <div className="notice">Nothing matches that. Try clearing a filter.</div>
          ) : (
            <div className="grid">
              {shown.map((s, i) => {
                const left = spotsLeft(s);
                return (
                  <article
                    className="card"
                    key={s.id ?? `${s.business_name}-${s.day}-${s.time}-${i}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${s.business_name}, ${s.day} ${clockTime(s.time)}`}
                    onClick={() => setOpen(s)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpen(s);
                      }
                    }}
                  >
                    <SessionArt activity={s.activity_label} seed={i} />
                    <div className="card-top">
                      <div>
                        <h2>{s.business_name}</h2>
                        <div className="hood">{s.neighborhood}</div>
                      </div>
                      <span className={`spots${s.maxed_out ? " none" : ""}`}>
                        {s.maxed_out ? "Full" : `${left} left`}
                      </span>
                    </div>

                    <div className="when">
                      {s.day} · {clockTime(s.time)}
                    </div>

                    <div className="tags">
                      <span className="tag">{label(s.activity_label)}</span>
                      <span className="tag plain">{label(s.audience_age)}</span>
                    </div>

                    <div>
                      <div className="seats">
                        <span>
                          {s.people_attending} of {s.capacity} spots taken
                        </span>
                      </div>
                      <div className={`meter${s.maxed_out ? " full" : ""}`}>
                        <span style={{ width: `${fillRatio(s) * 100}%` }} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {open && (
        <SessionModal
          session={open}
          index={shown.findIndex((s) => s.id === open.id)}
          label={label}
          clockTime={clockTime}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
