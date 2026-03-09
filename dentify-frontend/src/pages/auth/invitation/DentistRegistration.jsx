import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

// ─── Design tokens ─────────────────────────────────────────────────────────
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
function validateCuit(v) { return /^\d{2}-\d{8}-\d{1}$/.test(v); }
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

// ─── Step Indicator ────────────────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ["Perfil profesional", "Datos de clínica", "Especialidades"];
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
            textAlign: i === 0 ? "left" : i === steps.length - 1 ? "right" : "center",
            flex: 1,
          }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1 ────────────────────────────────────────────────────────────────
function StepPerfil({ data, onChange, errors }) {
  return (
    <div>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: T.blue, marginBottom: 8 }}>
        Paso 1 de 3
      </p>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 600, color: T.textPrimary, margin: "0 0 6px", lineHeight: 1.25 }}>
        Su perfil profesional
      </h2>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textMuted, fontWeight: 300, margin: "0 0 32px", lineHeight: 1.6 }}>
        Complete sus datos personales. Esta información quedará asociada a su cuenta.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
        <Field label="Nombre" name="name" value={data.name} onChange={onChange} error={errors.name} placeholder="Ej: Martín" required />
        <Field label="Apellido" name="surname" value={data.surname} onChange={onChange} error={errors.surname} placeholder="Ej: López" required />
      </div>
      <Field label="DNI" name="dni" value={data.dni} onChange={onChange} error={errors.dni} placeholder="Sin puntos — Ej: 32145678" required hint="Solo números, sin puntos ni espacios" />
      <Field label="Email" name="email" value={data.email} onChange={onChange} error={errors.email} disabled placeholder="" required />
      <Field label="Teléfono" name="phone" value={data.phone} onChange={onChange} error={errors.phone} placeholder="Ej: +54 9 11 1234 5678" required />
    </div>
  );
}

// ─── Step 2 ────────────────────────────────────────────────────────────────
function StepClinica({ data, onChange, errors }) {
  return (
    <div>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: T.blue, marginBottom: 8 }}>
        Paso 2 de 3
      </p>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 600, color: T.textPrimary, margin: "0 0 6px", lineHeight: 1.25 }}>
        Su clínica
      </h2>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textMuted, fontWeight: 300, margin: "0 0 32px", lineHeight: 1.6 }}>
        Estos datos identifican al establecimiento en el sistema. Pueden editarse luego desde configuración.
      </p>
      <Field label="Nombre de la clínica" name="clinicName" value={data.clinicName} onChange={onChange} error={errors.clinicName} placeholder="Ej: Centro Odontológico López" required />
      <Field label="Dirección" name="clinicDirection" value={data.clinicDirection} onChange={onChange} error={errors.clinicDirection} placeholder="Ej: Av. Corrientes 1234, CABA" required />
      <Field label="CUIT" name="clinicCuit" value={data.clinicCuit} onChange={onChange} error={errors.clinicCuit} placeholder="Ej: 20-32145678-9" required hint="Formato: XX-XXXXXXXX-X" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
        <Field label="Teléfono de clínica" name="clinicPhone" value={data.clinicPhone} onChange={onChange} error={errors.clinicPhone} placeholder="Ej: 011 4321 5678" />
        <Field label="Email de clínica" name="clinicEmail" value={data.clinicEmail} onChange={onChange} error={errors.clinicEmail} placeholder="Ej: contacto@clinica.com" />
      </div>
    </div>
  );
}

// ─── Step 3 ────────────────────────────────────────────────────────────────
function StepEspecialidades({ specialities, specialitiesLoading, selectedIds, onToggle, password, confirmPassword, onPasswordChange, errors }) {
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: T.blue, marginBottom: 8 }}>
        Paso 3 de 3
      </p>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 600, color: T.textPrimary, margin: "0 0 6px", lineHeight: 1.25 }}>
        Especialidades y acceso
      </h2>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.textMuted, fontWeight: 300, margin: "0 0 28px", lineHeight: 1.6 }}>
        Seleccione sus especialidades clínicas y defina su contraseña de acceso.
      </p>

      <div style={{ marginBottom: 28 }}>
        <label style={{
          display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 11,
          fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase",
          color: errors.specialities ? T.error : T.textMuted, marginBottom: 10,
        }}>
          Especialidades<span style={{ color: T.blue, marginLeft: 3 }}>*</span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 40 }}>
          {specialitiesLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${T.border}`, borderTopColor: T.blue, animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: T.textLight }}>Cargando especialidades...</span>
            </div>
          ) : specialities.length === 0 ? (
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: T.textLight }}>
              No se pudieron cargar las especialidades. Intente recargar la página.
            </span>
          ) : (
            specialities.map(sp => {
              const active = selectedIds.includes(sp.id);
              return (
                <button key={sp.id} onClick={() => onToggle(sp.id)} style={{
                  padding: "8px 16px", fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12, fontWeight: active ? 500 : 400,
                  background: active ? T.navy : T.bgWhite,
                  color: active ? "#fff" : T.textMuted,
                  border: `1px solid ${active ? T.navy : T.border}`,
                  borderRadius: 20, cursor: "pointer", transition: "all 0.15s",
                }}>
                  {active && <span style={{ marginRight: 5, fontSize: 10 }}>✓</span>}
                  {sp.name}
                </button>
              );
            })
          )}
        </div>
        {errors.specialities && (
          <p style={{ margin: "6px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.error }}>{errors.specialities}</p>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 24 }}>
        {/* Password */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase", color: errors.password ? T.error : T.textMuted, marginBottom: 6 }}>
            Contraseña<span style={{ color: T.blue, marginLeft: 3 }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"} name="password" value={password}
              onChange={onPasswordChange} placeholder="Mínimo 8 caracteres"
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 44px 12px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: T.textPrimary, background: T.bgWhite, border: `1px solid ${errors.password ? T.error : T.border}`, borderRadius: 6, outline: "none" }}
            />
            <button onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textLight, padding: 4 }}>
              {showPass
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          {errors.password && <p style={{ margin: "5px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.error }}>{errors.password}</p>}
        </div>

        {/* Confirm password */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase", color: errors.confirmPassword ? T.error : T.textMuted, marginBottom: 6 }}>
            Confirmar contraseña<span style={{ color: T.blue, marginLeft: 3 }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showConfirm ? "text" : "password"} name="confirmPassword" value={confirmPassword}
              onChange={onPasswordChange} placeholder="Repita su contraseña"
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 44px 12px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: T.textPrimary, background: T.bgWhite, border: `1px solid ${errors.confirmPassword ? T.error : T.border}`, borderRadius: 6, outline: "none" }}
            />
            <button onClick={() => setShowConfirm(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textLight, padding: 4 }}>
              {showConfirm
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          {errors.confirmPassword && <p style={{ margin: "5px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.error }}>{errors.confirmPassword}</p>}
        </div>
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
              ? "Esta invitación ya fue aceptada anteriormente. Si cree que es un error, comuníquese con el administrador de su clínica."
              : "Este enlace de activación no es válido o está malformado. Comuníquese con el administrador de su clínica."}
          </p>
          <p style={{ fontSize: 11, color: T.textLight, margin: 0 }}>¿Necesita una nueva invitación? Contacte al administrador de su clínica.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Success Screen ────────────────────────────────────────────────────────
function SuccessScreen({ name }) {
  const navigate = useNavigate();
  const nextSteps = [
    { n: 1, title: "Configure su primera agenda", desc: "Defina sus bloques horarios y duración de turnos." },
    { n: 2, title: "Registre sus primeros pacientes", desc: "Cargue el historial de pacientes existentes." },
    { n: 3, title: "Empiece a operar", desc: "Asigne turnos y monitoree cobros desde el primer día." },
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
            Bienvenido, Dr. {name}.
          </h1>
          <p style={{ fontSize: 14, fontWeight: 300, color: "#8AAFCE", margin: 0, lineHeight: 1.6 }}>
            Su cuenta está activa. Para comenzar a operar, le recomendamos completar los siguientes pasos.
          </p>
        </div>
        <div style={{ padding: "36px 48px 40px" }}>
          <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: T.blue, margin: "0 0 20px" }}>Próximos pasos</p>
          {nextSteps.map((s, i) => (
            <div key={s.n} style={{ display: "flex", gap: 16, marginBottom: i < nextSteps.length - 1 ? 20 : 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: s.n === 1 ? T.navy : "transparent", border: `1.5px solid ${s.n === 1 ? T.navy : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: s.n === 1 ? "#fff" : T.textLight }}>
                {s.n}
              </div>
              <div style={{ paddingTop: 3 }}>
                <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: s.n === 1 ? 500 : 400, color: s.n === 1 ? T.textPrimary : T.textMuted }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 300, color: T.textLight, lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "24px 48px 36px", display: "flex", gap: 12, flexDirection: "column" }}>
          <button onClick={() => navigate("/agendas/nueva")} style={{ padding: "14px 24px", background: T.navy, color: "#fff", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", letterSpacing: "0.3px" }}>
            Configurar primera agenda →
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
export default function DentistRegistration() {
  const token = getTokenFromUrl();

  // ── FIX 1: useRef guard — prevents double call from React StrictMode ──────
  // React StrictMode (development) intentionally mounts → unmounts → remounts
  // components to surface impure side effects. Without this guard, the fetch
  // fires twice on every mount in dev. The ref persists across remounts within
  // the same render tree, so the second mount finds it already true and skips.
  const validationCalled = useRef(false);

  const [tokenStatus, setTokenStatus] = useState("loading");
  const [step, setStep]               = useState(0);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [apiError, setApiError]       = useState(null);

  const [perfil, setPerfil]   = useState({ name: "", surname: "", dni: "", email: "", phone: "" });
  const [clinica, setClinica] = useState({ clinicName: "", clinicDirection: "", clinicCuit: "", clinicPhone: "", clinicEmail: "" });
  const [selectedSpecialities, setSelectedSpecialities] = useState([]);
  const [specialitiesList, setSpecialitiesList]         = useState([]);
  const [specialitiesLoading, setSpecialitiesLoading]   = useState(false);
  const [password, setPassword]           = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});

  // ── Token validation — runs once, guarded by ref ──────────────────────────
  useEffect(() => {
    if (!token) { setTokenStatus("invalid"); return; }
    if (validationCalled.current) return;
    validationCalled.current = true;

    fetch(`${API_BASE}/api/invitations/validate/${encodeURIComponent(token)}`, { method: "POST" })
      .then(async res => {
        if (res.status === 200) {
          const email = await res.text();
          setTokenStatus("valid");
          setPerfil(p => ({ ...p, email: email || "" }));
          return;
        }
        if (res.status === 410) { setTokenStatus("expired"); return; }
        if (res.status === 409) { setTokenStatus("used");    return; }
        setTokenStatus("invalid");
      })
      .catch(() => setTokenStatus("invalid"));
  }, [token]);

  // ── Load specialities once token is valid ─────────────────────────────────
  useEffect(() => {
    if (tokenStatus !== "valid") return;
    setSpecialitiesLoading(true);
    fetch(`${API_BASE}/api/specialities/find-all`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data  => setSpecialitiesList(data))
      .catch(()   => setSpecialitiesList([]))
      .finally(() => setSpecialitiesLoading(false));
  }, [tokenStatus]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePerfilChange = (e) => {
    const { name, value } = e.target;
    setPerfil(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(er => ({ ...er, [name]: null }));
  };
  const handleClinicaChange = (e) => {
    const { name, value } = e.target;
    setClinica(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(er => ({ ...er, [name]: null }));
  };
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    if (name === "password")        setPassword(value);
    if (name === "confirmPassword") setConfirmPassword(value);
    if (errors[name]) setErrors(er => ({ ...er, [name]: null }));
  };
  const toggleSpeciality = (id) => {
    setSelectedSpecialities(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (errors.specialities) setErrors(er => ({ ...er, specialities: null }));
  };

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!perfil.name.trim())    e.name    = "El nombre es requerido";
      if (!perfil.surname.trim()) e.surname = "El apellido es requerido";
      if (!perfil.dni.trim() || !/^\d{7,8}$/.test(perfil.dni.replace(/\./g, "")))
        e.dni = "Ingrese un DNI válido (7-8 dígitos)";
      if (!perfil.phone.trim())   e.phone   = "El teléfono es requerido";
    }
    if (step === 1) {
      if (!clinica.clinicName.trim())      e.clinicName      = "El nombre de la clínica es requerido";
      if (!clinica.clinicDirection.trim()) e.clinicDirection = "La dirección es requerida";
      if (!clinica.clinicCuit.trim())      e.clinicCuit      = "El CUIT es requerido";
      else if (!validateCuit(clinica.clinicCuit)) e.clinicCuit = "Formato inválido. Use XX-XXXXXXXX-X";
      if (clinica.clinicEmail && !validateEmail(clinica.clinicEmail)) e.clinicEmail = "Ingrese un email válido";
    }
    if (step === 2) {
      if (selectedSpecialities.length === 0) e.specialities = "Seleccione al menos una especialidad";
      if (!password)             e.password        = "La contraseña es requerida";
      else if (password.length < 8) e.password     = "Mínimo 8 caracteres";
      if (!confirmPassword)      e.confirmPassword = "Confirme su contraseña";
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

    const payload = {
      token,
      name:     perfil.name.trim(),
      surname:  perfil.surname.trim(),
      dni:      perfil.dni.trim(),
      email:    perfil.email,
      phone:    perfil.phone.trim(),
      password,
      clinic: {
        clinicName:      clinica.clinicName.trim(),
        clinicDirection: clinica.clinicDirection.trim(),
        clinicCuit:      clinica.clinicCuit.trim(),
        clinicPhone:     clinica.clinicPhone.trim() || null,
        clinicEmail:     clinica.clinicEmail.trim() || null,
      },
      specialities: selectedSpecialities,
    };

    try {
      const res = await fetch(`${API_BASE}/api/invitations/accept/dentist`, {
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

  // ── Loading / Error / Success states ──────────────────────────────────────
  if (tokenStatus === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${T.border}`, borderTopColor: T.blue, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (["invalid", "expired", "used"].includes(tokenStatus)) return <TokenError reason={tokenStatus} />;
  if (submitted) return <SuccessScreen name={perfil.name} />;

  // ────────────────────────────────────────────────────────────────────────
  // FIX 2: Layout — root causes and solutions
  //
  // Problem A — White borders on scroll:
  //   The outer wrapper used `minHeight: 100vh` which allows it to grow taller
  //   than the viewport. When the left panel is `position: sticky / height: 100vh`
  //   but the outer div is taller, the body background (#F4F3F0) bleeds through
  //   as white gaps at the top/bottom on scroll.
  //   Fix: outer wrapper gets `height: 100vh` + `overflow: hidden`. The layout
  //   is now exactly the viewport — nothing outside it.
  //
  // Problem B — Left sidebar not filling height / floating:
  //   `position: sticky` on a flex child doesn't behave like `position: fixed`.
  //   The sidebar was sticky within the scrolling parent but its height wasn't
  //   guaranteed to fill the flex row if the right panel was shorter.
  //   Fix: remove `position: sticky`. With the outer at `height: 100vh` and
  //   `overflow: hidden`, the left panel naturally fills the full height as a
  //   flex child. `overflowY: auto` on the left panel handles rare overflow.
  //
  // Problem C — Right panel scroll:
  //   Only the right panel gets `overflowY: auto`. This is the standard SaaS
  //   pattern: a fixed chrome (sidebar) with a scrollable content area.
  //
  // Responsive:
  //   Below 768px the sidebar collapses to a top header bar. The form content
  //   takes full width. No layout shifts, no floating panels.
  // ────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
        
        /* Reset — ensure html/body don't add their own scroll or bg */
        html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: ${T.navy}; }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #B0BCCC; }
        button:focus { outline: 2px solid ${T.blue}; outline-offset: 2px; }

        /* ── Responsive: tablet & mobile ─────────────────────────── */

        /* Tablet (768px–1024px): narrow sidebar */
        @media (max-width: 1024px) {
          .reg-sidebar { width: 260px !important; padding: 36px 28px !important; }
          .reg-sidebar-headline { font-size: 22px !important; }
          .reg-sidebar-body { padding-top: 32px !important; }
        }

        /* Mobile (<768px): sidebar becomes a top bar, form goes full-width */
        @media (max-width: 767px) {
          .reg-root    { flex-direction: column !important; height: auto !important; overflow: hidden !important; }
          .reg-sidebar {
            width: 100% !important;
            height: auto !important;
            min-height: unset !important;
            padding: 20px 24px !important;
            flex-direction: row !important;
            align-items: center !important;
            position: static !important;
          }
          .reg-sidebar-logo    { margin-bottom: 0 !important; }
          .reg-sidebar-headline-block { display: none !important; }
          .reg-sidebar-trust   { display: none !important; }
          .reg-content {
            height: calc(100vh - 72px) !important;
            overflow-y: auto !important;
            padding: 32px 16px !important;
          }
          html, body { overflow: auto !important; }
          .reg-root   { height: 100vh !important; overflow: auto !important; }
        }
      `}</style>

      {/*
        Outer wrapper:
        - `height: 100vh`     → exactly the viewport, never grows beyond it
        - `overflow: hidden`  → clips both panels; only the right panel scrolls
        - `display: flex`     → side-by-side layout
      */}
      <div
        className="reg-root"
        style={{
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* ── Left panel ─────────────────────────────────────────────────
            - No longer `position: sticky` — it fills the flex row naturally
            - `flexShrink: 0` prevents it from squeezing
            - `overflowY: auto` handles edge-case overflow on very small screens
        */}
        <div
          className="reg-sidebar"
          style={{
            width: 340,
            flexShrink: 0,
            overflowY: "auto",
            background: `linear-gradient(175deg, ${T.navyMid} 0%, ${T.navyLight} 50%, ${T.navy} 100%)`,
            padding: "48px 40px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Logo */}
          <div className="reg-sidebar-logo" style={{ marginBottom: "auto" }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#fff" }}>Dentify</span>
            <span style={{ display: "inline-block", marginLeft: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 400, color: T.blueLight, letterSpacing: "2.5px", textTransform: "uppercase", verticalAlign: "middle" }}>Platform</span>
          </div>

          {/* Headline */}
          <div className="reg-sidebar-headline-block" style={{ marginBottom: "auto", paddingTop: 60 }}>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: T.blueLight, margin: "0 0 14px" }}>Activación de cuenta</p>
            <h2
              className="reg-sidebar-headline"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 600, color: "#fff", lineHeight: 1.25, margin: "0 0 16px" }}
            >
              Su clínica, organizada y bajo control.
            </h2>
            <p className="reg-sidebar-body" style={{ fontSize: 13, fontWeight: 300, color: "#8AAFCE", lineHeight: 1.7, margin: 0 }}>
              Acceda a Dentify y gestione turnos, pacientes y operaciones clínicas desde una plataforma diseñada para odontólogos que valoran eficiencia, orden y profesionalismo.
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

        {/* ── Right panel ─────────────────────────────────────────────────
            - `flex: 1`         → takes remaining width
            - `overflowY: auto` → THIS is the only scrollable surface
            - `background: T.bg`→ fills the entire scroll area, no white gaps
        */}
        <div
          className="reg-content"
          style={{
            flex: 1,
            overflowY: "auto",
            background: T.bg,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "60px 24px",
          }}
        >
          <div style={{ width: "100%", maxWidth: 520 }}>

            <StepIndicator step={step} />

            {/* Form card */}
            <div style={{ background: T.bgWhite, borderRadius: 10, border: `1px solid ${T.border}`, padding: "36px 40px 32px" }}>
              {step === 0 && <StepPerfil data={perfil} onChange={handlePerfilChange} errors={errors} />}
              {step === 1 && <StepClinica data={clinica} onChange={handleClinicaChange} errors={errors} />}
              {step === 2 && (
                <StepEspecialidades
                  specialities={specialitiesList}
                  specialitiesLoading={specialitiesLoading}
                  selectedIds={selectedSpecialities}
                  onToggle={toggleSpeciality}
                  password={password}
                  confirmPassword={confirmPassword}
                  onPasswordChange={handlePasswordChange}
                  errors={errors}
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

                {step < 2 ? (
                  <button onClick={handleNext} style={{ padding: "12px 32px", background: T.navy, color: "#fff", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", letterSpacing: "0.3px" }}>
                    Continuar →
                  </button>
                ) : (
                  <button onClick={handleSubmit} disabled={submitting} style={{ padding: "12px 32px", background: submitting ? "#3D5A8A" : T.blue, color: "#fff", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: submitting ? "not-allowed" : "pointer", letterSpacing: "0.3px", display: "flex", alignItems: "center", gap: 8 }}>
                    {submitting && <span style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", display: "inline-block", animation: "spin 0.8s linear infinite" }} />}
                    {submitting ? "Activando cuenta..." : "Activar cuenta"}
                  </button>
                )}
              </div>
            </div>

            <p style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: T.textLight, lineHeight: 1.6 }}>
              Al activar su cuenta acepta los términos de uso de Dentify.<br />
              ¿Problemas? Contacte al administrador de su clínica.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}