import { useEffect, useRef, useState } from "react";
import { GENDER_OPTIONS, walkInProfileSchema } from "../../shared/preconsult-schema.js";
import { api } from "../lib/api.js";
import { focusFirstError } from "../lib/focusError.js";
import { Alert, Chips, DateOfBirthInput, Field } from "./ui.jsx";
import { ArrowRight } from "./icons.jsx";

/** The order errors are walked in when jumping the guest to the first one. */
const FIELD_ORDER = ["fullName", "dateOfBirth", "gender", "email", "location"];

/**
 * The details that open a Zennara patient record: name, date of birth, gender,
 * centre, and an e-mail if they have one.
 *
 * This is the step that actually creates the account — the OTP before it only
 * proves the number. Everything here is either required by the `User` model or
 * needed to route the guest to the right centre, so the form is deliberately
 * short; the clinical questions come next.
 *
 * `onExpired(values, message)` fires when the 20-minute proof from the OTP has
 * run out (or the session has). A guest who types slowly used to hit
 * PHONE_VERIFICATION_REQUIRED here with no back button, no way to ask for a new
 * code, and only a "Start over" link that threw away everything they had typed.
 * Handing the values back up means the phone step can re-verify and drop them
 * straight back here with the form as they left it.
 */
export default function ProfileDetails({ phone, walkinToken, existing, draftValues, onSaved, onExpired }) {
  const [values, setValues] = useState(() => ({
    fullName: existing?.fullName || "",
    dateOfBirth: existing?.dateOfBirth ? String(existing.dateOfBirth).slice(0, 10) : "",
    gender: existing?.gender || "",
    email: existing?.email || "",
    location: existing?.location || "",
    ...(draftValues || {}),
  }));
  const [branches, setBranches] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const checkedLocation = useRef(false);

  useEffect(() => {
    let alive = true;
    api.branches()
      .then((list) => { if (alive) setBranches(list); })
      .catch(() => { if (alive) setBranches([]); });
    return () => { alive = false; };
  }, []);

  /*
   * Drop a centre name the branch list no longer knows.
   *
   * `location` is seeded from the existing record, which for a long-standing or
   * Zenoti-mirrored guest can hold a branch that has since been renamed or is
   * spelled differently. No chip lit up, but the value was non-empty so the
   * client-side "please choose the centre" check passed, the save went out, and
   * the server answered "That centre is not available" with nothing selected
   * and nothing highlighted. Clearing it lets the ordinary required-field error
   * fire locally, against the field it belongs to.
   */
  useEffect(() => {
    if (!branches || checkedLocation.current) return;
    checkedLocation.current = true;
    setValues((s) => (s.location && !branches.some((b) => b.name === s.location) ? { ...s, location: "" } : s));
  }, [branches]);

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
      setErrors(errs);
      requestAnimationFrame(() => focusFirstError(errs, FIELD_ORDER));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api.saveProfile(parsed.data, walkinToken);
      onSaved?.(data.user);
    } catch (e) {
      setBusy(false);
      // The proof or the session has run out — not something to fix on this screen.
      if (e.code === "PHONE_VERIFICATION_REQUIRED" || e.status === 401) {
        return onExpired?.(values, e.message);
      }
      setError(e.message);
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

      <Field label="Full name" required htmlFor="zp-fullName" error={errors.fullName}>
        <input
          id="zp-fullName"
          className={`zp-input${errors.fullName ? " zp-input--invalid" : ""}`}
          autoComplete="name"
          maxLength={100}
          aria-invalid={errors.fullName ? true : undefined}
          placeholder="As on your ID"
          value={values.fullName}
          onChange={(e) => set("fullName", e.target.value)}
        />
      </Field>
      <Field label="Date of birth" required htmlFor="zp-dateOfBirth" error={errors.dateOfBirth}>
        <DateOfBirthInput id="zp-dateOfBirth" value={values.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} invalid={Boolean(errors.dateOfBirth)} />
      </Field>

      <Field label="Gender" required error={errors.gender}>
        <Chips id="zp-gender" error={errors.gender} options={GENDER_OPTIONS} multi={false} value={values.gender} onChange={(v) => set("gender", v)} name="Gender" />
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
            aria-invalid={errors.email ? true : undefined}
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
            id="zp-location"
            error={errors.location}
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
