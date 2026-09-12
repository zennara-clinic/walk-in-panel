import { useEffect, useRef, useState } from "react";

/**
 * Finger / mouse signature capture. Emits a PNG data URL on every stroke end,
 * `null` when cleared. Works with touch (touch-action: none on the canvas).
 */
export default function SignaturePad({ onChange, height = 170, label = "Sign here with your finger or mouse" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a3325";
  }, [height]);

  const pos = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    const ctx = e.currentTarget.getContext("2d");
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1); // dot on tap
    ctx.stroke();
    setHasInk(true);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(e.currentTarget.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="zp-sig">
        <canvas ref={canvasRef} style={{ height }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} aria-label="Signature" />
        {!hasInk && <div className="zp-sig__hint">{label}</div>}
        <div className="zp-sig__line" />
      </div>
      <div className="zp-sig__bar">
        <span className="zp-muted">Your signature is stored securely with this form.</span>
        <button type="button" className="zp-link" onClick={clear}>Clear</button>
      </div>
    </div>
  );
}
