/**
 * Single source of truth for the Zennara pre-consult form.
 *
 * Used by the walk-in tablet at the front desk, by the mobile app, and by the
 * backend that validates and stores what they send. It mirrors the paper
 * "PRE-CONSULT FORM" field for field, plus the presenting-complaint questions
 * the dermatologists added in September 2026.
 *
 * Change a question HERE and both the tablet and the app follow. The backend
 * translates this flat shape into the nested PreConsultForm record in
 * `Backend/utils/walkinPreConsult.js` — the two must be edited together.
 */
import { z } from "zod";

export const GENDER_OPTIONS = ["Female", "Male", "Other"];
export const STATUS_OPTIONS = ["Single", "Married", "Other"];
export const SOURCE_OPTIONS = [
  "Instagram",
  "Facebook",
  "Google",
  "Friend / Family",
  "Doctor referral",
  "Walk-in",
  "Other",
];
export const REASON_OPTIONS = ["Skin", "Hair", "Body", "Yoga", "Nutrition"];
export const CONCERN_OPTIONS = [
  "Acne / Pimple",
  "Scar",
  "Pigmentation",
  "Skin Sagging",
  "Skin Tightening",
  "Wart / Skin Tag",
  "Hair Fall / Thinning",
  "Hair Removal",
];
export const MEDICAL_OPTIONS = ["Hypertension", "Diabetes", "Thyroid Disorder"];

/**
 * Pregnancy is clinically load-bearing — several dermatology drugs and most
 * laser and peel protocols are contraindicated — so it is asked as a coded
 * answer rather than left to free text.
 */
export const PREGNANCY_OPTIONS = [
  { value: "not_applicable", label: "Not applicable" },
  { value: "not_pregnant", label: "Not pregnant" },
  { value: "pregnant", label: "Pregnant" },
  { value: "breastfeeding", label: "Breastfeeding" },
  { value: "planning", label: "Planning a pregnancy" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

/** Lifecycle of one pre-consult record. */
export const PRECONSULT_STATUSES = [
  "submitted", // client filled + signed
  "doctor_signed", // doctor reviewed + signed → record is locked
  "in_treatment", // therapist/doctor started the session
  "completed",
  "cancelled",
];

const str = z.string().trim().max(500);
const yesNoOrEmpty = z.enum(["yes", "no", ""]);

export const preConsultSchema = z.object({
  // Header
  dateOfVisit: z.string().min(1, "Please choose your date of visit."),

  // Personal
  name: z.string().trim().min(2, "Please enter your full name.").max(100),
  dob: z
    .string()
    .min(1, "Please enter your date of birth.")
    .refine((v) => {
      const t = new Date(v);
      if (Number.isNaN(t.getTime())) return false;
      const years = (Date.now() - t.getTime()) / (365.25 * 86400 * 1000);
      return years >= 1 && years <= 120;
    }, "Please enter a valid date of birth."),
  gender: z.enum(GENDER_OPTIONS, { message: "Please select your gender." }),
  email: z.string().trim().email("Enter a valid e-mail address.").or(z.literal("")),
  maritalStatus: z.enum(STATUS_OPTIONS).or(z.literal("")),
  children: z.string().trim().max(3),
  planningPregnancy: yesNoOrEmpty,
  lmp: z.string(),
  source: z.enum(SOURCE_OPTIONS).or(z.literal("")),
  sourceOther: str,
  referredBy: str,

  // Reason for visit
  reasons: z.array(z.enum(REASON_OPTIONS)).min(1, "Select at least one reason for your visit."),
  concerns: z.array(z.enum(CONCERN_OPTIONS)),
  concernsOther: str,

  // Medical history
  medical: z.array(z.enum(MEDICAL_OPTIONS)),
  menstrualHistory: z.enum(["regular", "irregular", ""]),
  drugAllergies: z.boolean(),
  drugAllergiesDetail: str,
  otherAllergies: str,

  // Daily routine
  cleanser: str,
  moisturiser: str,
  sunscreen: str,
  otherProducts: str,
  diet: z.enum(["veg", "non-veg", ""]),
  waterIntake: z.string().trim().max(10),

  // Answer if relevant
  newProducts: yesNoOrEmpty,
  newProductsDetail: str,
  salonVisit: yesNoOrEmpty,
  salonVisitDetail: str,
  pastTreatments: yesNoOrEmpty,
  pastTreatmentsDetail: str,

  // Presenting complaint (added 2026-09). Free text on purpose: the useful
  // part of "how long has this been going on" is the guest's own wording.
  symptomDuration: z.string().trim().max(200),
  previousTreatments: z.string().trim().max(2000),
  currentMedications: z.string().trim().max(2000),
  pregnancyStatus: z.enum(PREGNANCY_OPTIONS.map((o) => o.value)),
  patientNotes: z.string().trim().max(2000),

  // Declaration + client signature
  consent: z.literal(true, { message: "Please confirm the declaration to continue." }),
  signature: z
    .string()
    .startsWith("data:image/png", "Please sign in the box to continue.")
    .max(400_000, "Signature is too large. Please clear and sign again."),
});

/**
 * The details the front desk collects right after the WhatsApp number is
 * verified — the minimum a Zennara patient record (and its Zenoti guest) needs
 * before a form can be attached to it.
 *
 * E-mail is deliberately optional: most walk-ins do not have one to hand, and
 * blocking the desk over it is worse than storing a placeholder. Date of birth
 * is not optional — dosage, laser settings and consent all turn on age.
 * No 18+ gate: a minor at the front desk is a patient, not a failed sign-up.
 */
export const walkInProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter the full name.").max(100),
  dateOfBirth: z
    .string()
    .min(1, "Please enter the date of birth.")
    .refine((v) => {
      const t = new Date(v);
      if (Number.isNaN(t.getTime())) return false;
      const years = (Date.now() - t.getTime()) / (365.25 * 86400 * 1000);
      return years >= 0 && years <= 120;
    }, "Please enter a valid date of birth."),
  gender: z.enum(GENDER_OPTIONS, { message: "Please select a gender." }),
  email: z.string().trim().email("Enter a valid e-mail address, or leave it blank.").or(z.literal("")),
  location: z.string().trim().min(1, "Please choose the centre."),
});

export const doctorSignSchema = z.object({
  doctorNotes: z.string().trim().max(5000),
  signature: z
    .string()
    .startsWith("data:image/png", "Please sign in the box.")
    .max(400_000, "Signature is too large. Please clear and sign again."),
});

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function emptyPreConsult() {
  return {
    dateOfVisit: todayISO(),
    name: "",
    dob: "",
    gender: "",
    email: "",
    maritalStatus: "",
    children: "",
    planningPregnancy: "",
    lmp: "",
    source: "",
    sourceOther: "",
    referredBy: "",
    reasons: [],
    concerns: [],
    concernsOther: "",
    medical: [],
    menstrualHistory: "",
    drugAllergies: false,
    drugAllergiesDetail: "",
    otherAllergies: "",
    cleanser: "",
    moisturiser: "",
    sunscreen: "",
    otherProducts: "",
    diet: "",
    waterIntake: "",
    newProducts: "",
    newProductsDetail: "",
    salonVisit: "",
    salonVisitDetail: "",
    pastTreatments: "",
    pastTreatmentsDetail: "",
    symptomDuration: "",
    previousTreatments: "",
    currentMedications: "",
    pregnancyStatus: "not_applicable",
    patientNotes: "",
    consent: false,
    signature: "",
  };
}

export function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function ageFromDob(dob) {
  if (!dob) return "";
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? String(age) : "";
}

export const yesNoLabel = (v) => (v === "yes" ? "Yes" : v === "no" ? "No" : "—");

/** Country code + local number → E.164 (e.g. +919876543210). */
export function normalizePhone(countryCode, local) {
  const cc = String(countryCode || "").replace(/\D/g, "");
  const num = String(local || "").replace(/\D/g, "");
  if (!cc || cc.length > 4) return { error: "Enter a valid country code." };
  if (cc === "91") {
    if (!/^[6-9]\d{9}$/.test(num)) return { error: "Enter a valid 10-digit Indian mobile number." };
  } else if (num.length < 6 || num.length > 14) {
    return { error: "Enter a valid mobile number." };
  }
  return { phone: `+${cc}${num}` };
}

export function formatPhone(phone) {
  if (!phone) return "—";
  if (phone.startsWith("+91") && phone.length === 13) {
    return `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`;
  }
  return phone;
}

export function maskPhone(phone) {
  if (!phone) return "—";
  return phone.slice(0, -4).replace(/\d/g, "•") + phone.slice(-4);
}
