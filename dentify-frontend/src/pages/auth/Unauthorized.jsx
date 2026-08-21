/**
 * Unauthorized.jsx
 *
 * Página 403 — usuario autenticado pero sin rol suficiente para la ruta.
 * Respeta el sistema de diseño de Dentify (tokens C, FONT_SANS, FONT_SERIF).
 * No usa sidebar ni topbar — es una pantalla de error standalone.
 */

import { useNavigate } from "react-router-dom";
import { useAuth }     from "./useAuth";

const C = {
  bg:          "#F4F5F7",
  cardBg:      "#FFFFFF",
  border:      "#E4E6EC",
  navy:        "#0F2244",
  electric:    "#2563EB",
  textPrimary: "#111827",
  textMuted:   "#9CA3AF",
};

const FONT_SANS  = "'DM Sans', sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

export default function Unauthorized() {
  const navigate    = useNavigate();
  const { logoutUser } = useAuth();

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px",
    }}>
      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "48px 56px",
        maxWidth: 420,
        width: "100%",
        textAlign: "center",
      }}>
        <p style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.textMuted,
          fontFamily: FONT_SANS,
          marginBottom: 16,
        }}>
          Acceso restringido
        </p>

        <h1 style={{
          fontFamily: FONT_SERIF,
          fontSize: 26,
          fontWeight: 400,
          color: C.textPrimary,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          marginBottom: 12,
        }}>
          No tenés permiso para ver esta página
        </h1>

        <p style={{
          fontFamily: FONT_SANS,
          fontSize: 13,
          color: C.textMuted,
          lineHeight: 1.6,
          marginBottom: 32,
        }}>
          Tu rol no tiene acceso a esta sección. Si creés que es un error,
          contactá al administrador de la clínica.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: "9px 20px",
              borderRadius: 7,
              border: `1px solid ${C.border}`,
              background: C.cardBg,
              color: C.textPrimary,
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Volver
          </button>
          <button
            onClick={logoutUser}
            style={{
              padding: "9px 20px",
              borderRadius: 7,
              border: "none",
              background: C.navy,
              color: "#FFFFFF",
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}