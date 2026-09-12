import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How much ink counts as a signature.
 *
 * A single stray tap — or a palm resting on the glass while the guest reaches
 * for the Submit button — produced a technically valid PNG. It passed the
 * client's `startsWith("data:image/png")` check and the server's identical one,
 * and what ended up filed against a consent declaration was a blank box with a
 * two-pixel dot in it. So a signature has to be both drawn (several move
 * events, not one touch) and of some size before the pad will report itself
 * signed.
 */
const MIN_MOVES = 6;
const MIN_SPAN_PX = 40;

const STROKE = { lineWidth: 2.2, lineCap: "round", lineJoin: "round", strokeStyle: "#1a3325" };

/** Every place the canvas is (re)sized has to re-apply BOTH of these. */
function configure(ctx, dpr) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  Object.assign(ctx, STROKE);
}

/**
 * Finger / mouse signature capture. Emits a PNG data URL once there is enough
 * real ink to be a signature, `null` when cleared or when what was drawn is
 * only a tap. Works with touch (touch-action: none on the canvas).
 *
 * `value` is the signature already held by the form. Without it, stepping back
 * from the sign step and returning showed an empty pad reading "Sign here"
 * while `values.signature` still held the earlier image — so the box looked
 * unsigned and Submit succeeded anyway, which is exactly the wrong way round.
 */
export default function SignaturePad({ onChange, value = "", id, height = 170, label = "Sign here with your finger or mouse" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  /** CSS-pixel size the bitmap was last measured at, for restoring on resize. */
  const sizeRef = useRef(null);
  /** Bounding box + move count of everything drawn since the last clear. */
  const ink = useRef({ minX: 0, minY: 0, maxX: 0, maxY: 0, moves: 0, any: false, accepted: false });
  // Seeded with the first render's callback so the mount effect can already
  // emit through it, then kept current without re-running that effect.
  const onChangeRef = useRef(onChange);
  const restored = useRef(false);

  const [hasInk, setHasInk] = useState(false);
  const [tooLittle, setTooLittle] = useState(false);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const isEnough = () => {
    const i = ink.current;
    if (i.accepted) return true;
    return i.moves >= MIN_MOVES && (i.maxX - i.minX) + (i.maxY - i.minY) >= MIN_SPAN_PX;
  };

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChangeRef.current(canvas.toDataURL("image/png"));
  }, []);

  /*
   * Re-measure on every size change, not just once at mount.
   *
   * The canvas used to be sized a single time in a mount effect. Rotating the
   * tablet — which guests do constantly — left the bitmap at the old width
   * while CSS stretched it to the new one, so existing ink came out distorted
   * and every new stroke followed the finger at a growing offset. A
   * ResizeObserver re-measures, carries the existing bitmap across, and
   * re-applies the device-pixel scale and stroke settings, which are lost the
   * instant `canvas.width` is written.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height || height));
      const nextW = Math.round(w * dpr);
      const nextH = Math.round(h * dpr);
      if (canvas.width === nextW && canvas.height === nextH) return;

      const previous = sizeRef.current;
      const snapshot = previous && ink.current.any ? canvas.toDataURL("image/png") : null;

      canvas.width = nextW;
      canvas.height = nextH;
      const ctx = canvas.getContext("2d");
      configure(ctx, dpr);
      sizeRef.current = { w, h };

      if (!snapshot) return;
      const img = new Image();
      img.onload = () => {
        // Fit, never stretch: a signature squashed to a new aspect ratio is
        // worse evidence than a smaller one.
        const scale = Math.min(w / previous.w, h / previous.h);
        ctx.drawImage(img, 0, 0, previous.w * scale, previous.h * scale);
        if (ink.current.accepted) emit();
      };
      img.src = snapshot;
    };

    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [height, emit]);

  /* Paint back a signature the form is already holding (a step back and forth). */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || restored.current) return;
    if (!String(value || "").startsWith("data:image/png")) return;
    restored.current = true;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      const size = sizeRef.current;
      if (!size) return;
      ctx.drawImage(img, 0, 0, size.w, size.h);
      ink.current = { ...ink.current, any: true, accepted: true };
      setHasInk(true);
      setTooLittle(false);
    };
    img.src = value;
  }, [value]);

  const pos = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const mark = (x, y) => {
    const i = ink.current;
    if (!i.any) {
      ink.current = { minX: x, minY: y, maxX: x, maxY: y, moves: 0, any: true, accepted: i.accepted };
      return;
    }
    i.minX = Math.min(i.minX, x); i.maxX = Math.max(i.maxX, x);
    i.minY = Math.min(i.minY, y); i.maxY = Math.max(i.maxY, y);
  };

  const down = (e) => {
    const ctx = e.currentTarget.getContext("2d");
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    mark(x, y);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1); // dot on tap
    ctx.stroke();
    setHasInk(true);
    setTooLittle(false);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    const { x, y } = pos(e);
    mark(x, y);
    ink.current.moves += 1;
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (isEnough()) {
      ink.current.accepted = true;
      setTooLittle(false);
      emit();
    } else {
      /*
       * Report NOT signed rather than sending a near-blank PNG. The form's own
       * required-field error then fires, and the line below says why, so the
       * guest is told to sign instead of being quietly let through.
       */
      setTooLittle(true);
      onChangeRef.current(null);
    }
  };
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    ink.current = { minX: 0, minY: 0, maxX: 0, maxY: 0, moves: 0, any: false, accepted: false };
    restored.current = true; // a deliberate clear must not be undone by the prop
    setHasInk(false);
    setTooLittle(false);
    onChange(null);
  };

  return (
    <div>
      <div className="zp-sig">
        <canvas id={id} ref={canvasRef} style={{ height }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} aria-label="Signature" />
        {!hasInk && <div className="zp-sig__hint">{label}</div>}
        <div className="zp-sig__line" />
      </div>
      {tooLittle && (
        <div className="zp-error" role="alert">That is too small to be a signature. Please sign your name across the box.</div>
      )}
      <div className="zp-sig__bar">
        <span className="zp-muted">Your signature is stored securely with this form.</span>
        <button type="button" className="zp-link" onClick={clear}>Clear</button>
      </div>
    </div>
  );
}
