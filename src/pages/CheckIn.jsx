import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PhoneOtp from "../components/PhoneOtp.jsx";
import ProfileDetails from "../components/ProfileDetails.jsx";
import PreConsultForm from "../components/PreConsultForm.jsx";
import Done from "./Done.jsx";
import { Alert, Page } from "../components/ui.jsx";
import { api, session } from "../lib/api.js";
import { guestCodeOf } from "../lib/guestCode.js";

/**
 * How long the tablet waits before deciding the guest has gone.
 *
 * Guest A was called into the consult room at step 4. The desk tapped back to
 * the welcome screen, guest B tapped "Start check-in", and — because the only
 * thing the resume path checked was "is there a token" — B landed inside A's
 * record, read A's name, guest code, allergies and medications, and signed A's
 * file.
 *
 * Five minutes of nothing at all is a guest who has walked away, and the
 * warning a minute before it means nobody is cut off mid-word. It is
 * deliberately not tighter: reading a medical-history question is not the same
 * as being absent, and an older guest on a touch keyboard is slow, not gone.
 * This is the weakest of the four defences anyway — the welcome screen clears
 * the session, the resume path refuses anything stale, and closing the lid
 * ends it — so it is the one that should err towards the guest.
 */
const IDLE_MS = 300_000;
const IDLE_WARN_MS = 60_000;
/** Events that count as "there is still a person here". */
const ACTIVITY = ["pointerdown", "keydown", "touchstart", "input", "wheel", "scroll"];

/** All four are present on the profile the API returns; any missing one means the record is half-built. */
const profileComplete = (user) => Boolean(user?.fullName && user?.location && user?.dateOfBirth && user?.gender);

/**
 * The whole walk-in check-in, as one state machine on one route.
 *
 * It is deliberately not split across routes. This runs on a shared tablet at
 * the front desk, where a stray back-swipe between "number verified" and
 * "record created" would either strand the guest or start a second, empty
 * check-in. One route, and a `replace` link into it from the welcome screen,
 * means the browser's history has nothing to go back into.
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
  /* Only a demonstrably fresh session is worth trying to resume. */
  const [resuming, setResuming] = useState(() => session.isFresh);
  /** Details typed before a proof expired, so re-verifying costs nothing. */
  const [profileDraft, setProfileDraft] = useState(null);
  const [notice, setNotice] = useState(null);
  const [idleWarning, setIdleWarning] = useState(false);
  /*
   * The prefill now arrives from /walkin/me a beat after verify-otp, so hold
   * the form back until it has landed: PreConsultForm reads `initial` once, in
   * its state initialiser, and a guest who tapped straight through the details
   * screen would otherwise get a blank form where last visit's answers belong.
   */
  const [prefillReady, setPrefillReady] = useState(true);
  const guestRef = useRef(null);

  /* `onFormExpired` needs the current guest without re-creating itself. */
  useEffect(() => { guestRef.current = guest; }, [guest]);

  /*
   * A guest halfway through the form who fat-fingers a reload used to lose
   * everything and start at the phone screen again. The session outlives the
   * reload (same tab), so ask the API who is checked in and put them back.
   *
   * `session.isFresh`, not `session.token`: a token alone only proves that
   * SOMEBODY checked in on this tab, which is precisely how the next guest
   * inherited the last one's record. A session that was minted long ago, or has
   * sat untouched, belongs to someone who is no longer holding the tablet.
   */
  useEffect(() => {
    // `resuming` was initialised from the same check, so it is already false
    // here — there is nothing to set, only a stale session to throw away.
    if (!session.isFresh) {
      session.clear();
      return undefined;
    }
    let alive = true;
    api.me()
      .then(({ user }) => {
        if (!alive) return;
        setGuest(user);
        setLatest(user?.latest || null);
        setPhone(user?.phone || "");
        setReturning(true);
        /*
         * The phase used to be set to "form" unconditionally, so a
         * clinic-imported guest whose record has no centre and no date of birth
         * skipped the details step entirely — their check-in was filed against
         * no centre at all, and `needsProfile` from verify-otp was read
         * nowhere in the app. Send an incomplete profile back to step 2.
         */
        setPhase(profileComplete(user) ? "form" : "details");
      })
      .catch(() => session.clear())
      .finally(() => { if (alive) setResuming(false); });
    return () => { alive = false; };
  }, []);

  /** Abandon this check-in and hand the tablet back to the desk. */
  const reset = useCallback(async () => {
    setIdleWarning(false);
    setPhase("phone");
    setPhone("");
    setWalkinToken(null);
    setGuest(null);
    setLatest(null);
    setSubmitted(null);
    setReturning(false);
    setProfileDraft(null);
    setNotice(null);
    setPrefillReady(true);
    // Clears the bearer AND the form draft that hangs off it, so nothing of
    // this guest is left for the next one. Navigating away is not enough:
    // Welcome clears it too, but only if we actually get there.
    await api.finish();
    navigate("/", { replace: true });
  }, [navigate]);

  /*
   * The inactivity timer. Belt to the braces of clearing on Welcome: the desk
   * does not always tap back to the welcome screen, and an abandoned tablet
   * sitting on the form is the same exposure by another route.
   */
  useEffect(() => {
    if (resuming) return undefined;
    let warn;
    let kill;
    const arm = () => {
      clearTimeout(warn);
      clearTimeout(kill);
      warn = setTimeout(() => setIdleWarning(true), IDLE_MS - IDLE_WARN_MS);
      kill = setTimeout(() => { reset(); }, IDLE_MS);
    };
    const onActivity = () => {
      session.touch();
      setIdleWarning((w) => (w ? false : w)); // same value = no re-render
      arm();
    };
    arm();
    for (const type of ACTIVITY) window.addEventListener(type, onActivity, { capture: true, passive: true });
    return () => {
      clearTimeout(warn);
      clearTimeout(kill);
      for (const type of ACTIVITY) window.removeEventListener(type, onActivity, { capture: true });
    };
  }, [resuming, reset]);

  /*
   * A closed lid, a swiped-away tab, the desk switching to another app: none of
   * those run the Welcome screen's cleanup, and all of them leave a live
   * session on a tablet that is about to be handed to someone else. `pagehide`
   * covers navigation and close; `visibilitychange` covers the app-switch and
   * the screen lock, which is the common one at a front desk.
   */
  useEffect(() => {
    const end = () => { if (session.token) api.finishBeacon(); };
    const onVisibility = () => { if (document.visibilityState === "hidden") end(); };
    window.addEventListener("pagehide", end);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", end);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function onVerified(result) {
    setNotice(null);
    setPhone(result.phone || result.user?.phone || "");
    if (result.isNew) {
      setWalkinToken(result.walkinToken);
      setGuest(null);
      setLatest(null);
      setReturning(false);
    } else {
      setWalkinToken(null);
      setGuest(result.user);
      setReturning(true);
      /*
       * verify-otp used to hand last visit's answers back on `user.latest`, and
       * is being changed to stop. /walkin/me is the source of truth now that a
       * session exists; the verify payload is only a fallback so the tablet
       * works on both sides of that deploy. Only `latest` is taken from here —
       * overwriting `guest` would race the profile save on the next screen.
       */
      setLatest(result.user?.latest || null);
      setPrefillReady(false);
      api.me()
        .then(({ user }) => setLatest(user?.latest || result.user?.latest || null))
        .catch(() => { /* the form simply opens blank — nothing is lost */ })
        .finally(() => setPrefillReady(true));
    }
    setPhase("details");
  }

  /**
   * The 20-minute proof (or the session) ran out while the guest was typing.
   *
   * `ProfileDetails` had no back button and no way to ask for a new code: the
   * only control on the screen was "Start over", which threw away everything
   * they had entered. Keep the values, keep the number, say plainly what
   * happened, and let them ask for a new code.
   */
  const onExpired = useCallback((values, message) => {
    setProfileDraft(values || null);
    setWalkinToken(null);
    setNotice(message || "That code has expired. Please ask for a new one — the details you entered are saved.");
    setPhase("phone");
    window.scrollTo({ top: 0 });
  }, []);

  /** Same, but from inside the form, where only the profile can be carried over. */
  const onFormExpired = useCallback((message) => {
    const g = guestRef.current;
    if (g) {
      setProfileDraft({
        fullName: g.fullName || "",
        dateOfBirth: g.dateOfBirth ? String(g.dateOfBirth).slice(0, 10) : "",
        gender: g.gender || "",
        email: g.email || "",
        location: g.location || "",
      });
    }
    setWalkinToken(null);
    setNotice(message || "This check-in timed out. Please verify your number again to carry on.");
    setPhase("phone");
    window.scrollTo({ top: 0 });
  }, []);

  /** "Start over" throws the whole check-in away, so ask first once there is something to lose. */
  const startOver = () => {
    if (phase !== "phone" && !window.confirm("Start again from the beginning?\n\nEverything entered on this tablet will be cleared.")) return;
    reset();
  };

  /* Shown above every phase, so nobody is timed out without warning. */
  const idleBanner = idleWarning ? (
    <Alert tone="pending">
      Are you still there? This check-in will close in about half a minute to protect your details.{" "}
      <button type="button" className="zp-link" onClick={() => setIdleWarning(false)}>I&apos;m still here</button>
    </Alert>
  ) : null;

  if (phase === "done" && submitted) {
    return <Done submitted={submitted} guest={guest} onFinish={reset} banner={idleBanner} />;
  }

  const code = guestCodeOf(guest);
  const right = (
    <>
      {code && <span>Guest code <strong className="zp-code">{code}</strong></span>}
      <button type="button" className="zp-link" onClick={startOver}>Start over</button>
    </>
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
          {idleBanner}
          <p className="zp-eyebrow">Step 1 of 3</p>
          <h2 className="zp-h2">Verify your WhatsApp number</h2>
          <p className="zp-small zp-muted" style={{ marginTop: 0, marginBottom: 20 }}>
            This finds your Zennara record, or starts a new one.
          </p>
          <PhoneOtp onVerified={onVerified} initialPhone={phone} notice={notice} />
        </div>
      </Page>
    );
  }

  if (phase === "details") {
    return (
      <Page center right={right}>
        <div style={{ maxWidth: 620, margin: "0 auto", width: "100%" }}>
          {idleBanner}
          {returning && (
            <Alert tone="success">
              Welcome back{guest?.fullName ? `, ${guest.fullName.split(" ")[0]}` : ""}. We found your Zennara record.
            </Alert>
          )}
          <ProfileDetails
            phone={phone}
            walkinToken={walkinToken}
            existing={guest}
            draftValues={profileDraft}
            onExpired={onExpired}
            onSaved={(user) => { setGuest(user); setProfileDraft(null); setPhase("form"); window.scrollTo({ top: 0 }); }}
          />
        </div>
      </Page>
    );
  }

  if (!prefillReady) {
    return (
      <Page center right={right}>
        <p className="zp-muted" style={{ textAlign: "center" }}>Opening your form…</p>
      </Page>
    );
  }

  return (
    <Page right={right}>
      {idleBanner}
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
        onExpired={onFormExpired}
        onSubmitted={(data) => { setSubmitted(data); setPhase("done"); window.scrollTo({ top: 0 }); }}
      />
    </Page>
  );
}
