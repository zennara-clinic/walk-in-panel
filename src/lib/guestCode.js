/**
 * The guest's human-readable id — the one the clinic prints on paper and the
 * guest quotes at the front desk.
 *
 * `guestCode` is Zenoti's own Guest Code and is what we show. The id we used to
 * generate ourselves (`patientId` on a guest record, `clientId` on a submitted
 * pre-consult) survives only as a fallback for the handful of guests who have
 * no Zenoti code yet.
 */
export const guestCodeOf = (source) =>
  source?.guestCode ?? source?.patientId ?? source?.clientId ?? null;
