// ════════════════════════════════════════════════════════════════
// CreatePatientView.tsx
// Dentify — Vista: Crear Paciente
// ════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from "react";
import apiClient from "../../api/apiClient";

// ════════════════════════════════════════════════════════════════
// 1. DESIGN TOKENS
// ════════════════════════════════════════════════════════════════
const C = {
  navy:          "#0A1628",
  electric:      "#1A6FD4",
  electricBright:"#4A9EE8",
  bg:            "#F4F3F0",
  cardBg:        "#FFFFFF",
  panelBg:       "#F8F8F6",
  border:        "#E4E6EC",
  borderPanel:   "#E8EFF6",
  textPrimary:   "#0A1628",
  textSecondary: "#5A6A7A",
  textMuted:     "#6A7A8A",
  error:         "#DC2626",
  errorBg:       "rgba(220,38,38,0.07)",
  success:       "#065F46",
  successBg:     "#ECFDF5",
  warningBg:     "#FFFBEB",
  warningBorder: "#FDE68A",
  warningText:   "#92400E",
};

const FONT_SANS  = "'DM Sans', Arial, sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

// ════════════════════════════════════════════════════════════════
// 2. TYPES & INTERFACES
// ════════════════════════════════════════════════════════════════
type CoverageType = "SELF_PAY" | "HEALTH_INSURANCE" | "PREPAID_INSURANCE" | "OTHER";

type Relation =
  | "FATHER_MOTHER"
  | "LEGAL_GUARDIAN"
  | "GRANDFATHER_GRANDMOTHER"
  | "UNCLE_AUNT"
  | "OLDER_BROTHER"
  | "OTHER";

interface PatientFormState {
  dni:          string;
  name:         string;
  surname:      string;
  dateOfBirth:  string;
  coverageType: CoverageType | "";
  insurance:    string;
  phoneNumber:  string;
  email:        string;
}

interface ResponsibleAdultFormState {
  dni:         string;
  name:        string;
  surname:     string;
  phone_number:string;
  email:       string;
  relation:    Relation | "";
}

type PatientFieldErrors = Partial<Record<keyof PatientFormState, string>>;
type AdultFieldErrors   = Partial<Record<keyof ResponsibleAdultFormState, string>>;

interface CreatePatientViewProps {
  onNavigate: (section: string) => void;
}

interface CreatePatientRequestDTO {
  dni:                 string;
  name:                string;
  surname:             string;
  dateOfBirth:         string;
  insurance?:          string | null;
  coverageType:        CoverageType;
  phoneNumber?:        string | null;
  email?:              string | null;
  responsibleAdultList?: ResponsibleAdultDTO[] | null;
}

interface ResponsibleAdultDTO {
  dni:          string;
  name:         string;
  surname:      string;
  phone_number?: string | null;
  email:        string;
  relation:     Relation;
}

// ════════════════════════════════════════════════════════════════
// 3. CONSTANTS
// ════════════════════════════════════════════════════════════════
const COVERAGE_OPTIONS: { value: CoverageType; label: string }[] = [
  { value: "SELF_PAY",          label: "Particular"  },
  { value: "HEALTH_INSURANCE",  label: "Obra Social" },
  { value: "PREPAID_INSURANCE", label: "Prepaga"     },
  { value: "OTHER",             label: "Otro"        },
];

const RELATION_OPTIONS: { value: Relation; label: string }[] = [
  { value: "FATHER_MOTHER",          label: "Padre / Madre"     },
  { value: "LEGAL_GUARDIAN",         label: "Tutor legal"       },
  { value: "GRANDFATHER_GRANDMOTHER",label: "Abuelo / Abuela"   },
  { value: "UNCLE_AUNT",             label: "Tío / Tía"         },
  { value: "OLDER_BROTHER",          label: "Hermano mayor"     },
  { value: "OTHER",                  label: "Otro"              },
];

const INITIAL_FORM: PatientFormState = {
  dni:          "",
  name:         "",
  surname:      "",
  dateOfBirth:  "",
  coverageType: "",
  insurance:    "",
  phoneNumber:  "",
  email:        "",
};

const INITIAL_ADULT = (): ResponsibleAdultFormState => ({
  dni:          "",
  name:         "",
  surname:      "",
  phone_number: "",
  email:        "",
  relation:     "",
});

// ════════════════════════════════════════════════════════════════
// 4. UTILS
// ════════════════════════════════════════════════════════════════
function calcularEdad(dob: string): number {
  if (!dob) return 99;
  const birth = new Date(dob + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9]{7,15}$/;
const DNI_RE   = /^[0-9]{7,8}$/;

function validatePatientField(
  field: keyof PatientFormState,
  value: string,
  isMinor: boolean,
): string {
  switch (field) {
    case "dni":
      if (!value.trim()) return "El DNI es obligatorio.";
      if (!DNI_RE.test(value.trim())) return "El DNI debe tener 7 u 8 dígitos numéricos.";
      return "";
    case "name":
      if (!value.trim()) return "El nombre es obligatorio.";
      if (value.trim().length > 100) return "Máximo 100 caracteres.";
      return "";
    case "surname":
      if (!value.trim()) return "El apellido es obligatorio.";
      if (value.trim().length > 100) return "Máximo 100 caracteres.";
      return "";
    case "dateOfBirth": {
      if (!value) return "La fecha de nacimiento es obligatoria.";
      const d = new Date(value + "T00:00:00");
      if (isNaN(d.getTime())) return "Fecha inválida.";
      if (d >= new Date()) return "La fecha debe ser pasada.";
      return "";
    }
    case "coverageType":
      if (!value) return "Seleccioná un tipo de cobertura.";
      return "";
    case "email":
      if (!isMinor && !value.trim()) return "El email es obligatorio para pacientes adultos.";
      if (value.trim() && !EMAIL_RE.test(value.trim())) return "El formato del email no es válido.";
      if (value.trim().length > 150) return "Máximo 150 caracteres.";
      return "";
    case "phoneNumber":
      if (value.trim() && !PHONE_RE.test(value.trim())) return "Formato de teléfono inválido (7–15 dígitos).";
      return "";
    case "insurance":
      if (value.trim().length > 100) return "Máximo 100 caracteres.";
      return "";
    default:
      return "";
  }
}

function validateAdultField(
  field: keyof ResponsibleAdultFormState,
  value: string,
): string {
  switch (field) {
    case "dni":
      if (!value.trim()) return "El DNI es obligatorio.";
      if (!DNI_RE.test(value.trim())) return "El DNI debe tener 7 u 8 dígitos numéricos.";
      return "";
    case "name":
      if (!value.trim()) return "El nombre es obligatorio.";
      if (value.trim().length > 100) return "Máximo 100 caracteres.";
      return "";
    case "surname":
      if (!value.trim()) return "El apellido es obligatorio.";
      if (value.trim().length > 100) return "Máximo 100 caracteres.";
      return "";
    case "email":
      if (!value.trim()) return "El email es obligatorio.";
      if (!EMAIL_RE.test(value.trim())) return "El formato del email no es válido.";
      if (value.trim().length > 150) return "Máximo 150 caracteres.";
      return "";
    case "phone_number":
      if (value.trim() && !PHONE_RE.test(value.trim())) return "Formato de teléfono inválido (7–15 dígitos).";
      return "";
    case "relation":
      if (!value) return "Seleccioná la relación con el paciente.";
      return "";
    default:
      return "";
  }
}

function mapBackendError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("already") || lower.includes("exists")) return "Ya existe un paciente con ese DNI registrado en el sistema.";
  if (lower.includes("minor") || lower.includes("responsible")) return "El paciente es menor de edad y requiere al menos un adulto responsable.";
  if (lower.includes("email")) return "El email del paciente es obligatorio para pacientes adultos.";
  if (lower.includes("coverage")) return "El tipo de cobertura indicado no es válido.";
  if (lower.includes("dni")) return "El DNI ingresado no es válido.";
  return "Ocurrió un error al registrar el paciente. Revisá los datos e intentá nuevamente.";
}

// ════════════════════════════════════════════════════════════════
// 5. SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════

// ── Field Wrapper ──
interface FieldWrapperProps {
  label:     string;
  htmlFor:   string;
  error?:    string;
  required?: boolean;
  children:  React.ReactNode;
}
function FieldWrapper({ label, htmlFor, error, required, children }: FieldWrapperProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontFamily:    FONT_SANS,
          fontSize:      9.5,
          fontWeight:    700,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color:         C.textMuted,
        }}
      >
        {label}
        {required && (
          <span style={{ color: C.error, marginLeft: 2 }}>*</span>
        )}
      </label>
      {children}
      {error && (
        <span
          role="alert"
          style={{
            fontFamily: FONT_SANS,
            fontSize:   11.5,
            color:      C.error,
            lineHeight: 1.4,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

// ── Styled Input ──
interface StyledInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}
function StyledInput({ hasError, style, ...props }: StyledInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      aria-invalid={hasError ? "true" : "false"}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
      style={{
        width:        "100%",
        padding:      "11px 14px",
        border:       `1.5px solid ${hasError ? C.error : focused ? C.electric : C.borderPanel}`,
        borderRadius: 8,
        fontFamily:   FONT_SANS,
        fontSize:     14,
        fontWeight:   300,
        color:        C.textPrimary,
        background:   "#FFFFFF",
        outline:      "none",
        boxShadow:    hasError
          ? `0 0 0 3px ${C.errorBg}`
          : focused
          ? "0 0 0 3px rgba(26,111,212,0.08)"
          : "none",
        transition:   "border-color 0.15s, box-shadow 0.15s",
        boxSizing:    "border-box" as const,
        ...style,
      }}
    />
  );
}

// ── Styled Select ──
interface StyledSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}
function StyledSelect({ hasError, style, children, ...props }: StyledSelectProps) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...props}
      aria-invalid={hasError ? "true" : "false"}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
      style={{
        width:        "100%",
        padding:      "11px 14px",
        border:       `1.5px solid ${hasError ? C.error : focused ? C.electric : C.borderPanel}`,
        borderRadius: 8,
        fontFamily:   FONT_SANS,
        fontSize:     14,
        fontWeight:   300,
        color:        props.value ? C.textPrimary : C.textMuted,
        background:   "#FFFFFF",
        outline:      "none",
        appearance:   "none" as const,
        WebkitAppearance: "none" as const,
        cursor:       "pointer",
        boxShadow:    hasError
          ? `0 0 0 3px ${C.errorBg}`
          : focused
          ? "0 0 0 3px rgba(26,111,212,0.08)"
          : "none",
        transition:   "border-color 0.15s, box-shadow 0.15s",
        boxSizing:    "border-box" as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236A7A8A' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
        backgroundRepeat:   "no-repeat",
        backgroundPosition: "right 14px center",
        paddingRight:       "36px",
        ...style,
      }}
    >
      {children}
    </select>
  );
}

// ── Form Section ──
interface FormSectionProps {
  eyebrow: string;
  title?:  string;
  children: React.ReactNode;
  style?:  React.CSSProperties;
}
function FormSection({ eyebrow, children, style }: FormSectionProps) {
  return (
    <div style={{
      background:   "#FFFFFF",
      border:       `1px solid ${C.border}`,
      borderRadius: 12,
      padding:      "28px 32px",
      marginBottom: 20,
      boxShadow:    "0 2px 12px rgba(15,34,68,0.04)",
      ...style,
    }}>
      <div style={{ marginBottom: 20 }}>
        <span style={{
          display:       "block",
          fontFamily:    FONT_SANS,
          fontSize:      9.5,
          fontWeight:    700,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          color:         C.electric,
          marginBottom:  4,
        }}>
          {eyebrow}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Responsible Adult Card ──
interface ResponsibleAdultCardProps {
  index:    number;
  adult:    ResponsibleAdultFormState;
  errors:   AdultFieldErrors;
  onChange: (field: keyof ResponsibleAdultFormState, value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}
function ResponsibleAdultCard({ index, adult, errors, onChange, onRemove, canRemove }: ResponsibleAdultCardProps) {
  return (
    <div style={{
      background:   C.panelBg,
      border:       `1px solid ${C.borderPanel}`,
      borderRadius: 10,
      padding:      "22px 24px",
      marginBottom: 16,
    }}>
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        marginBottom:   18,
      }}>
        <span style={{
          fontFamily:    FONT_SANS,
          fontSize:      11,
          fontWeight:    700,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color:         C.textMuted,
        }}>
          Responsable #{index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              fontFamily:  FONT_SANS,
              fontSize:    12,
              fontWeight:  500,
              color:       "#B91C1C",
              background:  "transparent",
              border:      "none",
              cursor:      "pointer",
              padding:     "4px 0",
              letterSpacing: "0.01em",
            }}
          >
            × Eliminar responsable
          </button>
        )}
      </div>

      {/* Row 1: DNI + Relación */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 14 }}>
        <FieldWrapper label="DNI" htmlFor={`adult-dni-${index}`} error={errors.dni} required>
          <StyledInput
            id={`adult-dni-${index}`}
            value={adult.dni}
            onChange={(e) => onChange("dni", e.target.value)}
            placeholder="12345678"
            maxLength={8}
            hasError={!!errors.dni}
          />
        </FieldWrapper>
        <FieldWrapper label="Relación con el paciente" htmlFor={`adult-relation-${index}`} error={errors.relation} required>
          <StyledSelect
            id={`adult-relation-${index}`}
            value={adult.relation}
            onChange={(e) => onChange("relation", e.target.value)}
            hasError={!!errors.relation}
          >
            <option value="">Seleccionar relación...</option>
            {RELATION_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </StyledSelect>
        </FieldWrapper>
      </div>

      {/* Row 2: Nombre + Apellido */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 14 }}>
        <FieldWrapper label="Nombre" htmlFor={`adult-name-${index}`} error={errors.name} required>
          <StyledInput
            id={`adult-name-${index}`}
            value={adult.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Roberto"
            maxLength={100}
            hasError={!!errors.name}
          />
        </FieldWrapper>
        <FieldWrapper label="Apellido" htmlFor={`adult-surname-${index}`} error={errors.surname} required>
          <StyledInput
            id={`adult-surname-${index}`}
            value={adult.surname}
            onChange={(e) => onChange("surname", e.target.value)}
            placeholder="López"
            maxLength={100}
            hasError={!!errors.surname}
          />
        </FieldWrapper>
      </div>

      {/* Row 3: Teléfono + Email */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
        <FieldWrapper label="Teléfono (opcional)" htmlFor={`adult-phone-${index}`} error={errors.phone_number}>
          <StyledInput
            id={`adult-phone-${index}`}
            value={adult.phone_number}
            onChange={(e) => onChange("phone_number", e.target.value)}
            placeholder="+5491145678901"
            hasError={!!errors.phone_number}
          />
        </FieldWrapper>
        <FieldWrapper label="Email" htmlFor={`adult-email-${index}`} error={errors.email} required>
          <StyledInput
            id={`adult-email-${index}`}
            type="email"
            value={adult.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="roberto@email.com"
            maxLength={150}
            hasError={!!errors.email}
          />
        </FieldWrapper>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 6. MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export function CreatePatientView({ onNavigate }: CreatePatientViewProps) {
  // ── State ──
  const [form,          setForm]         = useState<PatientFormState>(INITIAL_FORM);
  const [errors,        setErrors]       = useState<PatientFieldErrors>({});
  const [adults,        setAdults]       = useState<ResponsibleAdultFormState[]>([INITIAL_ADULT()]);
  const [adultErrors,   setAdultErrors]  = useState<AdultFieldErrors[]>([{}]);
  const [submitting,    setSubmitting]   = useState(false);
  const [submitError,   setSubmitError]  = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess]= useState(false);

  // ── Derived ──
  const isMinor = form.dateOfBirth ? calcularEdad(form.dateOfBirth) < 18 : false;
  const needsInsurance =
    form.coverageType === "HEALTH_INSURANCE" ||
    form.coverageType === "PREPAID_INSURANCE" ||
    form.coverageType === "OTHER";

  // ── Handlers: Patient ──
  const handleFormChange = useCallback(
    (field: keyof PatientFormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setSubmitError(null);
    },
    [],
  );

  // When coverageType changes to SELF_PAY, clear insurance
  useEffect(() => {
    if (form.coverageType === "SELF_PAY") {
      setForm((prev) => ({ ...prev, insurance: "" }));
    }
  }, [form.coverageType]);

  // ── Handlers: Adults ──
  const handleAdultChange = useCallback(
    (idx: number, field: keyof ResponsibleAdultFormState, value: string) => {
      setAdults((prev) =>
        prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)),
      );
      setAdultErrors((prev) =>
        prev.map((e, i) => {
          if (i !== idx) return e;
          const next = { ...e };
          delete next[field];
          return next;
        }),
      );
      setSubmitError(null);
    },
    [],
  );

  const addAdult = useCallback(() => {
    setAdults((prev) => [...prev, INITIAL_ADULT()]);
    setAdultErrors((prev) => [...prev, {}]);
  }, []);

  const removeAdult = useCallback((idx: number) => {
    setAdults((prev) => prev.filter((_, i) => i !== idx));
    setAdultErrors((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Validation ──
  function validateAll(): boolean {
    const patientFields: (keyof PatientFormState)[] = [
      "dni", "name", "surname", "dateOfBirth", "coverageType", "email", "phoneNumber", "insurance",
    ];
    const newErrors: PatientFieldErrors = {};
    let valid = true;

    for (const field of patientFields) {
      const err = validatePatientField(field, form[field], isMinor);
      if (err) { newErrors[field] = err; valid = false; }
    }
    setErrors(newErrors);

    if (isMinor) {
      const newAdultErrors: AdultFieldErrors[] = adults.map((adult) => {
        const ae: AdultFieldErrors = {};
        const adultFields: (keyof ResponsibleAdultFormState)[] = [
          "dni", "name", "surname", "email", "phone_number", "relation",
        ];
        for (const f of adultFields) {
          const err = validateAdultField(f, adult[f]);
          if (err) { ae[f] = err; valid = false; }
        }
        return ae;
      });
      setAdultErrors(newAdultErrors);
    }

    return valid;
  }

  // Quick check for button disabled state (no full revalidation)
  const hasRequiredFilled =
    form.dni.trim() &&
    form.name.trim() &&
    form.surname.trim() &&
    form.dateOfBirth &&
    form.coverageType &&
    (!isMinor ? form.email.trim() : true);

  // ── Submit ──
  async function handleSubmit() {
    if (!validateAll()) return;

    setSubmitting(true);
    setSubmitError(null);

    const dto: CreatePatientRequestDTO = {
      dni:          form.dni.trim(),
      name:         form.name.trim(),
      surname:      form.surname.trim(),
      dateOfBirth:  form.dateOfBirth,
      coverageType: form.coverageType as CoverageType,
      insurance:    needsInsurance && form.insurance.trim() ? form.insurance.trim() : null,
      phoneNumber:  form.phoneNumber.trim() || null,
      email:        form.email.trim() || null,
      responsibleAdultList: isMinor
        ? adults.map((a) => ({
            dni:          a.dni.trim(),
            name:         a.name.trim(),
            surname:      a.surname.trim(),
            phone_number: a.phone_number.trim() || null,
            email:        a.email.trim(),
            relation:     a.relation as Relation,
          }))
        : null,
    };

    try {
      await apiClient.post("/api/patients/save", dto);
      setSubmitSuccess(true);
      setTimeout(() => {
        onNavigate("pacientes-detail");
      }, 1800);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { data?: unknown } }).response?.data as string | undefined) ?? ""
          : "";
      setSubmitError(mapBackendError(typeof msg === "string" ? msg : ""));
      setSubmitting(false);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@300;400;500;700&display=swap');

        .cpv-minor-panel {
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transition: max-height 0.35s ease, opacity 0.25s ease;
        }
        .cpv-minor-panel.visible {
          max-height: 2400px;
          opacity: 1;
        }
      `}</style>

      <div style={{
        padding:    "32px 36px",
        minHeight:  "100%",
        background: C.bg,
        maxWidth:   860,
      }}>

        {/* ── Page Header ── */}
        <div style={{ marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => onNavigate("pacientes")}
            style={{
              display:     "inline-flex",
              alignItems:  "center",
              gap:         5,
              fontFamily:  FONT_SANS,
              fontSize:    12.5,
              fontWeight:  500,
              color:       C.textMuted,
              background:  "transparent",
              border:      "none",
              cursor:      "pointer",
              padding:     0,
              marginBottom: 12,
              letterSpacing: "0.01em",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 2L3 6l4.5 4" />
            </svg>
            Volver a pacientes
          </button>
          <h2 style={{
            fontFamily:  FONT_SERIF,
            fontSize:    22,
            fontWeight:  400,
            color:       C.textPrimary,
            letterSpacing: "-0.01em",
            margin:      0,
          }}>
            Nuevo paciente
          </h2>
        </div>

        {/* ════ CARD: DATOS DEL PACIENTE ════ */}
        <FormSection eyebrow="Datos Personales">
          {/* Row 1: DNI + Fecha de nacimiento */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 14 }}>
            <FieldWrapper label="DNI" htmlFor="dni" error={errors.dni} required>
              <StyledInput
                id="dni"
                value={form.dni}
                onChange={(e) => handleFormChange("dni", e.target.value)}
                placeholder="12345678"
                maxLength={8}
                hasError={!!errors.dni}
              />
            </FieldWrapper>
            <FieldWrapper label="Fecha de nacimiento" htmlFor="dateOfBirth" error={errors.dateOfBirth} required>
              <StyledInput
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => handleFormChange("dateOfBirth", e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                hasError={!!errors.dateOfBirth}
              />
            </FieldWrapper>
          </div>

          {/* Row 2: Nombre + Apellido */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 14 }}>
            <FieldWrapper label="Nombre" htmlFor="name" error={errors.name} required>
              <StyledInput
                id="name"
                value={form.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                placeholder="María"
                maxLength={100}
                hasError={!!errors.name}
              />
            </FieldWrapper>
            <FieldWrapper label="Apellido" htmlFor="surname" error={errors.surname} required>
              <StyledInput
                id="surname"
                value={form.surname}
                onChange={(e) => handleFormChange("surname", e.target.value)}
                placeholder="González"
                maxLength={100}
                hasError={!!errors.surname}
              />
            </FieldWrapper>
          </div>

          {/* Row 3: Teléfono + Email */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
            <FieldWrapper label="Teléfono (opcional)" htmlFor="phoneNumber" error={errors.phoneNumber}>
              <StyledInput
                id="phoneNumber"
                value={form.phoneNumber}
                onChange={(e) => handleFormChange("phoneNumber", e.target.value)}
                placeholder="+5491145678901"
                hasError={!!errors.phoneNumber}
              />
            </FieldWrapper>
            <FieldWrapper
              label={isMinor ? "Email (opcional)" : "Email"}
              htmlFor="email"
              error={errors.email}
              required={!isMinor}
            >
              <StyledInput
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
                placeholder="maria@email.com"
                maxLength={150}
                hasError={!!errors.email}
              />
            </FieldWrapper>
          </div>

          {/* Divider */}
          <div style={{
            height:     1,
            background: C.border,
            margin:     "24px 0",
          }} />

          {/* ── Cobertura ── */}
          <div style={{ marginBottom: 0 }}>
            <span style={{
              display:       "block",
              fontFamily:    FONT_SANS,
              fontSize:      9.5,
              fontWeight:    700,
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              color:         C.electric,
              marginBottom:  16,
            }}>
              Cobertura Médica
            </span>

            {/* Coverage Pills */}
            <FieldWrapper label="Tipo de cobertura" htmlFor="coverageType" error={errors.coverageType} required>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 2 }}>
                {COVERAGE_OPTIONS.map((opt) => {
                  const active = form.coverageType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleFormChange("coverageType", opt.value)}
                      style={{
                        padding:      "9px 20px",
                        borderRadius: 8,
                        border:       `1.5px solid ${active ? C.navy : C.border}`,
                        background:   active ? C.navy : "#FFFFFF",
                        color:        active ? "#FFFFFF" : C.textSecondary,
                        fontFamily:   FONT_SANS,
                        fontSize:     13,
                        fontWeight:   active ? 600 : 400,
                        cursor:       "pointer",
                        transition:   "background 0.15s, border-color 0.15s, color 0.15s",
                        whiteSpace:   "nowrap" as const,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </FieldWrapper>

            {/* Conditional insurance field */}
            {needsInsurance && (
              <div style={{ marginTop: 16 }}>
                <FieldWrapper label="Nombre de obra social / prepaga" htmlFor="insurance" error={errors.insurance}>
                  <StyledInput
                    id="insurance"
                    value={form.insurance}
                    onChange={(e) => handleFormChange("insurance", e.target.value)}
                    placeholder="Ej: OSDE 210, IOMA, Swiss Medical..."
                    maxLength={100}
                    hasError={!!errors.insurance}
                  />
                </FieldWrapper>
              </div>
            )}
          </div>
        </FormSection>

        {/* ════ SUB-PANEL: ADULTOS RESPONSABLES ════ */}
        <div className={`cpv-minor-panel ${isMinor ? "visible" : ""}`}>
          <div style={{
            background:   "#FFFFFF",
            border:       `1px solid ${C.border}`,
            borderRadius: 12,
            padding:      "28px 32px",
            marginBottom: 20,
            boxShadow:    "0 2px 12px rgba(15,34,68,0.04)",
          }}>
            <span style={{
              display:       "block",
              fontFamily:    FONT_SANS,
              fontSize:      9.5,
              fontWeight:    700,
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              color:         C.electric,
              marginBottom:  4,
            }}>
              Adulto/s Responsable/s
            </span>

            {/* Warning Banner */}
            <div style={{
              display:      "flex",
              alignItems:   "flex-start",
              gap:          10,
              background:   C.warningBg,
              border:       `1px solid ${C.warningBorder}`,
              borderRadius: 8,
              padding:      "12px 16px",
              marginBottom: 22,
              marginTop:    16,
            }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>⚠</span>
              <p style={{
                fontFamily: FONT_SANS,
                fontSize:   13,
                fontWeight: 400,
                color:      C.warningText,
                margin:     0,
                lineHeight: 1.5,
              }}>
                El paciente es menor de edad. Registrá al menos un adulto responsable para continuar.
              </p>
            </div>

            {/* Adult cards */}
            {adults.map((adult, idx) => (
              <ResponsibleAdultCard
                key={idx}
                index={idx}
                adult={adult}
                errors={adultErrors[idx] ?? {}}
                onChange={(field, value) => handleAdultChange(idx, field, value)}
                onRemove={() => removeAdult(idx)}
                canRemove={adults.length > 1}
              />
            ))}

            {/* Add another */}
            <button
              type="button"
              onClick={addAdult}
              style={{
                display:     "inline-flex",
                alignItems:  "center",
                gap:         6,
                fontFamily:  FONT_SANS,
                fontSize:    13,
                fontWeight:  500,
                color:       C.electric,
                background:  "transparent",
                border:      "none",
                cursor:      "pointer",
                padding:     "6px 0",
                marginTop:   4,
                letterSpacing: "0.01em",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke={C.electric} strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Agregar otro responsable
            </button>
          </div>
        </div>

        {/* ════ BANNER ÉXITO ════ */}
        {submitSuccess && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          12,
              background:   C.successBg,
              border:       `1px solid #6EE7B7`,
              borderRadius: 10,
              padding:      "16px 20px",
              marginBottom: 20,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="8.25" stroke="#059669" strokeWidth="1.5" />
              <path d="M5 9l3 3 5-5" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p style={{ fontFamily: FONT_SANS, fontSize: 13.5, fontWeight: 600, color: C.success, margin: 0 }}>
                Paciente registrado correctamente.
              </p>
              <p style={{ fontFamily: FONT_SANS, fontSize: 12.5, fontWeight: 400, color: "#047857", margin: "2px 0 0" }}>
                Redirigiendo al perfil del paciente...
              </p>
            </div>
          </div>
        )}

        {/* ════ ERROR BANNER ════ */}
        {submitError && !submitSuccess && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          10,
              background:   "#FEF2F2",
              border:       `1px solid #FECACA`,
              borderRadius: 10,
              padding:      "14px 18px",
              marginBottom: 20,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7.25" stroke={C.error} strokeWidth="1.5" />
              <path d="M8 4.5v4M8 10.5v.5" stroke={C.error} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <p style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 400, color: "#B91C1C", margin: 0 }}>
              {submitError}
            </p>
          </div>
        )}

        {/* ════ ACTIONS ════ */}
        <div style={{
          display:        "flex",
          justifyContent: "flex-end",
          alignItems:     "center",
          gap:            12,
          paddingTop:     4,
          paddingBottom:  32,
        }}>
          <button
            type="button"
            onClick={() => onNavigate("pacientes")}
            disabled={submitting}
            style={{
              fontFamily:  FONT_SANS,
              fontSize:    13,
              fontWeight:  500,
              color:       C.textSecondary,
              background:  "transparent",
              border:      `1.5px solid ${C.border}`,
              borderRadius: 8,
              padding:     "10px 22px",
              cursor:      submitting ? "not-allowed" : "pointer",
              opacity:     submitting ? 0.45 : 1,
              transition:  "opacity 0.15s",
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !hasRequiredFilled || submitSuccess}
            style={{
              fontFamily:  FONT_SANS,
              fontSize:    13,
              fontWeight:  600,
              color:       "#FFFFFF",
              background:  C.navy,
              border:      "none",
              borderRadius: 8,
              padding:     "10px 22px",
              cursor:      submitting || !hasRequiredFilled || submitSuccess ? "not-allowed" : "pointer",
              opacity:     submitting || !hasRequiredFilled || submitSuccess ? 0.45 : 1,
              display:     "inline-flex",
              alignItems:  "center",
              gap:         7,
              transition:  "opacity 0.15s",
            }}
          >
            {submitting ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  style={{ animation: "spin 0.9s linear infinite" }}>
                  <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.6" />
                  <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Guardando...
              </>
            ) : (
              <>
                Crear paciente
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5h9M7.5 3l3.5 3.5-3.5 3.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}