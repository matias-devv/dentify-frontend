// ════════════════════════════════════════════════════════════════════════════
// TurnoDetailView.tsx — Vista de detalle de turno — Dentify Dashboard
// TypeScript estricto · cero any · sin librerías nuevas
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useRef } from "react";
import apiClient from "../../api/apiClient";
import { type SelectedSlotContext } from "./TurnosViews"; 

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS — idénticos a TurnosViews.tsx y CrearTurnoView.tsx
// ════════════════════════════════════════════════════════════════
const C = {
  navy: "#0F2244",
  electric: "#2563EB",
  bg: "#F4F5F7",
  cardBg: "#FFFFFF",
  border: "#E4E6EC",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  activeItemBg: "#EFF6FF",
  errorBg: "#FEF2F2",
  errorBorder: "#FECACA",
  errorText: "#991B1B",
  errorIcon: "#EF4444",
} as const;

const FONT_SANS = "'DM Sans', sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

// ════════════════════════════════════════════════════════════════
// TIPOS — Backend
// ════════════════════════════════════════════════════════════════
type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "ADMITTED"
  | "IN_ATTENTION"
  | "CANCELLED_BY_SYSTEM"
  | "CANCELLED_BY_PATIENT"
  | "CANCELLED_BY_DENTIST"
  | "CANCELLED_BY_SECRETARY"
  | "COMPLETED"
  | "NO_SHOW"
  | "WALK_IN_PENDING";

interface PatientResponse {
  id: number;
  name: string;
  surname: string;
  dni: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  coverageType: string | null;
}

interface ProductResponse {
  id_product: number;
  name_product: string;
  name_speciality: string | null;
}

interface DentistResponse {
  id: number;
  name: string;
  surname: string;
}

interface AgendaResponse {
  id_agenda: number;
  agenda_name: string;
}

interface TreatmentResponse {
  id?: number;
}

interface PaymentResponse {
  id?: number;
  status?: string;
}

interface FullAppointmentResponse {
  id_appointment: number;
  status: AppointmentStatus;
  startTime: string;
  endTime: string;
  duration: number;
  attendanceConfirmed: boolean;
  confirmed_at: string | null;
  patient: PatientResponse;
  product: ProductResponse;
  dentist: DentistResponse;
  agenda: AgendaResponse;
  treatment: TreatmentResponse;
  pay: PaymentResponse[];
  notes: string | null;
  patient_instructions: string | null;
  reason_for_cancellation: string | null;
}

interface AppointmentTodayResponse {
  id_appointment: number;
  status: AppointmentStatus;
}

interface AppointmentCancelledResponse {
  id_appointment: number;
  status: AppointmentStatus;
  date: string;
  start_time: string;
  end_time: string;
  reason_for_cancellation: string;
  cancelled_at: string;
  patient: { name: string; surname: string; dni: string };
}

interface CancelAppointmentRequest {
  id_appointment: number;
  reason_for_cancellation: string;
  cancelledBy: "DENTIST" | "SECRETARY" | "PATIENT";
}

// ════════════════════════════════════════════════════════════════
// TIPOS — Props
// ════════════════════════════════════════════════════════════════
interface UserProfileShape {
  name: string;
  surname: string;
  clinicName: string;
  roles: string[];
}

interface TurnoDetailViewProps {
  onNavigate: (id: string) => void;
  userProfile: UserProfileShape | null;
  appointmentId: number; 
}

// Estado de UI del appointment normalizado
interface AppointmentState {
  id: number;
  status: AppointmentStatus;
  startTime: string;
  endTime: string;
  duration: number;
  patient: PatientResponse;
  product: ProductResponse;
  dentist: DentistResponse;
  agenda: AgendaResponse;
  notes: string | null;
  patient_instructions: string | null;
  reason_for_cancellation: string | null;
}

// ════════════════════════════════════════════════════════════════
// HELPERS PUROS (nivel de módulo)
// ════════════════════════════════════════════════════════════════

/** Mapea coverageType de backend a español */
const mapCoverageType = (ct: string | null | undefined): string => {
  switch (ct) {
    case "SELF_PAY":        return "Particular";
    case "HEALTH_INSURANCE": return "Obra social";
    case "PREPAID_INSURANCE": return "Prepaga";
    case "OTHER":           return "Otra cobertura";
    default:                return "Sin cobertura";
  }
};

/** Mapea name_speciality a español */
const mapSpeciality = (s: string | null | undefined): string => {
  switch (s) {
    case "general_dentistry":    return "Odontología general";
    case "orthodontics":         return "Ortodoncia";
    case "endodontics":          return "Endodoncia";
    case "periodontics":         return "Periodoncia";
    case "pediatric_dentistry":  return "Odontología pediátrica";
    case "oral_surgery":         return "Cirugía oral";
    case "prosthodontics":       return "Prostodoncia";
    case "cosmetic_dentistry":   return "Odontología estética";
    default:                     return s ?? "—";
  }
};

/** Mapea AppointmentStatus a label + colores */
const mapStatus = (s: AppointmentStatus): { label: string; bg: string; color: string } => {
  if (s.startsWith("CANCELLED_")) {
    return { label: "Cancelado", bg: "#FEF2F2", color: "#991B1B" };
  }
  switch (s) {
    case "SCHEDULED":       return { label: "Programado",  bg: "#EFF6FF", color: "#2563EB" };
    case "CONFIRMED":       return { label: "Confirmado",  bg: "#F0FDF4", color: "#16A34A" };
    case "ADMITTED":        return { label: "Admitido",    bg: "#FFF7ED", color: "#D97706" };
    case "IN_ATTENTION":    return { label: "En atención", bg: "#F5F3FF", color: "#7C3AED" };
    case "COMPLETED":       return { label: "Completado",  bg: "#F0FDF4", color: "#15803D" };
    case "NO_SHOW":         return { label: "Ausente",     bg: "#FEF2F2", color: "#DC2626" };
    case "WALK_IN_PENDING": return { label: "En espera",   bg: "#FFF7ED", color: "#B45309" };
    default:                return { label: s,             bg: "#F4F5F7", color: "#6B7280" };
  }
};

/**
 * Formatea "2026-04-27T11:00:00" → "27 de abril de 2026 · 11:00 hs"
 */
const formatDateTime = (isoStr: string): string => {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const date = d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const time = isoStr.slice(11, 16);
    return `${date} · ${time} hs`;
  } catch {
    return isoStr;
  }
};

/**
 * Formatea fecha "YYYY-MM-DD" o ISO → "27 de abril de 2026"
 */
const formatDate = (isoStr: string): string => {
  if (!isoStr) return "—";
  try {
    const clean = isoStr.slice(0, 10);
    const d = new Date(clean + "T00:00:00");
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return isoStr;
  }
};

/**
 * Formatea rango horario: "11:00:00", "11:30:00" → "11:00 – 11:30"
 */
const formatTimeRange = (start: string, end: string): string => {
  if (!start || !end) return "—";
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
};

/** Extrae "HH:mm" desde un ISO datetime string */
const extractTime = (isoStr: string): string => {
  if (!isoStr) return "—";
  const t = isoStr.slice(11, 16);
  return t || "—";
};

/** Calcula iniciales para avatar */
const getInitials = (name: string, surname: string): string => {
  return `${surname.charAt(0)}${name.charAt(0)}`.toUpperCase();
};

/** Indica si el status es cancelado */
const isCancelled = (s: AppointmentStatus): boolean => s.startsWith("CANCELLED_");

/** Indica si el status es terminal (no hay acciones de flujo) */
const isTerminal = (s: AppointmentStatus): boolean =>
  isCancelled(s) || s === "COMPLETED" || s === "NO_SHOW";

// ════════════════════════════════════════════════════════════════
// MINI COMPONENTS
// ════════════════════════════════════════════════════════════════

function InlineSpinner({ color = "#fff" }: { color?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ animation: "dentify-spin 0.7s linear infinite", flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="5.5" stroke={`${color}40`} strokeWidth="1.8" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      style={{
        background: C.errorBg,
        border: `1px solid ${C.errorBorder}`,
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontFamily: FONT_SANS,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M8 5v4M8 11v.5" stroke={C.errorIcon} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="8" r="6.5" stroke={C.errorIcon} strokeWidth="1.4" />
      </svg>
      <p style={{ fontSize: 13, color: C.errorText, flex: 1, margin: 0, lineHeight: 1.5 }}>
        {message}
      </p>
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.errorText, display: "flex", alignItems: "center" }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke={C.errorText} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function SuccessBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      style={{
        background: "#F0FDF4",
        border: `1px solid #86EFAC`,
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontFamily: FONT_SANS,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M3.5 8.5l3 3 6-6" stroke="#15803D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="8" r="6.5" stroke="#15803D" strokeWidth="1.4" />
      </svg>
      <p style={{ fontSize: 13, color: "#15803D", flex: 1, margin: 0, lineHeight: 1.5 }}>
        {message}
      </p>
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#15803D", display: "flex", alignItems: "center" }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="#15803D" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// Skeleton de banda de paciente
function PatientBandSkeleton() {
  return (
    <div
      style={{
        background: C.cardBg,
        borderBottom: `1px solid ${C.border}`,
        padding: "14px 32px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#E5E7EB", animation: "dentify-pulse 1.4s ease-in-out infinite" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ width: 180, height: 14, borderRadius: 4, background: "#E5E7EB", animation: "dentify-pulse 1.4s ease-in-out infinite" }} />
        <div style={{ width: 300, height: 11, borderRadius: 4, background: "#F0F1F5", animation: "dentify-pulse 1.4s ease-in-out infinite", animationDelay: "0.1s" }} />
      </div>
    </div>
  );
}

// Skeleton de contenido principal
function ContentSkeleton() {
  return (
    <div style={{ padding: "28px 32px" }}>
      {[120, 80, 200, 160, 260].map((w, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 56 : 40,
            width: `${w * 2}px`,
            maxWidth: "100%",
            borderRadius: 8,
            background: i % 2 === 0 ? "#E5E7EB" : "#F0F1F5",
            marginBottom: 16,
            animation: "dentify-pulse 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ height: 60, borderRadius: 8, background: "#F0F1F5", animation: "dentify-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CAMPO DE DETALLE (label + valor)
// ════════════════════════════════════════════════════════════════
function DetailField({
  label,
  value,
  span = false,
  badge,
}: {
  label: string;
  value: React.ReactNode;
  span?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div style={{ gridColumn: span ? "1 / -1" : undefined }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: C.textMuted,
          fontFamily: FONT_SANS,
          marginBottom: 5,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {label}
        {badge}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: C.textPrimary,
          fontFamily: FONT_SANS,
          lineHeight: 1.4,
        }}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CANCEL MODAL
// ════════════════════════════════════════════════════════════════
interface CancelModalProps {
  appointmentId: number;
  onClose: () => void;
  onSuccess: (status: AppointmentStatus) => void;
}

function CancelModal({ appointmentId, onClose, onSuccess }: CancelModalProps) {
  const [reason, setReason] = useState("");
  const [cancelledBy, setCancelledBy] = useState<"DENTIST" | "SECRETARY" | "PATIENT">("SECRETARY");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reasonFocused, setReasonFocused] = useState(false);

  const isValid = reason.trim().length >= 10;

  const handleConfirm = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const body: CancelAppointmentRequest = {
        id_appointment: appointmentId,
        reason_for_cancellation: reason.trim(),
        cancelledBy,
      };
      const res = await apiClient.patch("/api/appointments/cancel", body);
      const data = res.data as AppointmentCancelledResponse;
      onSuccess(data.status);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; error?: string } } };
      const msg =
        axiosErr?.response?.data?.message ??
        axiosErr?.response?.data?.error ??
        "No se pudo cancelar el turno. Intentá nuevamente.";
      setErrorMsg(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const byOptions: { value: "DENTIST" | "SECRETARY" | "PATIENT"; label: string }[] = [
    { value: "DENTIST",    label: "Dentista" },
    { value: "SECRETARY",  label: "Secretaría" },
    { value: "PATIENT",    label: "Paciente" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15,34,68,0.45)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: C.cardBg,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 24px 64px rgba(15,34,68,0.18)",
          fontFamily: FONT_SANS,
          overflow: "hidden",
        }}
      >
        {/* Header modal */}
        <div
          style={{
            padding: "20px 24px 18px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, margin: 0, letterSpacing: "-0.01em" }}>
              Cancelar turno
            </h2>
            <p style={{ fontSize: 13, color: C.textSecondary, margin: "4px 0 0", lineHeight: 1.4 }}>
              Esta acción no puede deshacerse.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.textMuted, display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4l-10 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body modal */}
        <div style={{ padding: "20px 24px" }}>
          {errorMsg && <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} />}

          {/* Motivo */}
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: C.textMuted,
                marginBottom: 8,
              }}
            >
              Motivo de cancelación
            </label>
            <textarea
              placeholder="Describe el motivo de cancelación (mínimo 10 caracteres)…"
              value={reason}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
              onFocus={() => setReasonFocused(true)}
              onBlur={() => setReasonFocused(false)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: `1.5px solid ${reasonFocused ? C.electric : (reason.length > 0 && reason.trim().length < 10 ? C.errorIcon : C.border)}`,
                borderRadius: 8,
                fontFamily: FONT_SANS,
                fontSize: 13,
                color: C.textPrimary,
                background: C.cardBg,
                outline: "none",
                resize: "vertical",
                lineHeight: 1.6,
                boxSizing: "border-box",
                boxShadow: reasonFocused ? `0 0 0 3px rgba(37,99,235,0.10)` : "none",
              }}
            />
            {reason.length > 0 && reason.trim().length < 10 && (
              <p style={{ fontSize: 11, color: C.errorIcon, marginTop: 4 }}>
                Mínimo 10 caracteres ({10 - reason.trim().length} restantes)
              </p>
            )}
          </div>

          {/* Cancelado por */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: C.textMuted,
                marginBottom: 8,
              }}
            >
              Cancelado por
            </label>
            <div style={{ display: "inline-flex", border: `1.5px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: "#F4F5F7" }}>
              {byOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCancelledBy(opt.value)}
                  style={{
                    padding: "8px 18px",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: FONT_SANS,
                    fontSize: 13,
                    fontWeight: 600,
                    background: cancelledBy === opt.value ? C.electric : "transparent",
                    color: cancelledBy === opt.value ? "#fff" : C.textSecondary,
                    transition: "all 0.15s",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer modal */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "9px 20px",
              borderRadius: 7,
              border: `1.5px solid ${C.border}`,
              background: C.cardBg,
              color: C.textSecondary,
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            Volver
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || submitting}
            style={{
              padding: "9px 20px",
              borderRadius: 7,
              border: "none",
              background: !isValid || submitting ? "#F87171" : "#DC2626",
              color: "#fff",
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 700,
              cursor: !isValid || submitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "background 0.15s",
              opacity: !isValid ? 0.7 : 1,
            }}
          >
            {submitting ? <><InlineSpinner />Cancelando...</> : "Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// FLOW BUTTONS — ADMITIR / ATENDER / COMPLETADO
// ════════════════════════════════════════════════════════════════
type FlowStep = "ADMITIR" | "ATENDER" | "COMPLETADO";

interface FlowButtonsProps {
  status: AppointmentStatus;
  loading: boolean;
  activeStep: FlowStep | null;
  onStep: (step: FlowStep) => void;
}

function FlowButtons({ status, loading, activeStep, onStep }: FlowButtonsProps) {
  const isCompleted = (step: FlowStep): boolean => {
    if (step === "ADMITIR") return ["ADMITTED", "IN_ATTENTION", "COMPLETED"].includes(status);
    if (step === "ATENDER") return ["IN_ATTENTION", "COMPLETED"].includes(status);
    if (step === "COMPLETADO") return status === "COMPLETED";
    return false;
  };

  const isEnabled = (step: FlowStep): boolean => {
    if (loading) return false;
    if (step === "ADMITIR") return ["SCHEDULED", "CONFIRMED", "WALK_IN_PENDING"].includes(status);
    if (step === "ATENDER") return status === "ADMITTED";
    if (step === "COMPLETADO") return status === "IN_ATTENTION";
    return false;
  };

  const steps: FlowStep[] = ["ADMITIR", "ATENDER", "COMPLETADO"];
  const stepLabels: Record<FlowStep, string> = {
    ADMITIR: "Admitir",
    ATENDER: "Atender",
    COMPLETADO: "Completado",
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {steps.map((step) => {
        const done = isCompleted(step);
        const enabled = isEnabled(step);
        const isActive = loading && activeStep === step;
        const disabled = !enabled && !done;

        let bg: string = "#E5E7EB";
        let color: string = C.textMuted;
        let cursor: React.CSSProperties["cursor"] = "not-allowed";
        let border: string = `1.5px solid #E5E7EB`;

        if (done) {
          bg = "#F0FDF4";
          color = "#15803D";
          border = `1.5px solid #86EFAC`;
          cursor = "default";
        } else if (enabled) {
          bg = C.electric;
          color = "#fff";
          border = `1.5px solid ${C.electric}`;
          cursor = "pointer";
        }

        return (
          <button
            key={step}
            onClick={() => enabled && onStep(step)}
            disabled={disabled || loading}
            title={stepLabels[step]}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border,
              background: bg,
              color,
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 700,
              cursor,
              display: "flex",
              alignItems: "center",
              gap: 7,
              transition: "all 0.15s",
              opacity: disabled && !done ? 0.6 : 1,
            }}
          >
            {/* Icono */}
            {isActive ? (
              <InlineSpinner color={enabled ? "#fff" : C.electric} />
            ) : done ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 6.5l3 3 5-5" stroke="#15803D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="6" cy="6" r="2" fill="currentColor" />
              </svg>
            )}
            {stepLabels[step]}
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN VIEW — TurnoDetailView
// ════════════════════════════════════════════════════════════════
export function TurnoDetailView({
  onNavigate,
  userProfile,
  appointmentId 
}: TurnoDetailViewProps) {
  // Estado del appointment normalizado
  const [appointment, setAppointment] = useState<AppointmentState | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Mensajes de acción
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estado de carga de las acciones de flujo
  const [flowLoading, setFlowLoading] = useState(false);
  const [activeFlowStep, setActiveFlowStep] = useState<FlowStep | null>(null);

  // Modal de cancelación
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Ref para abort
  const abortRef = useRef<AbortController | null>(null);

  // ── Normalizar FullAppointmentResponse → AppointmentState ──
  const buildFromFull = useCallback((resp: FullAppointmentResponse): AppointmentState => ({
    id: resp.id_appointment,
    status: resp.status,
    startTime: resp.startTime,
    endTime: resp.endTime,
    duration: resp.duration,
    patient: resp.patient,
    product: resp.product,
    dentist: resp.dentist,
    agenda: resp.agenda,
    notes: resp.notes,
    patient_instructions: resp.patient_instructions,
    reason_for_cancellation: resp.reason_for_cancellation,
  }), []);

  // ── Fetch del appointment completo ──
  const fetchFull = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoadingData(true);
    setFetchError(null);
    try {
      const res = await apiClient.get(`/api/appointments/find/${appointmentId}`, {
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      const data = res.data as FullAppointmentResponse;
      setAppointment(buildFromFull(data));
    } catch (err: unknown) {
      if (ctrl.signal.aborted) return;
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setFetchError(
        axiosErr?.response?.data?.message ?? "No se pudo cargar el turno. Intentá nuevamente."
      );
    } finally {
      if (!abortRef.current?.signal.aborted) setLoadingData(false);
    }
  }, [appointmentId, buildFromFull]);
 
  useEffect(() => {
     fetchFull();
     return () => abortRef.current?.abort();
   }, []);

  // ── Handler: step de flujo ──
  const handleFlowStep = useCallback(
    async (step: FlowStep) => {
      if (!appointment) return;
      setFlowLoading(true);
      setActiveFlowStep(step);
      setActionError(null);

      const endpointMap: Record<FlowStep, string> = {
        ADMITIR:    `/api/appointments/admit/${appointment.id}`,
        ATENDER:    `/api/appointments/start-attention/${appointment.id}`,
        COMPLETADO: `/api/appointments/complete/${appointment.id}`,
      };

      try {
        const res = await apiClient.patch(endpointMap[step]);
        const data = res.data as AppointmentTodayResponse;
        setAppointment((prev) => prev ? { ...prev, status: data.status } : prev);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string; error?: string } } };
        const msg =
          axiosErr?.response?.data?.message ??
          axiosErr?.response?.data?.error ??
          "No se pudo actualizar el estado del turno.";
        setActionError(String(msg));
      } finally {
        setFlowLoading(false);
        setActiveFlowStep(null);
      }
    },
    [appointment]
  );

  // ── Handler: cancelación exitosa ──
  const handleCancelSuccess = useCallback((status: AppointmentStatus) => {
    setAppointment((prev) => prev ? { ...prev, status } : prev);
    setShowCancelModal(false);
    setSuccessMsg("Turno cancelado. Se notificó al paciente por email.");
  }, []);

  // ═══════════════════════════════════════════════════════════
  // RENDER — Loading
  // ═══════════════════════════════════════════════════════════
  if (loadingData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: C.bg, fontFamily: FONT_SANS }}>
        <style>{`
          @keyframes dentify-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
          @keyframes dentify-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        `}</style>
        <PatientBandSkeleton />
        <div style={{ height: 60, background: C.cardBg, borderBottom: `1px solid ${C.border}`, animation: "dentify-pulse 1.4s ease-in-out infinite" }} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          <ContentSkeleton />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER — Error de fetch
  // ═══════════════════════════════════════════════════════════
  if (fetchError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          background: C.bg,
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_SANS,
          padding: 32,
        }}
      >
        <style>{`@keyframes dentify-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: C.errorBg,
            border: `1px solid ${C.errorBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 7v6M11 15v.5" stroke={C.errorIcon} strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="11" cy="11" r="9.5" stroke={C.errorIcon} strokeWidth="1.5" />
          </svg>
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>
          No se pudo cargar el turno
        </h3>
        <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 24, textAlign: "center", maxWidth: 340, lineHeight: 1.6 }}>
          {fetchError}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => onNavigate("turnos")}
            style={{ padding: "9px 20px", borderRadius: 7, border: `1.5px solid ${C.border}`, background: C.cardBg, color: C.textSecondary, fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Volver
          </button>
          <button
            onClick={fetchFull}
            style={{ padding: "9px 20px", borderRadius: 7, border: "none", background: C.electric, color: "#fff", fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!appointment) return null;

  const { status, patient, product, dentist, agenda, notes, patient_instructions } = appointment;
  const statusInfo = mapStatus(status);
  const cancelled = isCancelled(status);
  const terminal = isTerminal(status);

  // Parseo de fecha y hora desde startTime
  const startDateStr = appointment.startTime.slice(0, 10); // "YYYY-MM-DD"
  const startTimeStr = appointment.startTime.slice(11, 16); // "HH:mm"
  const endTimeStr   = appointment.endTime.slice(11, 16);   // "HH:mm"

  // ═══════════════════════════════════════════════════════════
  // RENDER — Vista completa
  // ═══════════════════════════════════════════════════════════
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: C.bg,
        fontFamily: FONT_SANS,
      }}
    >
      <style>{`
        @keyframes dentify-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes dentify-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ════════════════════════════════════════════
          ZONA 1: BANDA DEL PACIENTE
      ════════════════════════════════════════════ */}
      <div
        style={{
          background: C.cardBg,
          borderBottom: `1px solid ${C.border}`,
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexShrink: 0,
        }}
      >
        {/* Avatar con iniciales */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: C.electric,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
            {getInitials(patient.name, patient.surname)}
          </span>
        </div>

        {/* Datos del paciente en una fila */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap", rowGap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
            {patient.surname}, {patient.name}
          </span>
          {patient.dateOfBirth && (
            <BandSep />
          )}
          {patient.dateOfBirth && (
            <BandItem label="Nac." value={formatDate(patient.dateOfBirth)} />
          )}
          <BandSep />
          <BandItem label="DNI" value={patient.dni !== "—" ? patient.dni : "—"} />
          <BandSep />
          <BandItem label="Cobertura" value={mapCoverageType(patient.coverageType)} />
          {patient.phoneNumber && (
            <>
              <BandSep />
              <BandItem label="Tel." value={patient.phoneNumber} />
            </>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          ZONA 2: BARRA DE ACCIONES
      ════════════════════════════════════════════ */}
      <div
        style={{
          background: C.cardBg,
          borderBottom: `1px solid ${C.border}`,
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        {/* Izquierda: botones de flujo (solo si no está cancelado/ausente) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!cancelled && status !== "NO_SHOW" ? (
            <FlowButtons
              status={status}
              loading={flowLoading}
              activeStep={activeFlowStep}
              onStep={handleFlowStep}
            />
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 14px",
                borderRadius: 8,
                background: statusInfo.bg,
                border: `1px solid ${statusInfo.color}30`,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="5.5" stroke={statusInfo.color} strokeWidth="1.4" />
                <path d="M4 4l5 5M9 4l-5 5" stroke={statusInfo.color} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: statusInfo.color }}>
                {statusInfo.label}
              </span>
            </div>
          )}
        </div>

        {/* Derecha: botones icon-only */}
        <div style={{ display: "flex", gap: 8 }}>
          {/* Lápiz — deshabilitado */}
          <IconActionButton
            tooltip="Próximamente"
            disabled
            onClick={() => {}}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path
                d="M10.5 2.5l2 2-7 7H3.5v-2l7-7z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconActionButton>

          {/* X — cancelar (solo si no es terminal) */}
          {!terminal && (
            <IconActionButton
              tooltip="Cancelar turno"
              danger
              onClick={() => setShowCancelModal(true)}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M3 3l9 9M12 3l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </IconActionButton>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          ÁREA DE SCROLL
      ════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>

        {/* Banners */}
        {actionError && <ErrorBanner message={actionError} onClose={() => setActionError(null)} />}
        {successMsg && <SuccessBanner message={successMsg} onClose={() => setSuccessMsg(null)} />}

        {/* ════════════════════════════════════════════
            ZONA 3: HEADER DEL TURNO
        ════════════════════════════════════════════ */}
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "18px 24px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {/* Izquierda */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  background: C.navy,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  borderRadius: 5,
                  padding: "3px 10px",
                  fontFamily: FONT_SANS,
                }}
              >
                Turno
              </span>
              <span
                style={{
                  background: C.electric,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  borderRadius: 5,
                  padding: "3px 10px",
                  fontFamily: FONT_SANS,
                }}
              >
                Presencial
              </span>
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0, fontFamily: FONT_SANS }}>
              Creado: {formatDateTime(appointment.startTime)}
            </p>
          </div>

          {/* Derecha */}
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "inline-block",
                background: statusInfo.bg,
                color: statusInfo.color,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 6,
                padding: "5px 14px",
                marginBottom: 5,
                fontFamily: FONT_SANS,
                letterSpacing: "0.02em",
              }}
            >
              {statusInfo.label}
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0, fontFamily: FONT_SANS }}>
              Profesional: {dentist.name} {dentist.surname}
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            ZONA 4: DETALLE DEL TURNO
        ════════════════════════════════════════════ */}
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "24px",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.textMuted,
              fontFamily: FONT_SANS,
              marginBottom: 20,
              paddingBottom: 12,
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1.5" y="2.5" width="10" height="9" rx="2" stroke={C.textMuted} strokeWidth="1.4" />
              <path d="M4.5 1v3M8.5 1v3M1.5 6h10" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Información del turno
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px 32px",
            }}
          >
            <DetailField
              label="Nombre de la agenda"
              value={agenda.agenda_name !== "—" ? agenda.agenda_name : "—"}
            />
            <DetailField
              label="Profesional"
              value={`${dentist.name} ${dentist.surname}`.trim() || "—"}
            />
            <DetailField
              label="Clínica"
              value={userProfile?.clinicName || "—"}
            />
            <DetailField
              label="Especialidad"
              value={mapSpeciality(product.name_speciality)}
            />
            <DetailField
              label="Fecha"
              value={formatDate(startDateStr)}
            />
            <DetailField
              label="Hora"
              value={`${startTimeStr} – ${endTimeStr}`}
            />
            <DetailField
              label="Modalidad"
              value="Presencial"
            />
            <DetailField
              label="Duración del turno"
              value={appointment.duration > 0 ? `${appointment.duration} min` : "—"}
            />
            <DetailField
              label="Producto / Servicio"
              value={product.name_product || "—"}
            />
            <DetailField
              label="Cobertura"
              value={mapCoverageType(patient.coverageType)}
            />

            {/* Instrucciones — span completo */}
            <DetailField
              label="Instrucciones al paciente"
              value={patient_instructions?.trim() || "—"}
              span
            />

            {/* Notas internas — span completo */}
            <DetailField
              label="Notas internas"
              value={notes?.trim() || "—"}
              span
              badge={
                <span
                  style={{
                    background: C.activeItemBg,
                    color: C.electric,
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: 4,
                    padding: "2px 7px",
                    fontFamily: FONT_SANS,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Solo visible para vos
                </span>
              }
            />

            {/* Motivo de cancelación (solo si está cancelado) */}
            {cancelled && appointment.reason_for_cancellation && (
              <DetailField
                label="Motivo de cancelación"
                value={appointment.reason_for_cancellation}
                span
              />
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          CANCEL MODAL
      ════════════════════════════════════════════ */}
      {showCancelModal && (
        <CancelModal
          appointmentId={appointment.id}
          onClose={() => setShowCancelModal(false)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// HELPERS DE RENDERIZADO DE LA BANDA
// ════════════════════════════════════════════════════════════════
function BandSep() {
  return (
    <span
      style={{
        color: C.border,
        margin: "0 10px",
        fontSize: 14,
        fontWeight: 300,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      ·
    </span>
  );
}

function BandItem({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 13, color: C.textSecondary, fontFamily: FONT_SANS }}>
      <span style={{ fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>
        {label}
      </span>
      {value}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// ICON ACTION BUTTON
// ════════════════════════════════════════════════════════════════
function IconActionButton({
  children,
  onClick,
  tooltip,
  disabled = false,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tooltip: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  let bg = "transparent";
  let color: string = C.textSecondary;
  let border = `1.5px solid ${C.border}`;

  if (disabled) {
    color = C.textSecondary;
    bg = "#F9FAFB";
  } else if (danger && hovered) {
    bg = C.errorBg;
    color = "#DC2626";
    border = `1.5px solid ${C.errorBorder}`;
  } else if (hovered) {
    bg = C.activeItemBg;
    color = C.electric;
    border = `1.5px solid ${C.electric}40`;
  }

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={tooltip}
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          border,
          background: bg,
          color,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s",
          flexShrink: 0,
        }}
      >
        {children}
      </button>
    </div>
  );
}