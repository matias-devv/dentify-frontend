import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

// ─── Design tokens (shared with DentistRegistration) ───────────────────────
const T = {
  navy:        "#0A1628",
  navyMid:     "#0D1F3C",
  navyLight:   "#112448",
  blue:        "#1A6FD4",
  blueLight:   "#4A9EE8",
  bluePale:    "#EBF3FB",
  textPrimary: "#0A1628",
  textMuted:   "#5A6A7A",
  textLight:   "#A0AABA",
  border:      "#DDE3EC",
  bg:          "#F4F3F0",
  bgWhite:     "#FFFFFF",
  error:       "#C0392B",
  errorBg:     "#FDF2F2",
  success:     "#1A6FD4",
};

const API_BASE = "http://localhost:8008";

// ─── Utilities ─────────────────────────────────────────────────────────────
function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || "demo-token-valid";
}
function validateEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

// ─── Shared Field ──────────────────────────────────────────────────────────
function Field({ label, name, type = "text", value, onChange, error, disabled, placeholder, hint, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 11,
        fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase",
        color: error ? T.error : focused ? T.blue : T.textMuted,
        marginBottom: 6, transition: "color 0.15s",
      }}>
        {label}{required && <span style={{ color: T.blue, marginLeft: 3 }}>*</span>}
      </label>
      <input
        name={name} type={type} value={value} onChange={onChange}
        disabled={disabled} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "12px 14px",
          fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 400,
          color: disabled ? T.textMuted : T.textPrimary,
          background: disabled ? "#F0F2F5" : T.bgWhite,
          border: `1px solid ${error ? T.error : focused ? T.blue : T.border}`,
          borderRadius: 6, outline: "none", transition: "border-color 0.15s",
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
      {hint && !error && (
        <p style={{ margin: "5px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.textLight }}>{hint}</p>
      )}
      {error && (
        <p style={{ margin: "5px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.error }}>{error}</p>
      )}
    </div>
  );
}

// ─── Step Indicator (2 steps) ──────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ["Datos personales", "Acceso seguro"];
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: i < step ? T.blue : i === step ? T.navy : "transparent",
              border: `1.5px solid ${i <= step ? (i < step ? T.blue : T.navy) : T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500,
              color: i <= step ? "#fff" : T.textLight, transition: "all 0.2s",
            }}>
              {i < step ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 1,
                background: i < step ? T.blue : T.border,
                margin: "0 8px", transition: "background 0.2s",
              }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {steps.map((s, i) => (
          <span key={i} style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500,
            letterSpacing: "0.5px", color: i === step ? T.textPrimary : T.textLight,
            textAlign: i === 0 ? "left" : "right", flex: 1,
          }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Invitation Context Card ────────────────────────────────────────────────
// Shows who sent the invitation — only rendered when dentist/clinic info is available.
function InvitationCard({ dentistName, clinicName }) {
  if (!dentistName && !clinicName) return null;
  return (
    <div style={{
      background: T.bluePale,
      border: `1px solid #C8DEFA`,
      borderRadius: 8,
      padding: "14px 16px",
      marginBottom: 28,
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
    }}>
      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "rgba(26,111,212,0.12)",
        border: "1px solid rgba(26,111,212,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 1,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="1.5">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div>
        <p style={{
          margin: "0 0 3px",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 10, fontWeight: 500,
          letterSpacing: "1.5px", textTransform: "uppercase",
          color: T.blue,
        }}>
          Invitación enviada por
        </p>
        {dentistName && (
          <p style={{ margin: "0 0 1px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: T.textPrimary }}>
            {dentistName}
          </p>
        )}
        {clinicName && (
          <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 300, color: T.textMuted }}>
            {clinicName}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Personal data ─────────────────────────────────────────────────
function StepDatos({ data, onChange, errors, dentistName, clinicName }) {
  return (
    <div>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: T.blue, marginBottom: 8 }}>
        Paso 1 de 2
      </p>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 600, color: T.textPrimary, margin: "0 0 6px", lineHeight: 1.25 }}>
        Sus datos personales
      </h2>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textMuted, fontWeight: 300, margin: "0 0 28px", lineHeight: 1.6 }}>
        Complete su información de perfil. Estos datos quedarán vinculados a su cuenta en la plataforma.
      </p>

      <InvitationCard dentistName={dentistName} clinicName={clinicName} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
        <Field label="Nombre" name="name" value={data.name} onChange={onChange} error={errors.name} placeholder="Ej: Laura" required />
        <Field label="Apellido" name="surname" value={data.surname} onChange={onChange} error={errors.surname} placeholder="Ej: Gómez" required />
      </div>
      <Field label="DNI" name="dni" value={data.dni} onChange={onChange} error={errors.dni} placeholder="Sin puntos — Ej: 32145678" required hint="Solo números, sin puntos ni espacios" />
      <Field label="Email" name="email" value={data.email} onChange={onChange} error={errors.email} disabled placeholder="" required />
      <Field label="Teléfono" name="phone" value={data.phone} onChange={onChange} error={errors.phone} placeholder="Ej: +54 9 11 1234 5678" required />
    </div>
  );
}

// ─── Step 2: Password ──────────────────────────────────────────────────────
function StepAcceso({ password, confirmPassword, onPasswordChange, errors, name }) {
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const EyeOpen = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
  const EyeOff = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  const strengthScore = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8)  s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = ["", "Muy débil", "Débil", "Moderada", "Fuerte", "Muy fuerte"][strengthScore];
  const strengthColor = ["", T.error, "#E67E22", "#F1C40F", T.blue, "#27AE60"][strengthScore];

  return (
    <div>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: T.blue, marginBottom: 8 }}>
        Paso 2 de 2
      </p>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 600, color: T.textPrimary, margin: "0 0 6px", lineHeight: 1.25 }}>
        Defina su contraseña
      </h2>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textMuted, fontWeight: 300, margin: "0 0 32px", lineHeight: 1.6 }}>
        Elija una contraseña segura para proteger su acceso a la plataforma.
      </p>

      {/* Summary of step 1 — compact review */}
      {name && (
        <div style={{
          background: "#F8F9FB", border: `1px solid ${T.border}`,
          borderRadius: 8, padding: "12px 16px", marginBottom: 28,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: T.navy, display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "#fff" }}>
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: T.textPrimary }}>
              Registrando como {name}
            </p>
            <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 300, color: T.textMuted }}>
              Paso 1 completado ✓
            </p>
          </div>
        </div>
      )}

      {/* Password field */}
      <div style={{ marginBottom: 20 }}>
        <label style={{
          display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500,
          letterSpacing: "1.5px", textTransform: "uppercase",
          color: errors.password ? T.error : T.textMuted, marginBottom: 6,
        }}>
          Contraseña<span style={{ color: T.blue, marginLeft: 3 }}>*</span>
        </label>
        <div style={{ position: "relative" }}>
          <input
            type={showPass ? "text" : "password"} name="password" value={password}
            onChange={onPasswordChange} placeholder="Mínimo 8 caracteres"
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 44px 12px 14px",
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: T.textPrimary,
              background: T.bgWhite, border: `1px solid ${errors.password ? T.error : T.border}`,
              borderRadius: 6, outline: "none",
            }}
          />
          <button onClick={() => setShowPass(p => !p)} style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: T.textLight, padding: 4,
          }}>
            {showPass ? <EyeOff /> : <EyeOpen />}
          </button>
        </div>
        {/* Strength bar */}
        {password.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= strengthScore ? strengthColor : T.border,
                  transition: "background 0.2s",
                }} />
              ))}
            </div>
            <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: strengthColor }}>{strengthLabel}</p>
          </div>
        )}
        {errors.password && <p style={{ margin: "5px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.error }}>{errors.password}</p>}
      </div>

      {/* Confirm password */}
      <div style={{ marginBottom: 8 }}>
        <label style={{
          display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500,
          letterSpacing: "1.5px", textTransform: "uppercase",
          color: errors.confirmPassword ? T.error : T.textMuted, marginBottom: 6,
        }}>
          Confirmar contraseña<span style={{ color: T.blue, marginLeft: 3 }}>*</span>
        </label>
        <div style={{ position: "relative" }}>
          <input
            type={showConfirm ? "text" : "password"} name="confirmPassword" value={confirmPassword}
            onChange={onPasswordChange} placeholder="Repita su contraseña"
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 44px 12px 14px",
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: T.textPrimary,
              background: T.bgWhite, border: `1px solid ${errors.confirmPassword ? T.error : T.border}`,
              borderRadius: 6, outline: "none",
            }}
          />
          <button onClick={() => setShowConfirm(p => !p)} style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: T.textLight, padding: 4,
          }}>
            {showConfirm ? <EyeOff /> : <EyeOpen />}
          </button>
        </div>
        {/* Match indicator */}
        {confirmPassword.length > 0 && !errors.confirmPassword && (
          <p style={{ margin: "5px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: password === confirmPassword ? "#27AE60" : T.error }}>
            {password === confirmPassword ? "✓ Las contraseñas coinciden" : "Las contraseñas no coinciden"}
          </p>
        )}
        {errors.confirmPassword && <p style={{ margin: "5px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.error }}>{errors.confirmPassword}</p>}
      </div>
    </div>
  );
}

// ─── Token Error Screen ────────────────────────────────────────────────────
function TokenError({ reason }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
      <div style={{ background: T.bgWhite, borderRadius: 12, maxWidth: 480, width: "100%", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(175deg, ${T.navyMid} 0%, ${T.navy} 100%)`, padding: "32px 40px" }}>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#fff" }}>Dentify</span>
        </div>
        <div style={{ padding: "40px 40px 48px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: T.errorBg, border: "1px solid #F5C6C2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.error} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, color: T.textPrimary, margin: "0 0 10px" }}>
            {reason === "expired" ? "La invitación expiró" : reason === "used" ? "Esta invitación ya fue utilizada" : "Invitación inválida"}
          </h2>
          <p style={{ fontSize: 13, fontWeight: 300, color: T.textMuted, lineHeight: 1.7, margin: "0 0 28px" }}>
            {reason === "expired"
              ? "Este enlace de activación ha expirado. Las invitaciones son válidas por 48 horas desde su emisión."
              : reason === "used"
              ? "Esta invitación ya fue aceptada anteriormente. Si cree que es un error, comuníquese con el odontólogo que lo invitó."
              : "Este enlace de activación no es válido o está malformado. Comuníquese con el odontólogo de su clínica."}
          </p>
          <p style={{ fontSize: 11, color: T.textLight, margin: 0 }}>¿Necesita una nueva invitación? Contacte al odontólogo que lo invitó.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Success Screen ────────────────────────────────────────────────────────
function SuccessScreen({ name }) {
  const navigate = useNavigate();
  const nextSteps = [
    { n: 1, title: "Ver turnos del día",         desc: "Revisá la agenda actual y los turnos pendientes de confirmación." },
    { n: 2, title: "Registrar un nuevo paciente", desc: "Cargá el perfil de un paciente y vinculalo a la clínica." },
    { n: 3, title: "Ir al dashboard",             desc: "Accedé a la vista general del sistema." },
  ];
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
      <div style={{ background: T.bgWhite, borderRadius: 12, maxWidth: 520, width: "100%", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(175deg, ${T.navyMid} 0%, ${T.navy} 100%)`, padding: "32px 48px 40px" }}>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#fff" }}>Dentify</span>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(74,158,232,0.15)", border: "1px solid rgba(74,158,232,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 28 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A9EE8" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 600, color: "#fff", margin: "16px 0 8px", lineHeight: 1.2 }}>
            Bienvenida, {name}.
          </h1>
          <p style={{ fontSize: 14, fontWeight: 300, color: "#8AAFCE", margin: 0, lineHeight: 1.6 }}>
            Su cuenta está activa. Ya puede comenzar a gestionar la clínica desde Dentify.
          </p>
        </div>
        <div style={{ padding: "36px 48px 40px" }}>
          <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: T.blue, margin: "0 0 20px" }}>Por dónde empezar</p>
          {nextSteps.map((s, i) => (
            <div key={s.n} style={{ display: "flex", gap: 16, marginBottom: i < nextSteps.length - 1 ? 20 : 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: s.n === 1 ? T.navy : "transparent",
                border: `1.5px solid ${s.n === 1 ? T.navy : T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 500, color: s.n === 1 ? "#fff" : T.textLight,
              }}>{s.n}</div>
              <div style={{ paddingTop: 3 }}>
                <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: s.n === 1 ? 500 : 400, color: s.n === 1 ? T.textPrimary : T.textMuted }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 300, color: T.textLight, lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "24px 48px 36px", display: "flex", gap: 12, flexDirection: "column" }}>
          <button onClick={() => navigate("/turnos")} style={{ padding: "14px 24px", background: T.navy, color: "#fff", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", letterSpacing: "0.3px" }}>
            Ver turnos del día →
          </button>
          <button onClick={() => navigate("/")} style={{ padding: "14px 24px", background: "transparent", color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400, cursor: "pointer" }}>
            Ir al dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Wizard ───────────────────────────────────────────────────────────
export default function SecretaryRegistration() {
  const token = getTokenFromUrl();
  const validationCalled = useRef(false);

  const [tokenStatus, setTokenStatus] = useState("loading");
  const [step, setStep]               = useState(0);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [apiError, setApiError]       = useState(null);

  // Personal data
  const [datos, setDatos] = useState({ name: "", surname: "", dni: "", email: "", phone: "" });

  // Dentist & clinic context (fetched from invitation info)
  const [dentistName, setDentistName] = useState("");
  const [clinicName, setClinicName]   = useState("");

  // Password
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState({});

  // ── Token validation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setTokenStatus("invalid"); return; }
    if (validationCalled.current) return;
    validationCalled.current = true;

    fetch(`${API_BASE}/api/invitations/validate/${encodeURIComponent(token)}`, { method: "POST" })
      .then(async res => {
        if (res.status === 200) {
          const email = await res.text();
          setTokenStatus("valid");
          setDatos(d => ({ ...d, email: email || "" }));
          return;
        }
        if (res.status === 410) { setTokenStatus("expired"); return; }
        if (res.status === 409) { setTokenStatus("used");    return; }
        setTokenStatus("invalid");
      })
      .catch(() => setTokenStatus("invalid"));
  }, [token]);

  // ── Fetch invitation context (dentist + clinic) once token is valid ─────
  // Assumes an endpoint: GET /api/invitations/info/{token}
  // Returns: { dentistName: string, clinicName: string }
  // Gracefully degrades — if the endpoint doesn't exist yet, the card is hidden.
  useEffect(() => {
    if (tokenStatus !== "valid") return;
    fetch(`${API_BASE}/api/invitations/info/${encodeURIComponent(token)}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        if (data.dentistName) setDentistName(data.dentistName);
        if (data.clinicName)  setClinicName(data.clinicName);
      })
      .catch(() => {/* silent — card simply won't render */});
  }, [tokenStatus, token]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleDatosChange = (e) => {
    const { name, value } = e.target;
    setDatos(d => ({ ...d, [name]: value }));
    if (errors[name]) setErrors(er => ({ ...er, [name]: null }));
  };
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    if (name === "password")        setPassword(value);
    if (name === "confirmPassword") setConfirmPassword(value);
    if (errors[name]) setErrors(er => ({ ...er, [name]: null }));
  };

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!datos.name.trim())    e.name    = "El nombre es requerido";
      if (!datos.surname.trim()) e.surname = "El apellido es requerido";
      if (!datos.dni.trim() || !/^\d{7,8}$/.test(datos.dni.replace(/\./g, "")))
        e.dni = "Ingrese un DNI válido (7-8 dígitos)";
      if (!datos.phone.trim())   e.phone   = "El teléfono es requerido";
    }
    if (step === 1) {
      if (!password)              e.password        = "La contraseña es requerida";
      else if (password.length < 8) e.password      = "Mínimo 8 caracteres";
      if (!confirmPassword)       e.confirmPassword = "Confirme su contraseña";
      else if (password !== confirmPassword) e.confirmPassword = "Las contraseñas no coinciden";
    }
    return e;
  };

  const handleNext = () => {
    const e = validateStep();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setStep(s => s + 1);
  };
  const handleBack = () => { setErrors({}); setStep(s => s - 1); };

  const handleSubmit = async () => {
    const e = validateStep();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    setApiError(null);

    // clinic and specialities are intentionally null for secretary role
    const payload = {
      token,
      name:        datos.name.trim(),
      surname:     datos.surname.trim(),
      dni:         datos.dni.trim(),
      email:       datos.email,
      phone:       datos.phone.trim(),
      password,
      clinic:      null,
      specialities: null,
    };

    try {
      const res = await fetch(`${API_BASE}/api/invitations/accept/secretary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) { setApiError("Este email ya tiene una cuenta activa. Intente iniciar sesión."); return; }
      if (res.status === 410) { setTokenStatus("expired"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setApiError(body.message || "Ocurrió un error al procesar el registro. Intente nuevamente.");
        return;
      }
      setSubmitted(true);
    } catch {
      setApiError("No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── States ────────────────────────────────────────────────────────────
  if (tokenStatus === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${T.border}`, borderTopColor: T.blue, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (["invalid", "expired", "used"].includes(tokenStatus)) return <TokenError reason={tokenStatus} />;
  if (submitted) return <SuccessScreen name={datos.name} />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
        html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: ${T.navy}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #B0BCCC; }
        button:focus { outline: 2px solid ${T.blue}; outline-offset: 2px; }

        @media (max-width: 1024px) {
          .reg-sidebar { width: 260px !important; padding: 36px 28px !important; }
          .reg-sidebar-headline { font-size: 22px !important; }
        }
        @media (max-width: 767px) {
          .reg-root    { flex-direction: column !important; height: auto !important; overflow: hidden !important; }
          .reg-sidebar {
            width: 100% !important; height: auto !important; min-height: unset !important;
            padding: 20px 24px !important; flex-direction: row !important;
            align-items: center !important; position: static !important;
          }
          .reg-sidebar-headline-block { display: none !important; }
          .reg-sidebar-trust          { display: none !important; }
          .reg-content { height: calc(100vh - 72px) !important; overflow-y: auto !important; padding: 32px 16px !important; }
          html, body { overflow: auto !important; }
          .reg-root   { height: 100vh !important; overflow: auto !important; }
        }
      `}</style>

      <div className="reg-root" style={{ height: "100vh", overflow: "hidden", display: "flex", fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Left panel ────────────────────────────────────────────────── */}
        <div className="reg-sidebar" style={{
          width: 340, flexShrink: 0, overflowY: "auto",
          background: `linear-gradient(175deg, ${T.navyMid} 0%, ${T.navyLight} 50%, ${T.navy} 100%)`,
          padding: "48px 40px", display: "flex", flexDirection: "column",
        }}>
          {/* Logo */}
          <div style={{ marginBottom: "auto" }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#fff" }}>Dentify</span>
            <span style={{ display: "inline-block", marginLeft: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 400, color: T.blueLight, letterSpacing: "2.5px", textTransform: "uppercase", verticalAlign: "middle" }}>Platform</span>
          </div>

          {/* Headline — secretary-specific copy */}
          <div className="reg-sidebar-headline-block" style={{ marginBottom: "auto", paddingTop: 60 }}>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: T.blueLight, margin: "0 0 14px" }}>Activación de cuenta</p>
            <h2 className="reg-sidebar-headline" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 600, color: "#fff", lineHeight: 1.25, margin: "0 0 16px" }}>
              El equipo de su clínica, ahora completo.
            </h2>
            <p style={{ fontSize: 13, fontWeight: 300, color: "#8AAFCE", lineHeight: 1.7, margin: 0 }}>
              Acceda a Dentify y gestione turnos, pacientes y comunicaciones de la clínica desde una plataforma diseñada para que el trabajo administrativo fluya sin fricciones.
            </p>
          </div>

          {/* Trust signals */}
          <div className="reg-sidebar-trust" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 28 }}>
            {[
              { icon: "🔒", text: "Conexión cifrada SSL" },
              { icon: "🏥", text: "Datos clínicos protegidos" },
              { icon: "📋", text: "Cumplimiento normativo Argentina" },
            ].map(item => (
              <div key={item.text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>{item.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 300, color: "#3D5A8A" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────────────── */}
        <div className="reg-content" style={{
          flex: 1, overflowY: "auto", background: T.bg,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: "60px 24px",
        }}>
          <div style={{ width: "100%", maxWidth: 520 }}>

            <StepIndicator step={step} />

            {/* Form card */}
            <div style={{ background: T.bgWhite, borderRadius: 10, border: `1px solid ${T.border}`, padding: "36px 40px 32px" }}>
              {step === 0 && (
                <StepDatos
                  data={datos}
                  onChange={handleDatosChange}
                  errors={errors}
                  dentistName={dentistName}
                  clinicName={clinicName}
                />
              )}
              {step === 1 && (
                <StepAcceso
                  password={password}
                  confirmPassword={confirmPassword}
                  onPasswordChange={handlePasswordChange}
                  errors={errors}
                  name={datos.name}
                />
              )}

              {apiError && (
                <div style={{ background: T.errorBg, border: "1px solid #F5C6C2", borderRadius: 6, padding: "12px 16px", marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 12, color: T.error, fontWeight: 400 }}>{apiError}</p>
                </div>
              )}

              {/* Navigation */}
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 24, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {step > 0 ? (
                  <button onClick={handleBack} style={{ background: "none", border: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textMuted, cursor: "pointer", padding: "10px 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
                    Volver
                  </button>
                ) : <div />}

                {step < 1 ? (
                  <button onClick={handleNext} style={{ padding: "12px 32px", background: T.navy, color: "#fff", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", letterSpacing: "0.3px" }}>
                    Continuar →
                  </button>
                ) : (
                  <button onClick={handleSubmit} disabled={submitting} style={{
                    padding: "12px 32px",
                    background: submitting ? "#3D5A8A" : T.blue,
                    color: "#fff", border: "none", borderRadius: 6,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                    cursor: submitting ? "not-allowed" : "pointer", letterSpacing: "0.3px",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    {submitting && (
                      <span style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                    )}
                    {submitting ? "Activando cuenta..." : "Activar cuenta"}
                  </button>
                )}
              </div>
            </div>

            <p style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: T.textLight, lineHeight: 1.6 }}>
              Al activar su cuenta acepta los términos de uso de Dentify.<br />
              ¿Problemas? Contacte al odontólogo que lo invitó.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}