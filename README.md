# Zennara · Walk-In Check-In

The tablet at the Zennara front desk. A guest who arrives without an
appointment verifies their WhatsApp number, gives the few details that open a
patient record, and fills the pre-consult form — and comes out of it as an
ordinary Zennara patient with an ordinary pre-consult on file.

Deployed **on its own**. It was extracted from the combined
`Zennara Pre-Consult Form/` project, which also held a doctor panel; that half
was folded into `../Panels/dermatologist-panel/`, the deployed one.

## The flow

| # | Screen | What happens |
|---|--------|--------------|
| 1 | Welcome | The screen the tablet rests on between guests |
| 2 | Verify | 10-digit mobile → 4-digit OTP on WhatsApp → verified |
| 3 | Details | Name, date of birth, gender, centre, e-mail (optional) → **the patient record is created here** |
| 4 | Form | The pre-consult, seven steps, ending in review + signature |
| 5 | Done | Client ID, and "hand the tablet back" |

The account is created at step 3, not at step 2: a `User` needs a name, a
centre and a date of birth, and half-built rows for people who wander off after
the OTP are worse than none. The OTP only proves the number.

**Returning guests** are recognised at step 2 — including guests who exist only
in Zenoti and have never opened the app. They are signed into their existing
record, their details come up for confirmation, and their last form pre-fills
the new one. No duplicate patient, no duplicate Zenoti guest.

**No 18+ gate.** A minor at the front desk is a patient, not a failed sign-up.
The app's own sign-up still enforces it.

**No e-mail is fine.** Blank stores the same deterministic
`@guest.zennara.in` placeholder the Zenoti import uses, which the rest of the
system renders back as "no email". Nothing is ever sent to it.

## Where the data goes

Everything talks to the production Zennara backend under `/api/walkin/*`
(`Backend/routes/walkin.js`, `Backend/controllers/walkinController.js`):

```
POST /api/walkin/send-otp      4-digit WhatsApp OTP, new numbers and existing ones alike
POST /api/walkin/verify-otp    → returning guest (session) | new guest (short-lived proof)
POST /api/walkin/profile       creates the User  → Zenoti guest (ensureGuest, post-save hook)
POST /api/walkin/preconsult    creates the PreConsultForm (status Submitted)
                               → Zenoti guest note (syncFormNote 'intake')
GET  /api/walkin/branches      the centre list for the picker
GET  /api/walkin/me            who is checked in on this tablet (resumes after a reload)
POST /api/walkin/finish        ends the session on the shared tablet
```

Both Zenoti writes are gated by `ZENOTI_WRITE_MODE` on the backend and are
best-effort: a CRM hiccup never loses a form.

The form's questions, options and validation live in
[`shared/preconsult-schema.js`](./shared/preconsult-schema.js) — the single
definition, mirrored by `Backend/utils/walkinPreConsult.js` (which translates
these flat answers into the nested record the panels read) and by the mobile
app's `constants/preConsult.ts`. **Change a question in one and change it in all
three.**

## Run it

```bash
npm install
npm run dev          # http://localhost:5176
```

In development `/api` proxies to the local backend on `:8000`. For a deployed
build set the API origin:

```bash
VITE_API_BASE_URL=https://api.zennara.in npm run build
```

## Notes for the desk

- The session lives in `sessionStorage` and is dropped the moment a check-in
  finishes, so the next guest never inherits the last one's record.
- The whole check-in is one route (`/check-in`) with no history behind it: a
  stray back-swipe between "number verified" and "record created" cannot
  strand a guest or start a second, empty check-in.
- The last screen shows no answers — only the client id. The tablet is shared.
- The Zennara logo is not a link, for the same reason.
