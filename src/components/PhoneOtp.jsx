import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Alert, Field } from "./ui.jsx";
import { MessageCircle } from "./icons.jsx";

/**
 * WhatsApp number → 4-digit OTP → verified, against `/api/walkin/*`.
 *
 * Calls `onVerified(result)` where result is either a signed-in returning
 * guest (`isNew:false`, `user`) or a proof for a new one (`walkinToken`).
 * Country code is fixed to +91: Zennara's centres are in Hyderabad and the
 * backend only accepts 10-digit Indian mobiles, so a code field would be a box
 * that can only be filled in wrongly.
 */
export default function PhoneOtp({ onVerified }) {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const validPhone = /^[6-9]\d{9}$/.test(phone);

  async function sendOtp() {
    if (!validPhone) return setError("Enter a valid 10-digit Indian mobile number.");
    setBusy(true);
    setError(null);
    try {
      await api.sendOtp(phone);
      setCode("");
      setStep("otp");
      setCooldown(30);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(otp) {
    setBusy(true);
    setError(null);
    try {
      onVerified?.(await api.verifyOtp(phone, otp));
    } catch (e) {
      setError(e.message);
      setCode("");
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={(e) => { e.preventDefault(); sendOtp(); }}>
        <Field
          label="WhatsApp mobile number"
          htmlFor="zp-phone"
          required
          hint="We'll send a 4-digit code to this number on WhatsApp."
          error={error}
        >
          <div className="zp-inline">
            <input className="zp-input zp-input--cc" value="+91" readOnly aria-label="Country code" tabIndex={-1} />
            <input
              id="zp-phone"
              className={`zp-input${error ? " zp-input--invalid" : ""}`}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              autoFocus
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(null); }}
            />
          </div>
        </Field>
        <button type="submit" className="zp-btn zp-btn--primary zp-btn--block" disabled={busy || !validPhone}>
          <MessageCircle /> {busy ? "Sending…" : "Send code on WhatsApp"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code.length === 4) verify(code); }}>
      <p className="zp-small" style={{ marginTop: 0 }}>
        Enter the 4-digit code sent to <strong>+91 {phone.slice(0, 5)} {phone.slice(5)}</strong>.{" "}
        <button type="button" className="zp-link" onClick={() => { setStep("phone"); setError(null); setCode(""); }}>
          Change number
        </button>
      </p>
      <input
        className="zp-input zp-otp"
        autoFocus
        inputMode="numeric"
        pattern="\d*"
        maxLength={4}
        autoComplete="one-time-code"
        placeholder="••••"
        aria-label="One-time password"
        value={code}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setCode(v);
          setError(null);
          if (v.length === 4 && !busy) verify(v);
        }}
      />
      {error && <Alert tone="error">{error}</Alert>}
      <button type="submit" className="zp-btn zp-btn--primary zp-btn--block" disabled={busy || code.length !== 4} style={{ marginTop: 14 }}>
        {busy ? "Verifying…" : "Verify & continue"}
      </button>
      <p className="zp-small zp-muted" style={{ textAlign: "center" }}>
        Didn&apos;t get it?{" "}
        <button type="button" className="zp-link" disabled={cooldown > 0 || busy} onClick={sendOtp}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </p>
    </form>
  );
}
