/**
 * authService.js
 *
 * Handles all client-side authentication logic:
 *  - Login / Logout
 *  - Token storage, retrieval, and expiry checking
 *  - Session restoration on page load
 *  - Role extraction from JWT `authorities` claim
 *
 * ── Role strategy ──────────────────────────────────────────────────────────
 *
 * The backend encodes authorities as a comma-separated string in the JWT:
 *   "ROLE_DENTIST,READ_PATIENTS,WRITE_APPOINTMENTS,..."
 *
 * We filter for entries that start with "ROLE_" to get the role set.
 * Permissions (non-prefixed claims) are intentionally discarded here —
 * the front only needs roles for coarse-grained route guards.
 * Fine-grained permission checks belong on the server.
 *
 * Stored as JSON: '["ROLE_DENTIST"]'
 * Retrieved as: string[]
 *
 * ── Storage keys ───────────────────────────────────────────────────────────
 *
 *   dentify_jwt         — short-lived access JWT (25 min)
 *   dentify_username    — decoded from JWT `sub` claim
 *   dentify_tenant_id   — decoded from JWT `tenantId` claim
 *   dentify_expires_at  — decoded from JWT `exp` claim (ms)
 *   dentify_roles       — JSON array of "ROLE_*" strings
 */

import axios from "axios";
import { AuthError } from "./authError";

export { AuthError };

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8008";

const STORAGE_KEYS = {
  TOKEN:      "dentify_jwt",
  USERNAME:   "dentify_username",
  TENANT_ID:  "dentify_tenant_id",
  EXPIRES_AT: "dentify_expires_at",
  ROLES:      "dentify_roles",       // ← nuevo
};

/* ── JWT Payload decoder ──────────────────────────────────────────────── */

function decodeJwtPayload(jwt) {
  try {
    const base64Payload = jwt.split(".")[1];
    const base64 = base64Payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(
        base64Payload.length + ((4 - (base64Payload.length % 4)) % 4),
        "="
      );
    return JSON.parse(atob(base64));
  } catch {
    throw new AuthError("Token JWT malformado o inaccesible.", "server");
  }
}

/**
 * Extrae los roles del claim `authorities`.
 *
 * El backend genera: "ROLE_DENTIST,READ_PATIENTS,WRITE_APPOINTMENTS"
 * Solo nos interesan las entradas con prefijo "ROLE_".
 *
 * @param {string} authoritiesString — claim crudo del JWT
 * @returns {string[]} — e.g. ["ROLE_DENTIST"]
 */
function extractRoles(authoritiesString) {
  if (!authoritiesString) return [];
  return authoritiesString
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.startsWith("ROLE_"));
}

/* ── Token helpers ────────────────────────────────────────────────────── */

export function getToken() {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (!token) return null;

  const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
  if (expiresAt && Date.now() > Number(expiresAt)) {
    clearSession();
    return null;
  }

  return token;
}

export function getSessionData() {
  return {
    username: localStorage.getItem(STORAGE_KEYS.USERNAME) ?? null,
    tenantId: localStorage.getItem(STORAGE_KEYS.TENANT_ID) ?? null,
    roles:    getRoles(),
  };
}

/**
 * Devuelve el array de roles almacenados.
 * Retorna [] si no hay sesión o si el JSON está corrupto — nunca lanza.
 */
export function getRoles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROLES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isAuthenticated() {
  return getToken() !== null;
}

export function clearSession() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

/* ── Session persistence ──────────────────────────────────────────────── */

function persistSession({ jwt, username, tenantId }) {
  const payload    = decodeJwtPayload(jwt);
  const expiresAt  = payload.exp * 1000;
  const roles      = extractRoles(payload.authorities ?? "");

  localStorage.setItem(STORAGE_KEYS.TOKEN,      jwt);
  localStorage.setItem(STORAGE_KEYS.USERNAME,   username ?? "");
  localStorage.setItem(STORAGE_KEYS.TENANT_ID,  tenantId ?? "");
  localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(expiresAt));
  localStorage.setItem(STORAGE_KEYS.ROLES,      JSON.stringify(roles));
}

export function persistSessionFromRefresh(accessToken) {
  const payload    = decodeJwtPayload(accessToken);
  const expiresAt  = payload.exp * 1000;
  const roles      = extractRoles(payload.authorities ?? "");

  const username =
    payload.sub ?? localStorage.getItem(STORAGE_KEYS.USERNAME) ?? "";
  const tenantId =
    payload.tenantId ?? localStorage.getItem(STORAGE_KEYS.TENANT_ID) ?? "";

  localStorage.setItem(STORAGE_KEYS.TOKEN,      accessToken);
  localStorage.setItem(STORAGE_KEYS.USERNAME,   username);
  localStorage.setItem(STORAGE_KEYS.TENANT_ID,  tenantId);
  localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(expiresAt));
  localStorage.setItem(STORAGE_KEYS.ROLES,      JSON.stringify(roles));
}

/* ── API calls ────────────────────────────────────────────────────────── */

export async function login({ email, password }) {
  try {
    const { data } = await axios.post(
      `${BASE_URL}/auth/login`,
      { email, password },
      {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      }
    );

    persistSession({
      jwt:      data.jwt,
      username: data.username,
      tenantId: data.tenantId,
    });

    return {
      username: data.username,
      tenantId: data.tenantId,
      roles:    getRoles(),
    };
  } catch (error) {
    if (!error.response) {
      throw new AuthError(
        "Sin conexión con el servidor. Verificá tu red.",
        "network"
      );
    }
    handleBackendError(error.response.status, error.response.data);
  }
}

export async function logout() {
  try {
    await axios.post(
      `${BASE_URL}/auth/logout`,
      {},
      {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch {
    // best-effort
  } finally {
    clearSession();
  }
}

/* ── Error handling ───────────────────────────────────────────────────── */

function handleBackendError(status, body) {
  switch (status) {
    case 400:
      throw new AuthError(body?.message ?? "Credenciales inválidas.", "credentials");
    case 401:
      throw new AuthError("Correo o contraseña incorrectos.", "credentials");
    case 403:
      throw new AuthError(
        "Tu cuenta no tiene acceso activo. Contactá al administrador.",
        "account"
      );
    case 404:
      throw new AuthError(
        "No existe una cuenta con ese correo electrónico.",
        "email"
      );
    case 429:
      throw new AuthError(
        "Demasiados intentos. Esperá unos minutos e intentá de nuevo.",
        "rate_limit"
      );
    default:
      throw new AuthError(
        body?.message ?? "Error del servidor. Intentá nuevamente más tarde.",
        "server"
      );
  }
}