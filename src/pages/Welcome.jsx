import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/ui.jsx";
import { ArrowRight } from "../components/icons.jsx";
import { api, session } from "../lib/api.js";

/** The screen the front-desk tablet sits on between guests. */
export default function Welcome() {
  /*
   * This screen is, by definition, between guests: the desk only ever gets back
   * here because a check-in finished, was abandoned, or timed out. Nothing used
   * to clear the session here, so guest A — called into the consult room at
   * step 4 — left their bearer in the tab, and guest B tapped "Start check-in"
   * straight into A's record, saw A's name, guest code, allergies and
   * medications, and signed A's file with B's answers.
   *
   * So: end it, every single time this screen mounts. The API call is
   * best-effort and the local session is dropped either way — an unreachable
   * server must never be the reason a stranger inherits a medical record.
   */
  useEffect(() => {
    if (session.token) api.finish();
    else session.clear(); // also drops any orphaned draft
  }, []);

  return (
    <div className="zp-page">
      <main className="zp-main zp-main--center">
        <div className="zp-hero">
          <div>
            <Logo />
            <p className="zp-eyebrow">Skin · Aesthetic · Wellness</p>
            <h1 className="zp-h1">Welcome to Zennara</h1>
            <p className="zp-lead">
              Before your consultation we&apos;d like to know a little about you, your skin and your health.
              It takes about three minutes and helps your doctor prepare for you.
            </p>
            <ul className="zp-hero__points">
              <li>Verify your WhatsApp number with a 4-digit code.</li>
              <li>Confirm a few details so we can open your Zennara record.</li>
              <li>Answer the pre-consult questions and sign on screen.</li>
            </ul>
            {/*
              * `replace`, so the check-in leaves nothing behind to go back into.
              * A comment on the check-in screen claimed one route meant the
              * history had nothing to return to — but this push put the welcome
              * screen on the stack, and a stray back-swipe halfway through the
              * form unmounted it and threw every answer away.
              */}
            <Link to="/check-in" replace className="zp-btn zp-btn--primary">Start check-in <ArrowRight /></Link>
          </div>
        </div>
      </main>
      <footer className="zp-footer">
        Your details are encrypted in transit and shared only with your consulting doctor.
      </footer>
    </div>
  );
}
