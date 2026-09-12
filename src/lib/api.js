/**
 * The only place the walk-in tablet talks to the Zennara backend.
 *
 * It calls the same production API the mobile app does (`/api/walkin/*`), so a
 * guest checked in at the desk is an ordinary Zennara patient from the first
 * moment — same patient id, same Zenoti guest, same pre-consult record the
 * dermatologist panel reads.
 *
 * Set VITE_API_BASE_URL to the API origin to point the tablet somewhere else
 * (a staging API, a colleague's machine). It is not needed for a normal
 * deployment.
 */
const PRODUCTION_API_ORIGIN = "https://api.zennara.in";

/**
 * Where this build talks to.
 *
 * Deployed with nothing configured, this used to resolve to an empty origin,
 * so the tablet posted /api/walkin/send-otp to whatever host was serving the
 * page — its own Vercel domain, which has no API — and every check-in died on
 * a 404 at the very first step. The empty origin is only ever right on a dev
 * machine, where Vite's proxy forwards /api to the local backend; anywhere
 * else the answer is the production API. Same rule the mobile app uses, so the
 * two cannot be configured into disagreeing.
 */
function apiOrigin() {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = typeof window === "undefined" ? "" : window.location.hostname;
  const isDevServer = host === "localhost" || host === "127.0.0.1";
  return isDevServer ? "" : PRODUCTION_API_ORIGIN;
}

const ORIGIN = apiOrigin();
const BASE = `${ORIGIN}/api`;

/**
 * The desk tablet is shared, so the session lives in sessionStorage and is
 * dropped the moment a check-in finishes — the next guest never inherits the
 * last one's record. sessionStorage also dies with the tab, which is the right
 * behaviour for a kiosk that gets closed at the end of the day.
 */
const TOKEN_KEY = "zennara.walkin.token";
/**
 * When this session was minted and when it was last touched.
 *
 * Guest A was called into the consult room mid-form; the desk tapped back to
 * the welcome screen and handed the tablet to guest B, whose tab still held
 * A's bearer. B tapped "Start check-in", the resume path saw a token, and B
 * spent the next ten minutes editing A's record — then signed it. A token on
 * its own is therefore NOT enough to resume: it has to be provably fresh, so
 * we stamp it and refuse anything old or idle. These are the tablet's own
 * limits and sit inside the (shorter) ones the API enforces.
 */
const STARTED_KEY = "zennara.walkin.started";
const SEEN_KEY = "zennara.walkin.seen";
/** A session nobody has touched for this long is abandoned, not resumable. */
export const SESSION_IDLE_MS = 15 * 60 * 1000;
/** Nobody fills this form for three quarters of an hour. */
export const SESSION_MAX_MS = 45 * 60 * 1000;

const readNumber = (key) => {
  try {
    const raw = Number(sessionStorage.getItem(key));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch { return 0; }
};

export const session = {
  get token() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try {
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
        sessionStorage.setItem(STARTED_KEY, String(Date.now()));
        sessionStorage.setItem(SEEN_KEY, String(Date.now()));
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(STARTED_KEY);
        sessionStorage.removeItem(SEEN_KEY);
      }
    } catch { /* private mode — the check-in still completes, it just cannot resume */ }
  },
  /** Mark the guest as still here. Cheap enough to call on every interaction. */
  touch() {
    try { if (sessionStorage.getItem(TOKEN_KEY)) sessionStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* private mode */ }
  },
  /**
   * Is there a session we are willing to put someone back into? Only if it was
   * minted recently AND touched recently — anything else belongs to a guest who
   * has walked away, and resuming it would hand their record to a stranger.
   */
  get isFresh() {
    if (!this.token) return false;
    const started = readNumber(STARTED_KEY);
    const seen = readNumber(SEEN_KEY);
    if (!started || !seen) return false;
    const now = Date.now();
    // A clock that has moved backwards (tablet re-synced) reads as "the future",
    // which must not be treated as fresh either.
    if (started > now + 60_000 || seen > now + 60_000) return false;
    return now - started < SESSION_MAX_MS && now - seen < SESSION_IDLE_MS;
  },
  clear() {
    this.set(null);
    draft.clear();
  },
};

/**
 * The in-progress form, so a reload — or a stray back-swipe that unmounts the
 * form — does not throw seven steps of answers away.
 *
 * It is stamped with the session it belongs to and lives in sessionStorage
 * next to it, so it dies with the session, with the tab, and with every
 * "Start over". A draft must never outlive its guest: the next person to pick
 * the tablet up has to see an empty form.
 */
const DRAFT_KEY = "zennara.walkin.draft";
/** Identify the session without storing a second copy of the bearer. */
const fingerprint = (token) => {
  const t = String(token || "");
  let h = 0;
  for (let i = 0; i < t.length; i += 1) h = (h * 31 + t.charCodeAt(i)) | 0;
  return `${t.length}:${h}`;
};

export const draft = {
  save(payload) {
    const token = session.token;
    if (!token) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ owner: fingerprint(token), ...payload }));
    } catch { /* quota or private mode — the form still works, it just cannot survive a reload */ }
  },
  /** Returns the draft only when it belongs to the session in hand. */
  load() {
    const token = session.token;
    if (!token) return null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.owner !== fingerprint(token)) return null;
      return parsed;
    } catch { return null; }
  },
  clear() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
  },
};

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = session.token;
    if (!token) {
      const err = new Error("This check-in has timed out. Please start again.");
      err.status = 401;
      throw err;
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // A dead network reads as "server said no" without this, which sends the
    // desk hunting for a problem in the form.
    throw new Error("Could not reach Zennara. Check the connection and try again.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    err.fieldErrors = data.fieldErrors;
    if (res.status === 401 && auth) session.clear();
    throw err;
  }
  if (auth) session.touch();
  return data;
}

export const api = {
  /** Centres the guest can check in at. */
  branches: () => request("/walkin/branches").then((r) => r.data),

  /** Step 1 — prove the WhatsApp number. */
  sendOtp: (phone) => request("/walkin/send-otp", { method: "POST", body: { phone } }),

  /**
   * Step 2 — verify. Returns either a signed-in returning guest
   * (`isNew:false`, `token`) or a proof to create a new one (`walkinToken`).
   *
   * Any leftover session is dropped FIRST. Verifying is the moment a new
   * person takes the tablet, and the old bearer must not survive a failed or
   * abandoned verification long enough to be resumed by them.
   */
  verifyOtp: async (phone, otp) => {
    session.clear();
    const data = await request("/walkin/verify-otp", { method: "POST", body: { phone, otp } });
    if (data.token) session.set(data.token);
    return data;
  },

  /** Step 3 — the details that open a patient record. */
  saveProfile: async (values, walkinToken) => {
    const data = await request("/walkin/profile", {
      method: "POST",
      body: { ...values, ...(walkinToken ? { walkinToken } : {}) },
      auth: !walkinToken,
    });
    if (data.token) session.set(data.token);
    return data;
  },

  /** Who is checked in right now, plus last visit's answers for pre-filling. */
  me: () => request("/walkin/me", { auth: true }),

  /**
   * Step 4 — the pre-consult form itself.
   *
   * `submissionId` is the guest's protection against clinic wifi: if the POST
   * lands but the reply is lost, the tablet says "Could not reach Zennara",
   * the guest taps Submit again, and without a key that second attempt used to
   * file a second form and a second Zenoti note against the same visit. The id
   * is generated once per form and resent unchanged on every retry, so the API
   * can hand back the form it already stored.
   */
  submitPreConsult: (values) => request("/walkin/preconsult", { method: "POST", body: values, auth: true }).then((r) => r.data),

  /** Hand the tablet back to the desk. */
  finish: async () => {
    try { await request("/walkin/finish", { method: "POST", auth: true }); } catch { /* ending a session must never fail visibly */ }
    session.clear();
  },

  /**
   * End the session on the way out of the page — a closed lid, a swiped-away
   * tab, the desk switching apps.
   *
   * An ordinary fetch is cancelled the moment the document goes away, and
   * `sendBeacon` cannot carry the Authorization header `/walkin/finish` reads
   * (and a bearer in a query string would land in every access log), so this
   * is a `keepalive` fetch: the browser finishes it after the page is gone,
   * with headers intact. The local session is dropped first and unconditionally
   * — that is the part that actually protects the next guest.
   */
  finishBeacon: () => {
    const token = session.token;
    session.clear();
    if (!token) return;
    try {
      fetch(`${BASE}/walkin/finish`, {
        method: "POST",
        keepalive: true,
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    } catch { /* best effort — the tablet-side session is already gone */ }
  },
};
