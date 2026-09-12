/**
 * Put the guest's eyes and focus on the first thing that is wrong.
 *
 * `next()` used to set the error state and stop there. On a tablet the guest is
 * at the bottom of a long step with their thumb on Continue, so the message
 * landed several hundred pixels above the fold: the button simply stopped
 * working, with nothing to read and nothing to fix. Scroll it into view, focus
 * it so the next tap types into the right box, and let the `role="alert"` on
 * the message do the announcing.
 *
 * Every field is looked up by the `zp-<key>` id its control (or, for chip
 * groups and yes/no rows, its wrapper) carries.
 */
export function focusFirstError(errors, order) {
  if (typeof document === "undefined") return null;
  const key = order.find((k) => errors[k] && document.getElementById(`zp-${k}`));
  if (!key) return null;
  const el = document.getElementById(`zp-${key}`);
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    el.scrollIntoView();
  }
  /*
   * preventScroll, because focusing a control also scrolls it into view — and
   * that instant jump fights the smooth scroll above, landing the guest with
   * the field jammed under the sticky top bar.
   */
  try { el.focus({ preventScroll: true }); } catch { /* not focusable — the scroll is enough */ }
  return key;
}
