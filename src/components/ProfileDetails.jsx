import { useEffect, useState } from "react";
import { GENDER_OPTIONS, todayISO, walkInProfileSchema } from "../../shared/preconsult-schema.js";
import { api } from "../lib/api.js";
import { Alert, Chips, Field } from "./ui.jsx";
import { ArrowRight } from "./icons.jsx";

/**
 * The details that open a Zennara patient record: name, date of birth, gender,
 * centre, and an e-mail if they have one.
 *
 * This is the step that actually creates the account — the OTP before it only
 * proves the number. Everything here is either required by the `User` model or
 * needed to route the guest to the right centre, so the form is deliberately
 * short; the clinical questions come next.
 */
export default function ProfileDetails({ phone, walkinToken, existing, onSaved }) {
  const [values, setValues] = useState(() => ({
    fullName: existing?.fullName || "",
    dateOfBirth: existing?.dateOfBirth ? String(existing.dateOfBirth).slice(0, 10) : "",
    gender: existing?.gender || "",
    email: existing?.email || "",
    location: existing?.location || "",
  }));
  const [branches, setBranches] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.branches()
      .then((list) => { if (alive) setBranches(list); })
      .catch(() => { if (alive) setBranches([]); });
    return () => { alive = false; };
  }, []);

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  async function save() {
    const parsed = walkInProfileSchema.safeParse(values);
    if (!parsed.success) {
      const errs = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        if (!errs[k]) errs[k] = issue.message;
      }
      return setErrors(errs);
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api.saveProfile(parsed.data, walkinToken);
      onSaved?.(data.user);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="zp-card">
      <p className="zp-eyebrow">Step 2 of 3</p>
      <h2 className="zp-h2">{existing ? "Confirm your details" : "Your details"}</h2>
      <p className="zp-small zp-muted" style={{ marginTop: 0 }}>
        {existing
          ? "We already have you on file. Check these are still right before the form."
          : "This opens your Zennara guest record. Fields marked * are required."}
      </p>

      <div className="zp-grid">
        <Field label="Full name" required htmlFor="zp-fullName" error={errors.fullName}>
          <input
            id="zp-fullName"
            className={`zp-input${errors.fullName ? " zp-input--invalid" : ""}`}
            autoComplete="name"
            placeholder="As on your ID"
            value={values.fullName}
            onChange={(e) => set("fullName", e.target.value)}
          />
        </Field>
        <Field label="Date of birth" required htmlFor="zp-dateOfBirth" error={errors.dateOfBirth}>
          <input
            id="zp-dateOfBirth"
            className={`zp-input${errors.dateOfBirth ? " zp-input--invalid" : ""}`}
            type="date"
            max={todayISO()}
            value={values.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Gender" required error={errors.gender}>
        <Chips options={GENDER_OPTIONS} multi={false} value={values.gender} onChange={(v) => set("gender", v)} name="Gender" />
      </Field>

      <div className="zp-grid">
        <Field label="WhatsApp number" htmlFor="zp-verified-phone" hint="Verified just now.">
          <input id="zp-verified-phone" className="zp-input" value={`+91 ${String(phone || "").slice(0, 5)} ${String(phone || "").slice(5)}`} readOnly />
        </Field>
        <Field label="E-mail" htmlFor="zp-email" error={errors.email} hint="Optional — leave blank if you'd rather not.">
          <input
            id="zp-email"
            className={`zp-input${errors.email ? " zp-input--invalid" : ""}`}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Which centre are you at?" required error={errors.location}>
        {branches === null ? (
          <p className="zp-muted zp-small" style={{ margin: 0 }}>Loading centres…</p>
        ) : branches.length === 0 ? (
          <Alert tone="error">Could not load the centre list. Please ask the front desk.</Alert>
        ) : (
          <Chips
            options={branches.map((b) => b.name)}
            multi={false}
            value={values.location}
            onChange={(v) => set("location", v)}
            name="Centre"
          />
        )}
      </Field>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="zp-actions">
        <span />
        <button type="button" className="zp-btn zp-btn--primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Continue to the form"} {!busy && <ArrowRight />}
        </button>
      </div>
    </div>
  );
}
