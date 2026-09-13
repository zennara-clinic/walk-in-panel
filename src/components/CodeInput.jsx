import { useRef, useState } from "react";

/**
 * The 4-digit WhatsApp code, one digit per box — the way every phone app
 * shows it, so a guest at the desk knows at a glance how many are left.
 *
 * One real input, invisible over the boxes, keeps the numeric keyboard, the
 * one-time-code autofill, paste and backspace exactly as before; the boxes
 * only render its value. Big targets: this is a tablet.
 */
export default function CodeInput({ length = 4, value, onChange, onComplete, disabled, autoFocus, id }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const active = Math.min(value.length, length - 1);
  const keepCaretAtEnd = () => {
    const el = ref.current;
    if (el) requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
  };
  return (
    <div className="zp-code">
      <div className="zp-code__boxes" aria-hidden="true">
        {digits.map((d, i) => {
          const isActive = focused && !disabled && i === active && value.length < length;
          return (
            <div key={i} className={`zp-code__box${isActive ? " is-active" : ""}${d ? " is-filled" : ""}`}>
              {d}{isActive && <span className="zp-code__caret" />}
            </div>
          );
        })}
      </div>
      <input
        id={id}
        ref={ref}
        className="zp-code__input"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, length);
          onChange(v);
          if (v.length === length && onComplete) onComplete(v);
        }}
        onKeyDown={(e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) e.preventDefault(); }}
        onFocus={() => { setFocused(true); keepCaretAtEnd(); }}
        onBlur={() => setFocused(false)}
        onClick={keepCaretAtEnd}
        inputMode="numeric"
        pattern="\d*"
        autoComplete="one-time-code"
        maxLength={length}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label="One-time password"
      />
    </div>
  );
}
