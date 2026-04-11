/** 
 *
 * Central Axios instance for all Dentify API communication.
 *
 * Responsibilities:
 *  1. Attach Authorization: Bearer <jwt> to every outgoing request.
 *  2. On 401: attempt a token refresh via POST /auth/refresh (httpOnly cookie).
 *  3. Re-queue concurrent 401s so only ONE refresh request is ever in-flight
 *     (single-flight pattern — avoids OptimisticLockingFailureException on server).
 *  4. Retry the original failed request with the new token after refresh.
 *  5. On unrecoverable refresh failure: clear session + redirect to /login.
 *
 * What this file does NOT do:
 *  - It does not read or write the refreshToken cookie directly.
 *    The cookie is httpOnly — it is inaccessible to JS by design.
 *    The browser sends it automatically when withCredentials: true is set.
 */

import axios from "axios";
import {
  getToken,
  clearSession,
  persistSessionFromRefresh,
} from "./authService";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8008";

/* ── Axios instance ────────────────────────────────────────────────────── */

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/* ── Single-flight refresh state ───────────────────────────────────────
 *
 * WHY: If 3 concurrent requests all receive 401 simultaneously, we must
 * call /auth/refresh exactly once. The other 2 requests must wait for
 * that same promise to resolve and then retry with the new token.
 *
 * If we called /auth/refresh 3 times with the same rotated-out cookie,
 * the server's OptimisticLockingFailureException would kill all sessions.
 *
 * Pattern: module-level variable holds the in-flight promise.
 *   - First 401 → creates the promise, assigns to refreshPromise.
 *   - Subsequent 401s → await the same existing promise.
 *   - finally: resets refreshPromise = null so future refreshes work normally.
 */
let refreshPromise = null;

/**
 * Calls POST /auth/refresh with withCredentials: true so the browser
 * sends the httpOnly refreshToken cookie automatically.
 *
 * On success: persists the new accessToken (updates localStorage).
 * On failure: clears the session (forces re-login).
 *
 * Returns a Promise<void> that resolves when the token is ready.
 */
function handleRefresh() {
  if (refreshPromise) {
    // Another request already triggered a refresh — wait for it.
    return refreshPromise;
  }

  refreshPromise = axios
    .post(
      `${BASE_URL}/auth/refresh`,
      {},
      {
        /*
         * WHY withCredentials: true here:
         * The refreshToken is an httpOnly cookie scoped to path=/auth.
         * withCredentials instructs the browser to include cookies on
         * cross-origin requests. Without it, the cookie is silently omitted
         * and the server receives no token → 401 regardless of validity.
         */
        withCredentials: true,
        // Timeout shorter than main client — refresh must be fast or fail
        timeout: 8_000,
      }
    )
    .then(({ data }) => {
      // data = { accessToken: "..." }
      persistSessionFromRefresh(data.accessToken);
    })
    .catch((err) => {
      /*
       * Refresh failed (expired, revoked, replay attack detected, network).
       * Clear everything — user must re-authenticate.
       * Do NOT redirect here: the response interceptor below handles it
       * after this promise rejects, ensuring navigation context is correct.
       */
      clearSession();
      return Promise.reject(err);
    })
    .finally(() => {
      // Always reset so the next expiry cycle can create a fresh promise.
      refreshPromise = null;
    });

  return refreshPromise;
}

/* ── Request interceptor: attach JWT ──────────────────────────────────── */

apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    /*
     * WHY withCredentials per-request for /auth/* paths:
     * The refreshToken cookie has path=/auth — the browser only sends it
     * to URLs under /auth. We set withCredentials on all /auth calls so
     * login, refresh, and logout all properly send/receive cookies.
     *
     * We intentionally do NOT set withCredentials globally on apiClient:
     * that would instruct the browser to send ALL cookies (including session
     * cookies for other origins) on every API call — a security concern
     * if the app ever proxies to third-party APIs.
     */
    if (config.url?.startsWith("/auth")) {
      config.withCredentials = true;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ── Response interceptor: refresh on 401 ────────────────────────────── */

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    /*
     * Guard conditions — do NOT attempt refresh if:
     *   a) It's not a 401 (different error, propagate as-is).
     *   b) This request has already been retried (_retry flag prevents
     *      infinite loops: retry → 401 again → retry → ∞).
     *   c) The failing request IS /auth/refresh itself. If refresh returns
     *      401, the cookie is invalid/expired — do not recurse.
     *   d) The failing request is /auth/login (wrong credentials, not expiry).
     */
    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/login");

    if (status !== 401 || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Mark this request as retried — single retry only.
    originalRequest._retry = true;

    try {
      // Will await existing promise if another request already triggered refresh.
      await handleRefresh();

      // Token is now updated in localStorage — attach fresh token and retry.
      const newToken = getToken();
      originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch {
      /*
       * Refresh failed: session is already cleared by handleRefresh().
       * Redirect to login. replace: true prevents back-button returning
       * to a broken authenticated state.
       */
      window.location.replace("/login");
      return Promise.reject(
        new Error("Sesión expirada. Por favor, ingresá nuevamente.")
      );
    }
  }
);

export default apiClient;