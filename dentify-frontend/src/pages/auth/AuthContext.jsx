/**
 * AuthContext.jsx
 *
 * Provides to all children:
 *   user            — { username, tenantId, roles: string[] } | null
 *   isLoading       — true during initial session restoration
 *   isAuthenticated — boolean shorthand
 *   loginUser       — async (credentials) → navega según rol
 *   logoutUser      — async → limpia sesión y navega a /login
 *
 * ── Role-aware navigation on login ────────────────────────────────────
 *
 * Después del login, el destino depende del rol:
 *   ROLE_DENTIST   → /dentist/dashboard
 *   ROLE_ADMIN     → /admin          (pendiente de implementación)
 *   ROLE_SECRETARY → /secretario     (pendiente de implementación)
 *   fallback       → /login          (rol desconocido — sesión inválida)
 *  
 */

import { createContext, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  login,
  logout,
  isAuthenticated,
  getSessionData,
} from "../../api/authService";

export const AuthContext = createContext(null);

/**
 * Devuelve la ruta de destino para un array de roles.
 * Prioriza DENTIST sobre otros roles si el usuario tuviera múltiples.
 */
export function resolveHomeRoute(roles = []) {
  if (roles.includes("ROLE_DENTIST"))   return "/dentist/dashboard";
  if (roles.includes("ROLE_ADMIN"))     return "/admin";
  if (roles.includes("ROLE_SECRETARY")) return "/secretario";
  return "/login";
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  // null = unauthenticated | { username, tenantId, roles } = authenticated
  const [user, setUser]         = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  /* ── Session restoration ──────────────────────────────────────────── */
  useEffect(() => {
    if (isAuthenticated()) {
      const { username, tenantId, roles } = getSessionData();
      setUser({ username, tenantId, roles });
    }
    setIsLoading(false);
  }, []);

  /* ── Login ────────────────────────────────────────────────────────── */
  const loginUser = useCallback(
    async (credentials) => {
      const { username, tenantId, roles } = await login(credentials);
      setUser({ username, tenantId, roles });
      navigate(resolveHomeRoute(roles), { replace: true });
    },
    [navigate]
  );

  /* ── Logout ───────────────────────────────────────────────────────── */
  const logoutUser = useCallback(async () => {
    await logout();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const value = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    loginUser,
    logoutUser,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}