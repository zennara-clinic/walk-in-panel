import { Page } from "../components/ui.jsx";
import { CheckCircle } from "../components/icons.jsx";
import { formatDate } from "../../shared/preconsult-schema.js";
import { guestCodeOf } from "../lib/guestCode.js";

/**
 * The last screen a walk-in sees before handing the tablet back.
 *
 * There is no printing and no copy of the answers here on purpose: the tablet
 * is shared, and the next guest must not be able to read the last one's
 * medical history by tapping Back. Their guest code is the one thing they need
 * to carry to the front desk.
 */
export default function Done({ submitted, guest, onFinish }) {
  const first = String(submitted.name || guest?.fullName || "").split(" ")[0];
  return (
    <Page center>
      <div className="zp-card zp-done" style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
        <div className="zp-done__mark"><CheckCircle size={34} /></div>
        <p className="zp-eyebrow">All done</p>
        <h1 className="zp-h1">Thank you{first ? `, ${first}` : ""}.</h1>
        <p className="zp-lead">
          Your form has gone to the Zennara doctor. They&apos;ll read it before your consultation
          {submitted.dateOfVisit ? <> on <strong>{formatDate(String(submitted.dateOfVisit).slice(0, 10))}</strong></> : null}.
        </p>
        <dl className="zp-review">
          <dt>Guest code</dt>
          <dd><strong className="zp-code">{guestCodeOf(submitted) ?? guestCodeOf(guest)}</strong> · please quote this at the front desk</dd>
        </dl>
        <h3 className="zp-h3">What happens next</h3>
        <ul className="zp-hero__points">
          <li>Please hand the tablet back to the front desk.</li>
          <li>Your doctor reviews and signs your form before the consultation starts.</li>
          <li>Everything is now on your Zennara record — the app will show it the next time you sign in.</li>
        </ul>
        <div className="zp-btn-row">
          <button type="button" className="zp-btn zp-btn--primary zp-btn--block" onClick={onFinish}>
            Finish &amp; hand back
          </button>
        </div>
      </div>
    </Page>
  );
}
