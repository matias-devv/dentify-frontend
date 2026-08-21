/** 
 * Route guard for authenticated pages.
 *
 * Behavior:
 *  - While session is being restored from localStorage → renders nothing (avoids flash)
 *  - If authenticated → renders children
 *  - If not authenticated → redirects to /login, preserving the intended destination
 *    in location state so Login.jsx can redirect back after success
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Wait for localStorage session restoration before deciding
  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
}