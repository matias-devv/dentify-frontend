/**
 * RoleProtectedRoute.jsx
 *
 * Guard de dos niveles:
 *   1. Autenticación — igual que ProtectedRoute: redirige a /login si no hay sesión.
 *   2. Rol — si el usuario autenticado no tiene ninguno de los roles requeridos,
 *      redirige a /no-autorizado (403 page) en lugar de romper la vista.
 *
 * Uso:
 *   <RoleProtectedRoute allowedRoles={["ROLE_DENTIST"]}>
 *     <DentistDashboard />
 *   </RoleProtectedRoute>
 *
 * Notas de diseño:
 *   - No hace fetch al backend para verificar roles. Los roles vienen del JWT,
 *     que el servidor firma y el cliente solo decodifica. Si el JWT está vigente
 *     y fue emitido por el servidor, los roles son confiables para el front.
 *   - El servidor sigue siendo la última línea de defensa: cada endpoint
 *     tiene @PreAuthorize o SecurityFilterChain de Spring Security.
 *   - isLoading = true → null (igual que ProtectedRoute, evita flash de redirect).
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

/**
 * @param {{ allowedRoles: string[], children: React.ReactNode }} props
 */
export default function RoleProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Esperar restauración de sesión desde localStorage
  if (isLoading) return null;

  // Nivel 1: autenticación
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Nivel 2: rol
  const userRoles = user?.roles ?? [];
  const hasRole   = allowedRoles.some((role) => userRoles.includes(role));

  if (!hasRole) {
    return <Navigate to="/no-autorizado" replace />;
  }

  return children;
}