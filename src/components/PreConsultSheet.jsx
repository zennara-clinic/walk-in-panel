import {
  CONCERN_OPTIONS,
  MEDICAL_OPTIONS,
  PREGNANCY_OPTIONS,
  REASON_OPTIONS,
  ageFromDob,
  formatDate,
  formatDateTime,
  formatPhone,
  yesNoLabel,
} from "../../shared/preconsult-schema.js";
import { Check as CheckIcon } from "./icons.jsx";
import { guestCodeOf } from "../lib/guestCode.js";

/** Label: ____value____  (value wraps inside its own cell, underline follows). */
const KV = ({ k, v, code, className = "" }) => (
  <div className={`zp-kv ${className}`}>
    <span className="zp-kv__k">{k}:</span>
    <span className={`zp-kv__v${code ? " zp-kv__v--code" : ""}`}>{v || ""}</span>
  </div>
);

/** Label followed by a tick box, exactly like the printed form. */
const Check = ({ label, on }) => (
  <span className={`zp-check${on ? " zp-check--on" : ""}`}>
    {label}
    <span className="zp-check__box">{on ? <CheckIcon size={11} strokeWidth="2.5" /> : null}</span>
  </span>
);

const Answer = ({ q, v, detail }) => (
  <li>
    {q} <b>{yesNoLabel(v)}</b>
    {v === "yes" && detail ? <> · {detail}</> : null}
  </li>
);

/**
 * Read-only rendering of one pre-consult, laid out like the paper PRE-CONSULT FORM.
 * Used by the client's review step and confirmation, the doctor / therapist panels and for print.
 * The Doctor signature line is always present – blank until the doctor signs.
 */
export default function PreConsultSheet({ preconsult: p }) {
  const d = p.data || {};
  const age = ageFromDob(d.dob);
  const dob = d.dob ? `${formatDate(d.dob)}${age ? ` (${age} yrs)` : ""}` : "";

  return (
    <article className="zp-sheet">
      <div className="zp-sheet__top">
        <div className="zp-sheet__line zp-cols-visit" style={{ marginBottom: 0 }}>
          <KV k="Date of Visit" v={formatDate(p.dateOfVisit)} />
        </div>
        <img src="/zennara-logo.png" alt="Zennara" />
      </div>
      <div className="zp-sheet__id">
        <KV k="Guest code" v={guestCodeOf(p)} code />
      </div>

      <div className="zp-sheet__title">PRE-CONSULT FORM</div>

      <div className="zp-sheet__line zp-cols-name">
        <KV k="Name" v={p.name || d.name} />
        <KV k="Date of Birth" v={dob} />
        <KV k="Gender" v={d.gender} />
      </div>
      <div className="zp-sheet__line zp-cols-contact">
        <KV k="Phone Number" v={formatPhone(p.phone)} />
        <KV k="E-Mail" v={p.email || d.email} />
      </div>
      <div className="zp-sheet__line zp-cols-family">
        <KV k="Status" v={d.maritalStatus} />
        <KV k="No of Children" v={d.children} />
        <KV k="Planning for pregnancy" v={d.planningPregnancy ? yesNoLabel(d.planningPregnancy) : ""} />
        <KV k="LMP" v={d.lmp ? formatDate(d.lmp) : ""} />
      </div>
      <div className="zp-sheet__line zp-cols-source">
        <KV k="How did you get to know about ZENNARA" v={d.source === "Other" ? d.sourceOther || "Other" : d.source} />
        <KV k="Referred by" v={d.referredBy} />
      </div>

      <div className="zp-sheet__section">Reason for Visit:</div>
      <div className="zp-sheet__checks">
        {REASON_OPTIONS.map((o) => <Check key={o} label={o} on={d.reasons?.includes(o)} />)}
      </div>
      <div className="zp-sheet__checks">
        {CONCERN_OPTIONS.map((o) => <Check key={o} label={o} on={d.concerns?.includes(o)} />)}
      </div>
      <div className="zp-sheet__line zp-cols-visit">
        <KV k="Others Specify" v={d.concernsOther} />
      </div>

      <div className="zp-sheet__section">Medical History:</div>
      <div className="zp-sheet__checks">
        {MEDICAL_OPTIONS.map((o) => <Check key={o} label={o} on={d.medical?.includes(o)} />)}
        <span className="zp-check__group">
          <b>Menstrual History:</b>
          <Check label="Regular" on={d.menstrualHistory === "regular"} />
          <Check label="Irregular" on={d.menstrualHistory === "irregular"} />
        </span>
      </div>
      <div className="zp-sheet__line zp-cols-allergy">
        <span className="zp-check__group">
          <Check label="Drug Allergies" on={d.drugAllergies} />
          {d.drugAllergies && d.drugAllergiesDetail ? <span>({d.drugAllergiesDetail})</span> : null}
        </span>
        <KV k="Other Allergies" v={d.otherAllergies} />
      </div>

      <div className="zp-sheet__section">Daily Routine:</div>
      <div className="zp-sheet__line zp-cols-routine">
        <KV k="Cleanser" v={d.cleanser} />
        <KV k="Moisturiser" v={d.moisturiser} />
        <KV k="Sun screen" v={d.sunscreen} />
        <KV k="Other Products" v={d.otherProducts} />
      </div>
      <div className="zp-sheet__line zp-cols-diet">
        <span className="zp-check__group">
          <b>Diet:</b>
          <Check label="Veg" on={d.diet === "veg"} />
          <Check label="Non-Veg" on={d.diet === "non-veg"} />
        </span>
        <KV k="Water intake Litre" v={d.waterIntake} />
      </div>

      <div className="zp-sheet__section">Answer if Relevant:</div>
      <ul className="zp-sheet__list">
        <Answer q="Did you inculcate any new skin care products in the past week?" v={d.newProducts} detail={d.newProductsDetail} />
        <Answer q="Any recent salon visit in the past week?" v={d.salonVisit} detail={d.salonVisitDetail} />
        <Answer q="Any past treatments / surgeries?" v={d.pastTreatments} detail={d.pastTreatmentsDetail} />
      </ul>

      {(d.symptomDuration || d.previousTreatments || d.currentMedications || d.patientNotes
        || (d.pregnancyStatus && d.pregnancyStatus !== "not_applicable")) ? (
        <>
          <div className="zp-sheet__section">Presenting Complaint:</div>
          <div className="zp-sheet__line zp-cols-visit">
            <KV k="How long has this been going on" v={d.symptomDuration} />
          </div>
          <div className="zp-sheet__line zp-cols-visit">
            <KV k="Treatments already tried" v={d.previousTreatments} />
          </div>
          <div className="zp-sheet__line zp-cols-visit">
            <KV k="Current medication" v={d.currentMedications} />
          </div>
          {d.pregnancyStatus && d.pregnancyStatus !== "not_applicable" ? (
            <div className="zp-sheet__line zp-cols-visit">
              <KV k="Pregnancy" v={PREGNANCY_OPTIONS.find((o) => o.value === d.pregnancyStatus)?.label} />
            </div>
          ) : null}
          {d.patientNotes ? (
            <div className="zp-sheet__line zp-cols-visit">
              <KV k="Anything else for the doctor" v={d.patientNotes} />
            </div>
          ) : null}
        </>
      ) : null}

      {p.doctorNotes ? (
        <>
          <div className="zp-sheet__section">Doctor&apos;s Notes:</div>
          <div className="zp-sheet__notes">{p.doctorNotes}</div>
        </>
      ) : null}

      <div className="zp-sheet__signs">
        <div className="zp-sign">
          {p.clientSignature ? <img className="zp-sign__img" src={p.clientSignature} alt="Client signature" /> : <div className="zp-sign__blank" />}
          <div className="zp-sign__line">
            <b>Client Signature</b>
            {p.clientSignedAt ? <span className="zp-sign__meta">{formatDateTime(p.clientSignedAt)}</span> : null}
          </div>
        </div>
        <div className="zp-sign">
          {p.doctorSignature ? <img className="zp-sign__img" src={p.doctorSignature} alt="Doctor signature" /> : <div className="zp-sign__blank" />}
          <div className="zp-sign__line">
            <b>Doctor</b>
            {p.doctorName ? <span>{p.doctorName}</span> : null}
            <span className="zp-sign__meta">{p.doctorSignedAt ? formatDateTime(p.doctorSignedAt) : "Not yet signed"}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
