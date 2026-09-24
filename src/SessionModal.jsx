import { useEffect, useRef } from "react";
import { fillRatio, spotsLeft } from "./App.jsx";

export default function SessionModal({ session, label, clockTime, onClose }) {
  const panel = useRef(null);
  const left = spotsLeft(session);
  const pct = Math.round(fillRatio(session) * 100);

  useEffect(() => {
    const opener = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const focusable = panel.current?.querySelectorAll(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Without this the page behind keeps scrolling under the dialog.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${session.business_name}, ${session.location}`,
  )}`;

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={panel}
      >
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="art" data-activity={session.activity_label} />

        <div className="modal-body">
          <header className="modal-head">
            <div>
              <h2 id="modal-title">{session.business_name}</h2>
              <p className="hood">{session.neighborhood}</p>
            </div>
            <span className={`spots${session.maxed_out ? " none" : ""}`}>
              {session.maxed_out ? "Full" : `${left} left`}
            </span>
          </header>

          <dl className="facts">
            <div>
              <dt>When</dt>
              <dd>
                {session.day}s at {clockTime(session.time)}
              </dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{session.location}</dd>
            </div>
            <div>
              <dt>What</dt>
              <dd>{label(session.activity_label)}</dd>
            </div>
            <div>
              <dt>Who it&apos;s for</dt>
              <dd>{label(session.audience_age)}</dd>
            </div>
          </dl>

          <section className="capacity">
            <div className="seats">
              <span>
                {session.people_attending} of {session.capacity} spots taken
              </span>
              <span>{pct}%</span>
            </div>
            <div className={`meter${session.maxed_out ? " full" : ""}`}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="note">
              {session.maxed_out
                ? "This one's full. Try another day at the same venue."
                : `Room for ${left} more ${left === 1 ? "person" : "people"}.`}
            </p>
          </section>

          <div className="actions">
            <button className="primary" disabled={session.maxed_out}>
              {session.maxed_out ? "Fully booked" : "Reserve a spot"}
            </button>
            <a className="secondary" href={mapUrl} target="_blank" rel="noreferrer">
              Directions
            </a>
          </div>
          <p className="demo-note">
            Reserving is a demo — booking would hand off to the venue&apos;s own system.
          </p>
        </div>
      </div>
    </div>
  );
}
