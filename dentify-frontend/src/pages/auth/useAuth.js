/** 
 * Convenience hook to consume AuthContext.
 * Throws a descriptive error if used outside AuthProvider — fail-fast pattern.
 */

import { useContext } from "react";
import { AuthContext } from "./AuthContext";

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error(
      "useAuth must be used within an <AuthProvider>. " +
      "Wrap your route tree with <AuthProvider> in App.jsx."
    );
  }

  return context;
}