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

export const session = {
  get token() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* private mode — the check-in still completes, it just cannot resume */ }
  },
  clear() { this.set(null); },
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
   */
  verifyOtp: async (phone, otp) => {
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

  /** Step 4 — the pre-consult form itself. */
  submitPreConsult: (values) => request("/walkin/preconsult", { method: "POST", body: values, auth: true }).then((r) => r.data),

  /** Hand the tablet back to the desk. */
  finish: async () => {
    try { await request("/walkin/finish", { method: "POST", auth: true }); } catch { /* ending a session must never fail visibly */ }
    session.clear();
  },
};
