import { Activity, AlertCircle, Check, CheckCircle, Clock, Info, XCircle } from "./icons.jsx";

export function Logo({ className = "zp-hero__logo" }) {
  return <img src="/zennara-logo.png" alt="Zennara – Skin · Aesthetic · Wellness" className={className} />;
}

/**
 * The brand is NOT a link. On the front-desk tablet a tap on the logo used to
 * throw a half-filled form away; leaving the flow is the explicit "Start over"
 * button in `right` and nothing else.
 */
export function TopBar({ right }) {
  return (
    <header className="zp-topbar">
      <span className="zp-topbar__brand">
        <img src="/zennara-logo.png" alt="Zennara" />
      </span>
      <div className="zp-topbar__meta">{right}</div>
    </header>
  );
}

export function Page({ children, right, wide, center }) {
  return (
    <div className="zp-page">
      <TopBar right={right} />
      <main className={`zp-main${wide ? " zp-main--wide" : ""}${center ? " zp-main--center" : ""}`}>{children}</main>
      <footer className="zp-footer">Zennara · Skin · Aesthetic · Wellness. Your details are shared only with your consulting doctor.</footer>
    </div>
  );
}

export function Field({ label, required, hint, error, htmlFor, children }) {
  return (
    <div className="zp-field">
      {label && (
        <label className="zp-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="zp-req">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <div className="zp-error"><AlertCircle size={14} />{error}</div>
      ) : hint ? (
        <div className="zp-hint">{hint}</div>
      ) : null}
    </div>
  );
}

/** Multi- or single-select pill group. `value` is an array (multi) or string (single). */
export function Chips({ options, value, onChange, multi = true, name }) {
  const isOn = (o) => (multi ? value.includes(o) : value === o);
  const toggle = (o) => {
    if (multi) onChange(isOn(o) ? value.filter((v) => v !== o) : [...value, o]);
    else onChange(isOn(o) ? "" : o);
  };
  return (
    <div className="zp-chips" role={multi ? "group" : "radiogroup"} aria-label={name}>
      {options.map((o) => (
        <button type="button" key={o} role={multi ? "checkbox" : "radio"} aria-checked={isOn(o)} className={`zp-chip${isOn(o) ? " zp-chip--on" : ""}`} onClick={() => toggle(o)}>
          {isOn(o) && <Check size={16} />}
          {o}
        </button>
      ))}
    </div>
  );
}

/** "Question – Yes / No – if yes, specify" row, matching the paper form. */
export function YesNoRow({ question, value, onChange, detail, onDetail, detailLabel = "If yes, please specify", error }) {
  return (
    <div className="zp-yesno">
      <div className="zp-yesno__q">{question}</div>
      <Chips options={["Yes", "No"]} multi={false} value={value === "yes" ? "Yes" : value === "no" ? "No" : ""} onChange={(v) => onChange(v === "Yes" ? "yes" : v === "No" ? "no" : "")} name={question} />
      {value === "yes" && onDetail && (
        <div className="zp-yesno__detail">
          <input className="zp-input" placeholder={detailLabel} value={detail} onChange={(e) => onDetail(e.target.value)} />
        </div>
      )}
      {error && <div className="zp-error zp-yesno__detail"><AlertCircle size={14} />{error}</div>}
    </div>
  );
}

export function Steps({ steps, current }) {
  return (
    <div>
      <div className="zp-steps__label">
        <span className="zp-eyebrow zp-mb0">Step {current + 1} of {steps.length}</span>
        <strong>{steps[current].title}</strong>
      </div>
      <div className="zp-steps" aria-hidden="true">
        {steps.map((s, i) => (
          <div key={s.key} className={`zp-steps__item${i < current ? " zp-steps__item--done" : i === current ? " zp-steps__item--active" : ""}`} />
        ))}
      </div>
    </div>
  );
}

const ALERT_ICON = { error: XCircle, info: Info, test: Clock, pending: Clock, success: CheckCircle };
export function Alert({ tone = "info", children }) {
  const Icon = ALERT_ICON[tone] || Info;
  return (
    <div className={`zp-alert zp-alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon />
      <div>{children}</div>
    </div>
  );
}

const STATUS = {
  submitted: { label: "Awaiting doctor", Icon: Clock },
  doctor_signed: { label: "Doctor signed", Icon: CheckCircle },
  in_treatment: { label: "In treatment", Icon: Activity },
  completed: { label: "Completed", Icon: Check },
  cancelled: { label: "Cancelled", Icon: XCircle },
};
/** Status is always icon + label, never colour alone. */
export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, Icon: Info };
  return (
    <span className={`zp-badge zp-badge--${status}`}>
      <s.Icon size={14} />
      {s.label}
    </span>
  );
}
