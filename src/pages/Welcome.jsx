import { Link } from "react-router-dom";
import { Logo } from "../components/ui.jsx";
import { ArrowRight } from "../components/icons.jsx";

/** The screen the front-desk tablet sits on between guests. */
export default function Welcome() {
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
            <Link to="/check-in" className="zp-btn zp-btn--primary">Start check-in <ArrowRight /></Link>
          </div>
        </div>
      </main>
      <footer className="zp-footer">
        Your details are encrypted in transit and shared only with your consulting doctor.
      </footer>
    </div>
  );
}
