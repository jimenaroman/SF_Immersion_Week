import { useEffect, useState } from "react";
import { fetchMeta, fetchSessions } from "./supabase.js";
import "./App.css";

const FILTERS = [
  { key: "neighborhood", label: "Neighborhood", from: "neighborhoods" },
  { key: "day", label: "Day", from: "days" },
  { key: "activity", label: "Activity", from: "activities" },
  { key: "audience", label: "Audience", from: "audiences" },
];

const EMPTY = { neighborhood: "", day: "", activity: "", audience: "" };

function titleCase(value) {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function clockTime(value) {
  const [h, m] = value.split(":");
  const hour = Number(h);
  const suffix = hour < 12 ? "am" : "pm";
  return `${((hour + 11) % 12) + 1}:${m}${suffix}`;
}

export default function App() {
  const [meta, setMeta] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [filters, setFilters] = useState(EMPTY);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeta()
      .then(setMeta)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSessions({ ...filters, availableOnly })
      .then((rows) => {
        setSessions(rows);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, availableOnly]);

  const active = Object.values(filters).some(Boolean) || availableOnly;

  return (
    <div className="app">
      <header className="masthead">
        <h1>Things to do in San Francisco</h1>
        <p>Small-business sessions around the city — browse by neighborhood, day or vibe.</p>
      </header>

      <div className="filters">
        {FILTERS.map(({ key, label, from }) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label}</label>
            <select
              id={key}
              value={filters[key]}
              onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            >
              <option value="">All</option>
              {(meta?.[from] ?? []).map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          </div>
        ))}

        <label className="toggle">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          Spots left only
        </label>

        {active && (
          <button
            className="reset"
            onClick={() => {
              setFilters(EMPTY);
              setAvailableOnly(false);
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
        </div>
      ) : (
        <>
          <p className="count">
            {loading ? "Loading…" : `${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
          </p>

          {!loading && sessions.length === 0 ? (
            <div className="notice">No sessions match those filters. Try widening them.</div>
          ) : (
            <div className="grid">
              {sessions.map((s) => (
                <article className="card" key={s.id}>
                  <div className="card-top">
                    <div>
                      <h2>{s.business_name}</h2>
                      <div className="hood">{s.neighborhood}</div>
                    </div>
                    {s.maxed_out && <span className="badge">Full</span>}
                  </div>

                  <div className="when">
                    {s.day} · {clockTime(s.time)}
                  </div>

                  <div className="tags">
                    <span className="tag">{titleCase(s.activity_label)}</span>
                    <span className="tag plain">{titleCase(s.audience_age)}</span>
                  </div>

                  <div>
                    <div className="seats">
                      <span>
                        {s.people_attending} of {s.capacity} spots taken
                      </span>
                      <span>{s.maxed_out ? "Full" : `${s.capacity - s.people_attending} left`}</span>
                    </div>
                    <div className={`meter${s.maxed_out ? " full" : ""}`}>
                      <span style={{ width: `${(s.people_attending / s.capacity) * 100}%` }} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
