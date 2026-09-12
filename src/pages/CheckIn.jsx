import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PhoneOtp from "../components/PhoneOtp.jsx";
import ProfileDetails from "../components/ProfileDetails.jsx";
import PreConsultForm from "../components/PreConsultForm.jsx";
import Done from "./Done.jsx";
import { Alert, Page } from "../components/ui.jsx";
import { api, session } from "../lib/api.js";
import { guestCodeOf } from "../lib/guestCode.js";

/**
 * The whole walk-in check-in, as one state machine on one route.
 *
 * It is deliberately not split across routes. This runs on a shared tablet at
 * the front desk, where a stray back-swipe between "number verified" and
 * "record created" would either strand the guest or start a second, empty
 * check-in. One route means the browser's history has nothing to go back into,
 * and the session only ever moves forward until the desk resets it.
 *
 *   phone → details → form → done
 */
export default function CheckIn() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("phone");
  const [phone, setPhone] = useState("");
  const [walkinToken, setWalkinToken] = useState(null);
  const [guest, setGuest] = useState(null);
  const [latest, setLatest] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [returning, setReturning] = useState(false);
  const [resuming, setResuming] = useState(() => Boolean(session.token));

  /*
   * A guest halfway through the form who fat-fingers a reload used to lose
   * everything and start at the phone screen again. The session outlives the
   * reload (same tab), so ask the API who is checked in and put them back on
   * the form. Their form answers are gone either way — but their identity,
   * and last visit's pre-fill, are not.
   */
  useEffect(() => {
    if (!session.token) return;
    let alive = true;
    api.me()
      .then(({ user }) => {
        if (!alive) return;
        setGuest(user);
        setLatest(user?.latest || null);
        setPhone(user?.phone || "");
        setReturning(true);
        setPhase("form");
      })
      .catch(() => session.clear())
      .finally(() => { if (alive) setResuming(false); });
    return () => { alive = false; };
  }, []);

  function onVerified(result) {
    setPhone(result.phone || result.user?.phone || "");
    if (result.isNew) {
      setWalkinToken(result.walkinToken);
      setGuest(null);
      setLatest(null);
      setReturning(false);
    } else {
      setWalkinToken(null);
      setGuest(result.user);
      setLatest(result.user?.latest || null);
      setReturning(true);
    }
    setPhase("details");
  }

  /** Abandon this check-in and hand the tablet back to the desk. */
  async function reset() {
    await api.finish();
    setPhase("phone");
    setPhone("");
    setWalkinToken(null);
    setGuest(null);
    setLatest(null);
    setSubmitted(null);
    setReturning(false);
    navigate("/", { replace: true });
  }

  if (phase === "done" && submitted) {
    return <Done submitted={submitted} guest={guest} onFinish={reset} />;
  }

  const code = guestCodeOf(guest);
  const right = code ? (
    <>
      <span>Guest code <strong className="zp-code">{code}</strong></span>
      <button type="button" className="zp-link" onClick={reset}>Start over</button>
    </>
  ) : (
    <button type="button" className="zp-link" onClick={reset}>Start over</button>
  );

  if (resuming) {
    return (
      <Page center>
        <p className="zp-muted" style={{ textAlign: "center" }}>Picking up where you left off…</p>
      </Page>
    );
  }

  if (phase === "phone") {
    return (
      <Page center right={right}>
        <div className="zp-card" style={{ maxWidth: 460, margin: "0 auto", width: "100%" }}>
          <p className="zp-eyebrow">Step 1 of 3</p>
          <h2 className="zp-h2">Verify your WhatsApp number</h2>
          <p className="zp-small zp-muted" style={{ marginTop: 0, marginBottom: 20 }}>
            This finds your Zennara record, or starts a new one.
          </p>
          <PhoneOtp onVerified={onVerified} />
        </div>
      </Page>
    );
  }

  if (phase === "details") {
    return (
      <Page center right={right}>
        <div style={{ maxWidth: 620, margin: "0 auto", width: "100%" }}>
          {returning && (
            <Alert tone="success">
              Welcome back{guest?.fullName ? `, ${guest.fullName.split(" ")[0]}` : ""}. We found your Zennara record.
            </Alert>
          )}
          <ProfileDetails
            phone={phone}
            walkinToken={walkinToken}
            existing={guest}
            onSaved={(user) => { setGuest(user); setPhase("form"); window.scrollTo({ top: 0 }); }}
          />
        </div>
      </Page>
    );
  }

  return (
    <Page right={right}>
      <p className="zp-eyebrow">Step 3 of 3</p>
      <h1 className="zp-h1">Pre-consult form</h1>
      {latest?.dateOfVisit && (
        <Alert tone="info">
          We&apos;ve pre-filled this from your last visit. Please check every answer and update anything that has changed.
        </Alert>
      )}
      <PreConsultForm
        guest={guest}
        initial={latest}
        onSubmitted={(data) => { setSubmitted(data); setPhase("done"); window.scrollTo({ top: 0 }); }}
      />
    </Page>
  );
}
