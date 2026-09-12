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
        /*
         * role="alert" so the message is spoken the moment it appears. It used
         * to be a silent <div> far above a guest who was looking at Continue,
         * which on a screen reader meant Continue just did nothing at all.
         */
        <div className="zp-error" role="alert"><AlertCircle size={14} />{error}</div>
      ) : hint ? (
        <div className="zp-hint">{hint}</div>
      ) : null}
    </div>
  );
}

/**
 * Multi- or single-select pill group. `value` is an array (multi) or string (single).
 *
 * `id` + `tabIndex={-1}` exist so a failed validation can scroll to and focus
 * the group: a chip group has no single input to point at, and without a target
 * the guest was left staring at a Continue button that silently did nothing.
 */
export function Chips({ options, value, onChange, multi = true, name, id, error }) {
  const isOn = (o) => (multi ? value.includes(o) : value === o);
  const toggle = (o) => {
    if (multi) onChange(isOn(o) ? value.filter((v) => v !== o) : [...value, o]);
    else onChange(isOn(o) ? "" : o);
  };
  return (
    <div
      id={id}
      tabIndex={id ? -1 : undefined}
      className={`zp-chips${error ? " zp-chips--invalid" : ""}`}
      role={multi ? "group" : "radiogroup"}
      aria-label={name}
      aria-invalid={error ? true : undefined}
    >
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
export function YesNoRow({ question, value, onChange, detail, onDetail, detailLabel = "If yes, please specify", error, id, detailId, detailMaxLength }) {
  return (
    <div className="zp-yesno" id={id} tabIndex={id ? -1 : undefined}>
      <div className="zp-yesno__q">{question}</div>
      <Chips options={["Yes", "No"]} multi={false} value={value === "yes" ? "Yes" : value === "no" ? "No" : ""} onChange={(v) => onChange(v === "Yes" ? "yes" : v === "No" ? "no" : "")} name={question} />
      {value === "yes" && onDetail && (
        <div className="zp-yesno__detail">
          <input id={detailId} className="zp-input" placeholder={detailLabel} maxLength={detailMaxLength} value={detail} onChange={(e) => onDetail(e.target.value)} />
        </div>
      )}
      {error && <div className="zp-error zp-yesno__detail" role="alert"><AlertCircle size={14} />{error}</div>}
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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const OLDEST_YEARS = 120;
const daysInMonth = (year, month) => {
  if (!month) return 31;
  const y = Number(year) || 2000; // a leap year guess only matters for February
  return new Date(y, Number(month), 0).getDate();
};

/**
 * Date of birth as three selects, not a native date picker.
 *
 * `<input type="date">` opens on the CURRENT month, so a guest born in 1954 had
 * to page back eight hundred and forty screens to reach their birthday — on a
 * touch screen, at a front desk, with staff waiting. Day / month / year selects
 * reach any date in three taps and read the same on every tablet we might be
 * handed. Emits and accepts the same ISO `YYYY-MM-DD` string the schema wants,
 * and an incomplete date deliberately emits "" so the required-field error is
 * the one the guest sees.
 */
export function DateOfBirthInput({ id, value, onChange, invalid }) {
  const [y = "", m = "", d = ""] = String(value || "").slice(0, 10).split("-");
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: OLDEST_YEARS + 1 }, (_, i) => String(thisYear - i));
  const days = Array.from({ length: daysInMonth(y, m) }, (_, i) => String(i + 1).padStart(2, "0"));

  const emit = (nextD, nextM, nextY) => {
    if (!nextD || !nextM || !nextY) return onChange("");
    // 31 January → February must not silently become 3 March.
    const clamped = String(Math.min(Number(nextD), daysInMonth(nextY, nextM))).padStart(2, "0");
    onChange(`${nextY}-${nextM}-${clamped}`);
  };
  const cls = `zp-select${invalid ? " zp-input--invalid" : ""}`;

  return (
    <div className="zp-dob">
      <select id={id} className={cls} value={d} aria-label="Day of birth" onChange={(e) => emit(e.target.value, m, y)}>
        <option value="">Day</option>
        {days.map((n) => <option key={n} value={n}>{Number(n)}</option>)}
      </select>
      <select className={cls} value={m} aria-label="Month of birth" onChange={(e) => emit(d, e.target.value, y)}>
        <option value="">Month</option>
        {MONTHS.map((name, i) => <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>)}
      </select>
      <select className={cls} value={y} aria-label="Year of birth" onChange={(e) => emit(d, m, e.target.value)}>
        <option value="">Year</option>
        {years.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}
