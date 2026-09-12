import { useEffect, useRef, useState } from "react";
import {
  CONCERN_OPTIONS,
  GENDER_OPTIONS,
  MEDICAL_OPTIONS,
  PREGNANCY_OPTIONS,
  REASON_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
  emptyPreConsult,
  formatDate,
  formatPhone,
  preConsultSchema,
  todayISO,
} from "../../shared/preconsult-schema.js";
import { api, draft } from "../lib/api.js";
import { focusFirstError } from "../lib/focusError.js";
import PreConsultSheet from "./PreConsultSheet.jsx";
import SignaturePad from "./SignaturePad.jsx";
import { Alert, Chips, DateOfBirthInput, Field, Steps, YesNoRow } from "./ui.jsx";
import { ArrowRight } from "./icons.jsx";

const STEPS = [
  { key: "personal", title: "About you" },
  { key: "reason", title: "Reason for visit" },
  { key: "complaint", title: "Your concern" },
  { key: "medical", title: "Medical history" },
  { key: "routine", title: "Daily routine" },
  { key: "recent", title: "Recent activity" },
  { key: "sign", title: "Review & sign" },
];

const STEP_FIELDS = [
  ["dateOfVisit", "name", "dob", "gender", "email", "maritalStatus", "children", "planningPregnancy", "lmp", "source", "sourceOther", "referredBy"],
  ["reasons", "concerns", "concernsOther"],
  ["symptomDuration", "previousTreatments", "currentMedications", "pregnancyStatus", "patientNotes"],
  ["medical", "menstrualHistory", "drugAllergies", "drugAllergiesDetail", "otherAllergies"],
  ["cleanser", "moisturiser", "sunscreen", "otherProducts", "diet", "waterIntake"],
  ["newProducts", "newProductsDetail", "salonVisit", "salonVisitDetail", "pastTreatments", "pastTreatmentsDetail"],
  ["consent", "signature"],
];

/**
 * Caps that mirror the schema's `max()`, so an over-long answer is stopped by
 * the keyboard rather than by a Continue button that refuses to do anything.
 *
 * The one that bit daily was `waterIntake`: zod allows 10 characters, the input
 * was unbounded, and a guest who wrote "2 to 3 litres" was stuck on the routine
 * step for ever — the field had no error slot either, so nothing was shown
 * anywhere on the screen.
 */
const MAX = {
  name: 100,
  children: 3,
  sourceOther: 500,
  referredBy: 500,
  concernsOther: 500,
  drugAllergiesDetail: 500,
  otherAllergies: 500,
  cleanser: 500,
  moisturiser: 500,
  sunscreen: 500,
  otherProducts: 500,
  waterIntake: 10,
  newProductsDetail: 500,
  salonVisitDetail: 500,
  pastTreatmentsDetail: 500,
  symptomDuration: 200,
  previousTreatments: 2000,
  currentMedications: 2000,
  patientNotes: 2000,
};

/** How long to sit on a keystroke before writing the draft to sessionStorage. */
const DRAFT_DEBOUNCE_MS = 600;

function validateStep(i, values) {
  const pick = Object.fromEntries(STEP_FIELDS[i].map((k) => [k, true]));
  const r = preConsultSchema.pick(pick).safeParse(values);
  if (r.success) return {};
  const errs = {};
  for (const issue of r.error.issues) {
    const k = String(issue.path[0]);
    if (!errs[k]) errs[k] = issue.message;
  }
  return errs;
}

/**
 * Repair a prefill whose "How did you hear about us" answer is free text.
 *
 * The backend collapses `source: 'Other'` plus the typed words into one
 * `referralSource` column, so a guest who said "TV ad" last time comes back
 * with `source: "TV ad"` — which is not in SOURCE_OPTIONS, so the zod enum
 * rejects it, step one never validates, and no chip is even lit to show why.
 * Before the fix that guest could not get past the first screen, ever, on any
 * visit. The translator is shared with the app and cannot be changed from here,
 * so unpack it on the way in: the text goes back into "Other".
 */
function unpackSource(values) {
  const source = String(values?.source || "").trim();
  if (!source || SOURCE_OPTIONS.includes(source)) return values;
  return { ...values, source: "Other", sourceOther: String(values.sourceOther || "").trim() || source };
}

/** Stable per-form key so a retry cannot file the same form twice. */
function newSubmissionId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* falls through */ }
  return `wk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * The pre-consult form, step by step. Props:
 *  - guest:       the patient record from the walk-in session
 *                 ({ patientId, phone, fullName, gender, dateOfBirth, email })
 *  - initial:     last visit's answers to prefill (optional)
 *  - onSubmitted: ({ id, clientId, guestCode }) => void
 *  - onExpired:   (message) => void — the session died mid-form
 *  - submit:      override how the form is sent (defaults to the walk-in API)
 */
export default function PreConsultForm({ guest, initial, onSubmitted, onExpired, submit = api.submitPreConsult }) {
  /*
   * A draft of this session's own answers, if there is one.
   *
   * Seven steps used to vanish without trace on a reload or a back-swipe, and
   * there was no persistence of any kind to fall back on. The draft is keyed to
   * the session that owns it and lives in sessionStorage beside it, so it dies
   * with the session, with "Start over" and with the tab — a new guest can
   * never be shown the last one's answers.
   */
  const [restored] = useState(() => draft.load());
  const [values, setValues] = useState(() => {
    const base = {
      ...emptyPreConsult(),
      ...unpackSource(initial || {}),
      // The account is the more recent truth for these three: the desk just
      // confirmed them on the previous screen.
      name: guest?.fullName || initial?.name || "",
      gender: guest?.gender || initial?.gender || "",
      dob: guest?.dateOfBirth ? String(guest.dateOfBirth).slice(0, 10) : (initial?.dob || ""),
      email: guest?.email || initial?.email || "",
      dateOfVisit: todayISO(),
      // Never carried over from a previous visit — both have to be given again.
      consent: false,
      signature: "",
    };
    // A draft IS this visit's answers, so its consent and signature stand.
    return restored?.values ? { ...base, ...restored.values } : base;
  });
  const [step, setStep] = useState(() => {
    const s = Number(restored?.step);
    return Number.isInteger(s) && s >= 0 && s < STEPS.length ? s : 0;
  });
  /*
   * One id for the life of this form, carried on every attempt including
   * retries. If the POST lands but the reply is lost on clinic wifi the guest
   * sees "Could not reach Zennara" and taps Submit again — which used to file a
   * second form and a second Zenoti note against the same visit. It survives a
   * reload in the draft, because that is exactly when a guest resubmits.
   */
  const [submissionId] = useState(() => restored?.submissionId || newSubmissionId());
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  /* Debounced, so typing does not write a 400KB signature on every keystroke. */
  const filed = useRef(false);
  useEffect(() => {
    if (filed.current) return undefined;
    const t = setTimeout(() => draft.save({ values, step, submissionId }), DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [values, step, submissionId]);

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => {
      if (!e[k]) return e;
      const n = { ...e };
      delete n[k];
      return n;
    });
  };
  const inp = (k, props = {}) => (
    <input id={`zp-${k}`} className={`zp-input${errors[k] ? " zp-input--invalid" : ""}`} value={values[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={errors[k] ? true : undefined} {...(MAX[k] ? { maxLength: MAX[k] } : {})} {...props} />
  );
  const area = (k, props = {}) => (
    <textarea id={`zp-${k}`} className={`zp-textarea${errors[k] ? " zp-input--invalid" : ""}`} value={values[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={errors[k] ? true : undefined} {...(MAX[k] ? { maxLength: MAX[k] } : {})} {...props} />
  );

  const showFemaleFields = values.gender !== "Male";
  const goTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  /**
   * Show the errors AND take the guest to the first one. rAF so the scroll
   * happens against the committed DOM — which matters when the errors came
   * back from the server for a step we have just jumped back to.
   */
  const showErrors = (errs, order) => {
    setErrors(errs);
    requestAnimationFrame(() => focusFirstError(errs, order));
  };

  function next() {
    const errs = validateStep(step, values);
    if (Object.keys(errs).length) return showErrors(errs, STEP_FIELDS[step]);
    setStep((s) => s + 1);
    goTop();
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
    goTop();
  }
  async function handleSubmit() {
    const errs = validateStep(step, values);
    if (Object.keys(errs).length) return showErrors(errs, STEP_FIELDS[step]);
    setBusy(true);
    setError(null);
    try {
      const data = await submit({ ...values, submissionId });
      // Filed. Drop the draft and stop the debounce from writing it back in the
      // tick between here and this component unmounting.
      filed.current = true;
      draft.clear();
      onSubmitted?.(data);
    } catch (e) {
      /*
       * A session that died mid-form is not a form problem. Hand it back to the
       * check-in screen, which returns the guest to the phone step with their
       * number filled in, rather than leaving them on a Submit button that can
       * never succeed.
       */
      if (e.status === 401) {
        setBusy(false);
        return onExpired?.(e.message);
      }
      if (e.fieldErrors) {
        const first = STEP_FIELDS.findIndex((fs) => fs.some((f) => e.fieldErrors[f]));
        if (first >= 0) setStep(first);
        showErrors(e.fieldErrors, STEP_FIELDS[first >= 0 ? first : step]);
      }
      setError(e.message);
      setBusy(false);
    }
  }

  const preview = {
    guestCode: guest?.guestCode,
    clientId: guest?.patientId,
    name: values.name,
    phone: guest?.phone,
    email: values.email,
    dateOfVisit: values.dateOfVisit,
    data: values,
    clientSignature: values.signature || null,
  };

  return (
    <div className="zp-card">
      <Steps steps={STEPS} current={step} />

      {step === 0 && (
        <>
          <h2 className="zp-h2">Tell us about you</h2>
          <p className="zp-small zp-muted" style={{ marginTop: 0 }}>Fields marked * are required.</p>
          <div className="zp-grid">
            <Field label="Date of visit" required htmlFor="zp-dateOfVisit" error={errors.dateOfVisit}>
              {inp("dateOfVisit", { type: "date", min: todayISO() })}
            </Field>
            <Field label="Full name" required htmlFor="zp-name" error={errors.name}>
              {inp("name", { autoComplete: "name", placeholder: "As on your ID" })}
            </Field>
          </div>
          <Field label="Date of birth" required htmlFor="zp-dob" error={errors.dob}>
            <DateOfBirthInput id="zp-dob" value={values.dob} onChange={(v) => set("dob", v)} invalid={Boolean(errors.dob)} />
          </Field>
          <div className="zp-grid">
            <Field label="Gender" required error={errors.gender}>
              <Chips id="zp-gender" error={errors.gender} options={GENDER_OPTIONS} multi={false} value={values.gender} onChange={(v) => set("gender", v)} name="Gender" />
            </Field>
            <Field label="Phone number" htmlFor="zp-guest-phone" hint="Verified on WhatsApp">
              <input id="zp-guest-phone" className="zp-input" value={formatPhone(guest?.phone ? `+91${guest.phone}` : "")} readOnly />
            </Field>
          </div>
          <div className="zp-grid">
            <Field label="E-mail" htmlFor="zp-email" error={errors.email}>
              {inp("email", { type: "email", autoComplete: "email", placeholder: "you@example.com" })}
            </Field>
          </div>

          <h3 className="zp-h3">Family</h3>
          <div className={`zp-grid${showFemaleFields ? " zp-grid--3" : ""}`}>
            <Field label="Status" htmlFor="zp-maritalStatus" error={errors.maritalStatus}>
              <select id="zp-maritalStatus" className={`zp-select${errors.maritalStatus ? " zp-input--invalid" : ""}`} value={values.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)}>
                <option value="">Select</option>
                {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="No. of children" htmlFor="zp-children" error={errors.children}>
              {inp("children", { inputMode: "numeric", placeholder: "0" })}
            </Field>
            {showFemaleFields && (
              <Field label="Planning for pregnancy?" error={errors.planningPregnancy}>
                <Chips id="zp-planningPregnancy" error={errors.planningPregnancy} options={["Yes", "No"]} multi={false} value={values.planningPregnancy === "yes" ? "Yes" : values.planningPregnancy === "no" ? "No" : ""} onChange={(v) => set("planningPregnancy", v === "Yes" ? "yes" : v === "No" ? "no" : "")} name="Planning for pregnancy" />
              </Field>
            )}
          </div>
          {showFemaleFields && (
            <div className="zp-grid">
              <Field label="LMP (last menstrual period)" htmlFor="zp-lmp" error={errors.lmp} hint="Leave blank if not applicable.">
                {inp("lmp", { type: "date", max: todayISO() })}
              </Field>
            </div>
          )}

          <h3 className="zp-h3">How did you hear about Zennara?</h3>
          <Field error={errors.source}>
            <Chips id="zp-source" error={errors.source} options={SOURCE_OPTIONS} multi={false} value={values.source} onChange={(v) => set("source", v)} name="Source" />
          </Field>
          <div className="zp-grid">
            {values.source === "Other" && (
              <Field label="Please specify" htmlFor="zp-sourceOther" error={errors.sourceOther}>{inp("sourceOther")}</Field>
            )}
            <Field label="Referred by" htmlFor="zp-referredBy" error={errors.referredBy} hint="Name of the person or doctor who referred you, if any.">
              {inp("referredBy")}
            </Field>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="zp-h2">Reason for your visit</h2>
          <Field label="I'm here for" required error={errors.reasons} hint="Choose all that apply.">
            <Chips id="zp-reasons" error={errors.reasons} options={REASON_OPTIONS} value={values.reasons} onChange={(v) => set("reasons", v)} name="Reason for visit" />
          </Field>
          <Field label="My concerns" error={errors.concerns} hint="Choose all that apply.">
            <Chips id="zp-concerns" error={errors.concerns} options={CONCERN_OPTIONS} value={values.concerns} onChange={(v) => set("concerns", v)} name="Concerns" />
          </Field>
          <Field label="Others – please specify" htmlFor="zp-concernsOther" error={errors.concernsOther}>
            {area("concernsOther", { placeholder: "Anything else you'd like the doctor to look at" })}
          </Field>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="zp-h2">Tell us about your concern</h2>
          <p className="zp-small zp-muted" style={{ marginTop: 0 }}>
            In your own words. Your doctor reads this before you sit down, so the consultation starts where you are.
          </p>
          <Field label="How long has this been going on?" htmlFor="zp-symptomDuration" error={errors.symptomDuration}>
            {inp("symptomDuration", { placeholder: "e.g. about 6 months, worse since summer" })}
          </Field>
          <Field label="What have you already tried?" htmlFor="zp-previousTreatments" error={errors.previousTreatments} hint="Creams, tablets, treatments elsewhere — and whether they helped.">
            {area("previousTreatments", { placeholder: "e.g. a clindamycin gel for 3 months, helped a little" })}
          </Field>
          <Field label="What are you taking right now?" htmlFor="zp-currentMedications" error={errors.currentMedications} hint="All medicines and supplements, not only for skin or hair.">
            {area("currentMedications", { placeholder: "e.g. thyroxine 50mcg daily, vitamin D weekly" })}
          </Field>
          {showFemaleFields && (
            <Field label="Are you pregnant or breastfeeding?" error={errors.pregnancyStatus} hint="Several treatments cannot be given during pregnancy, so your doctor needs to know.">
              <Chips
                id="zp-pregnancyStatus"
                error={errors.pregnancyStatus}
                options={PREGNANCY_OPTIONS.map((o) => o.label)}
                multi={false}
                value={PREGNANCY_OPTIONS.find((o) => o.value === values.pregnancyStatus)?.label || ""}
                onChange={(label) => set("pregnancyStatus", PREGNANCY_OPTIONS.find((o) => o.label === label)?.value || "not_applicable")}
                name="Pregnancy status"
              />
            </Field>
          )}
          <Field label="Anything else your doctor should know?" htmlFor="zp-patientNotes" error={errors.patientNotes}>
            {area("patientNotes", { placeholder: "Optional" })}
          </Field>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="zp-h2">Medical history</h2>
          <Field label="Do you have any of these?" error={errors.medical} hint="Leave blank if none.">
            <Chips id="zp-medical" error={errors.medical} options={MEDICAL_OPTIONS} value={values.medical} onChange={(v) => set("medical", v)} name="Medical history" />
          </Field>
          {showFemaleFields && (
            <Field label="Menstrual history" error={errors.menstrualHistory}>
              <Chips id="zp-menstrualHistory" error={errors.menstrualHistory} options={["Regular", "Irregular"]} multi={false} value={values.menstrualHistory === "regular" ? "Regular" : values.menstrualHistory === "irregular" ? "Irregular" : ""} onChange={(v) => set("menstrualHistory", v.toLowerCase())} name="Menstrual history" />
            </Field>
          )}
          <Field label="Any drug allergies?" required error={errors.drugAllergies}>
            <Chips id="zp-drugAllergies" error={errors.drugAllergies} options={["Yes", "No"]} multi={false} value={values.drugAllergies ? "Yes" : "No"} onChange={(v) => set("drugAllergies", v === "Yes")} name="Drug allergies" />
          </Field>
          {values.drugAllergies && (
            <Field label="Which drugs?" htmlFor="zp-drugAllergiesDetail" error={errors.drugAllergiesDetail}>{inp("drugAllergiesDetail", { placeholder: "e.g. Penicillin, Sulpha drugs" })}</Field>
          )}
          <Field label="Other allergies" htmlFor="zp-otherAllergies" error={errors.otherAllergies} hint="Food, cosmetics, fragrance, latex…">
            {inp("otherAllergies")}
          </Field>
        </>
      )}

      {step === 4 && (
        <>
          <h2 className="zp-h2">Your daily routine</h2>
          <div className="zp-grid">
            <Field label="Cleanser" htmlFor="zp-cleanser" error={errors.cleanser}>{inp("cleanser", { placeholder: "Brand / product" })}</Field>
            <Field label="Moisturiser" htmlFor="zp-moisturiser" error={errors.moisturiser}>{inp("moisturiser", { placeholder: "Brand / product" })}</Field>
            <Field label="Sun screen" htmlFor="zp-sunscreen" error={errors.sunscreen}>{inp("sunscreen", { placeholder: "Brand / SPF" })}</Field>
            <Field label="Other products" htmlFor="zp-otherProducts" error={errors.otherProducts}>{inp("otherProducts", { placeholder: "Serums, actives, supplements…" })}</Field>
          </div>
          <div className="zp-grid">
            <Field label="Diet" error={errors.diet}>
              <Chips id="zp-diet" error={errors.diet} options={["Veg", "Non-Veg"]} multi={false} value={values.diet === "veg" ? "Veg" : values.diet === "non-veg" ? "Non-Veg" : ""} onChange={(v) => set("diet", v === "Veg" ? "veg" : v === "Non-Veg" ? "non-veg" : "")} name="Diet" />
            </Field>
            <Field label="Water intake (litres / day)" htmlFor="zp-waterIntake" error={errors.waterIntake} hint="A number, e.g. 2.5">
              {inp("waterIntake", { inputMode: "decimal", placeholder: "e.g. 2.5" })}
            </Field>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <h2 className="zp-h2">Answer if relevant</h2>
          <p className="zp-small zp-muted" style={{ marginTop: 0 }}>These help your doctor choose a safe treatment for today.</p>
          <YesNoRow id="zp-newProducts" detailId="zp-newProductsDetail" detailMaxLength={MAX.newProductsDetail} error={errors.newProducts || errors.newProductsDetail} question="Did you start any new skin care products in the past week?" value={values.newProducts} onChange={(v) => set("newProducts", v)} detail={values.newProductsDetail} onDetail={(v) => set("newProductsDetail", v)} />
          <YesNoRow id="zp-salonVisit" detailId="zp-salonVisitDetail" detailMaxLength={MAX.salonVisitDetail} error={errors.salonVisit || errors.salonVisitDetail} question="Any recent salon visit in the past week?" value={values.salonVisit} onChange={(v) => set("salonVisit", v)} detail={values.salonVisitDetail} onDetail={(v) => set("salonVisitDetail", v)} detailLabel="What was done?" />
          <YesNoRow id="zp-pastTreatments" detailId="zp-pastTreatmentsDetail" detailMaxLength={MAX.pastTreatmentsDetail} error={errors.pastTreatments || errors.pastTreatmentsDetail} question="Any past treatments or surgeries?" value={values.pastTreatments} onChange={(v) => set("pastTreatments", v)} detail={values.pastTreatmentsDetail} onDetail={(v) => set("pastTreatmentsDetail", v)} detailLabel="Please specify (what & when)" />
        </>
      )}

      {step === 6 && (
        <>
          <h2 className="zp-h2">Review &amp; sign</h2>
          <p className="zp-small zp-muted" style={{ marginTop: 0 }}>
            This is exactly how it reaches your doctor, who signs the Doctor line after reviewing it. Go back to change anything.
          </p>
          <PreConsultSheet preconsult={preview} />
          <div style={{ height: 20 }} />
          <label className="zp-consent">
            <input id="zp-consent" type="checkbox" checked={values.consent === true} aria-invalid={errors.consent ? true : undefined} onChange={(e) => set("consent", e.target.checked)} />
            <span>
              I confirm that the information above is true to the best of my knowledge, and I consent to Zennara storing it securely and sharing it with my consulting doctor and treating staff for the purpose of my care.
            </span>
          </label>
          {errors.consent && <div className="zp-error" role="alert">{errors.consent}</div>}
          <div style={{ height: 18 }} />
          <Field label="Your signature" required error={errors.signature}>
            <SignaturePad id="zp-signature" value={values.signature} onChange={(sig) => set("signature", sig || "")} />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
        </>
      )}

      <div className="zp-actions">
        <button type="button" className="zp-btn zp-btn--ghost" onClick={back} disabled={step === 0 || busy}>
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="zp-btn zp-btn--primary" onClick={next}>
            Continue <ArrowRight />
          </button>
        ) : (
          <button type="button" className="zp-btn zp-btn--primary" onClick={handleSubmit} disabled={busy}>
            {busy ? "Sending to your doctor…" : "Submit to my doctor"} {!busy && <ArrowRight />}
          </button>
        )}
      </div>
      {step === 0 && initial?.dateOfVisit && (
        <p className="zp-small zp-muted" style={{ marginBottom: 0 }}>
          Pre-filled from your form dated {formatDate(initial.dateOfVisit)}. Please review every answer.
        </p>
      )}
    </div>
  );
}
