// ════════════════════════════════════════════════════════════════════════════
// AdmisionView.tsx — Vista de Admisión — Dentify Dashboard
// TypeScript estricto · cero any · sin librerías nuevas · date-fns
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import apiClient from "../../api/apiClient";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS — idénticos al sistema
// ════════════════════════════════════════════════════════════════
const C = {
  navy:          "#0F2244",
  electric:      "#2563EB",
  bg:            "#F4F5F7",
  cardBg:        "#FFFFFF",
  border:        "#E4E6EC",
  textPrimary:   "#111827",
  textSecondary: "#6B7280",
  textMuted:     "#9CA3AF",
  activeItemBg:  "#EFF6FF",
  errorBg:       "#FEF2F2",
  errorBorder:   "#FECACA",
  errorText:     "#991B1B",
  errorIcon:     "#EF4444",
} as const;

const FONT_SANS  = "'DM Sans', sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

// ════════════════════════════════════════════════════════════════
// TIPOS — Backend (reutilizados del codebase)
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

interface AppointmentTodayResponse {
  id: number;
  time: string;                    // formato "HH:mm"
  patient_name: string;
  patient_surname: string;
  patient_id: number;
  coverage: string;
  status: AppointmentStatus;
  attendanceConfirmed: boolean;    // True si ya pasó admisión
  serviceName: string | null;      // nombre del producto/servicio
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
interface AdmisionViewProps {
  onNavigate: (id: string) => void;
  userProfile: {
    name: string;
    surname: string;
    clinicName: string;
    roles: string[];
  } | null;
  onAppointmentSelected?: (appointmentId: number) => void;
}

// ════════════════════════════════════════════════════════════════
// HELPERS PUROS (reutilizados del codebase — NO redefinidos)
// ════════════════════════════════════════════════════════════════

/** Mapea AppointmentStatus → label + colores — IGUAL que TurnoDetailView */
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

/** Calcula iniciales para avatar — IGUAL que TurnoDetailView */
const getInitials = (name: string, surname: string): string =>
  `${surname.charAt(0)}${name.charAt(0)}`.toUpperCase();

/** Formatea rango horario — IGUAL que TurnoDetailView */
const formatTimeRange = (start: string, end: string): string => {
  if (!start || !end) return "—";
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
};

/** Colores rotativos para avatares — mismo sistema que el resto de la app */
const AVATAR_COLORS = [
  "#2563EB", "#7C3AED", "#0F2244", "#D97706",
  "#15803D", "#DC2626", "#0891B2", "#9D174D",
];
const getAvatarColor = (name: string, surname: string): string => {
  const idx = ((name.charCodeAt(0) ?? 0) + (surname.charCodeAt(0) ?? 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

/** Statuses activos (no cancelados ni completados) */
const ACTIVE_STATUSES: AppointmentStatus[] = [
  "SCHEDULED", "CONFIRMED", "ADMITTED", "IN_ATTENTION", "NO_SHOW", "WALK_IN_PENDING",
];

const isCancelled = (s: AppointmentStatus): boolean => s.startsWith("CANCELLED_");
const isTerminal  = (s: AppointmentStatus): boolean =>
  isCancelled(s) || s === "COMPLETED";

/** Formatea fecha YYYY-MM-DD → "Martes, 28 de abril de 2026" */
const formatDayLabel = (dateStr: string): string => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

/** Capitaliza primera letra */
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** YYYY-MM-DD desde Date local, sin desfase de timezone */
const toLocalDateStr = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

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

/** Skeleton de 3 filas pulsantes */
function ListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          style={{
            height: 72,
            borderRadius: 8,
            background: "#F0F1F5",
            animation: "dentify-pulse 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: "48px 0", textAlign: "center", fontFamily: FONT_SANS }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "#F4F5F7",
          margin: "0 auto 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 5v4M8 11v.5" stroke={C.textMuted} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>{text}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CANCEL MODAL — copiado de TurnoDetailView (misma lógica/endpoint)
// ════════════════════════════════════════════════════════════════
interface CancelModalProps {
  appointmentId: number;
  onClose: () => void;
  onSuccess: (id: number, status: AppointmentStatus) => void;
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
      onSuccess(appointmentId, data.status);
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
    { value: "DENTIST",   label: "Dentista"   },
    { value: "SECRETARY", label: "Secretaría" },
    { value: "PATIENT",   label: "Paciente"   },
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
        padding: 20,
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
        {/* Header */}
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

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {errorMsg && <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} />}

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted, marginBottom: 8 }}>
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

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted, marginBottom: 8 }}>
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

        {/* Footer */}
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
              opacity: !isValid ? 0.7 : 1,
            }}
          >
            {submitting ? <><InlineSpinner />Cancelando…</> : "Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// APPOINTMENT ROW — ítem individual de la lista de turnos de hoy
// ════════════════════════════════════════════════════════════════
interface AppointmentRowProps {
  appointment: AppointmentTodayResponse;
  onNavigate: (id: string) => void;
  onAppointmentSelected?: (id: number) => void;
  onCancelClick: (appointmentId: number) => void;
}

function AppointmentRow({ appointment, onNavigate, onAppointmentSelected, onCancelClick }: AppointmentRowProps) {
  const [hovered, setHovered] = useState(false);
  const statusInfo = mapStatus(appointment.status);
  const avatarColor = getAvatarColor(appointment.patient_name, appointment.patient_surname);
  const initials = getInitials(appointment.patient_name, appointment.patient_surname);
  const terminal = isTerminal(appointment.status);

  const handleRowClick = () => {
    onAppointmentSelected?.(appointment.id);
    onNavigate("turno-detail");
  };

  return (
    <div
      style={{
        background: hovered ? C.activeItemBg : C.cardBg,
        border: `1px solid ${hovered ? `${C.electric}40` : C.border}`,
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleRowClick}
    >
      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: avatarColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
          {initials}
        </span>
      </div>

      {/* Info principal */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.textPrimary,
              fontFamily: FONT_SANS,
              whiteSpace: "nowrap",
            }}
          >
            {appointment.patient_surname}, {appointment.patient_name}
          </span>
          {/* Badge de status */}
          <span
            style={{
              display: "inline-block",
              background: statusInfo.bg,
              color: statusInfo.color,
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 5,
              padding: "2px 8px",
              fontFamily: FONT_SANS,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {statusInfo.label}
          </span>
          {/* Badge de admisión */}
          {appointment.attendanceConfirmed && (
            <span
              style={{
                display: "inline-block",
                background: "#ECFDF5",
                color: "#065F46",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 5,
                padding: "2px 8px",
                fontFamily: FONT_SANS,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Admitido
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {appointment.serviceName && (
            <span style={{ fontSize: 12, color: C.textSecondary, fontFamily: FONT_SANS }}>
              {appointment.serviceName}
            </span>
          )}
          <span style={{ fontSize: 12, color: C.textMuted, fontFamily: FONT_SANS, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M8 1h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h2" stroke={C.textMuted} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {appointment.coverage}
          </span>
        </div>
      </div>

      {/* Horario */}
      <div style={{ textAlign: "right", flexShrink: 0, marginRight: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.electric,
            fontFamily: FONT_SANS,
            letterSpacing: "0.02em",
          }}
        >
          {appointment.time}
        </span>
      </div>

      {/* Botones de acción */}
      <div
        style={{ display: "flex", gap: 6, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Lápiz — deshabilitado */}
        <ActionIconBtn tooltip="Próximamente" disabled onClick={() => {}}>
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
            <path d="M10.5 2.5l2 2-7 7H3.5v-2l7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ActionIconBtn>

        {/* X — cancelar (solo si no es terminal) */}
        {!terminal && (
          <ActionIconBtn
            tooltip="Cancelar turno"
            danger
            onClick={() => onCancelClick(appointment.id)}
          >
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
              <path d="M3 3l9 9M12 3l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </ActionIconBtn>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SLOT ROW — ítem individual de la lista de turnos
// ════════════════════════════════════════════════════════════════
interface SlotRowProps {
  slot: { startTime: string; endTime: string };
  onNavigate: (id: string) => void;
  onAppointmentSelected?: (id: number) => void;
  onCancelClick: (appointmentId: number) => void;
}

// ════════════════════════════════════════════════════════════════
// ACTION ICON BUTTON — inline con TurnoDetailView
// ════════════════════════════════════════════════════════════════
function ActionIconBtn({
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
    color = C.textMuted;
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
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={tooltip}
      style={{
        width: 30,
        height: 30,
        borderRadius: 6,
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
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN VIEW — AdmisionView
// ════════════════════════════════════════════════════════════════
export function AdmisionView({
  onNavigate,
  userProfile,
  onAppointmentSelected,
}: AdmisionViewProps) {
  // ── Selección de fecha ──
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // ── Data de turnos ──
  const [appointments, setAppointments] = useState<AppointmentTodayResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Filtros locales ──
  const [filterPatient, setFilterPatient] = useState("");
  const [filterService, setFilterService] = useState("");
  const [showAll, setShowAll] = useState(false);

  // ── Cancel modal ──
  const [cancelModalId, setCancelModalId] = useState<number | null>(null);

  // ── AbortController ──
  const abortRef = useRef<AbortController | null>(null);

  // ════════════════════════════════════════════════════════════════
  // Carga de turnos cuando cambia la fecha seleccionada
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setFetchError(null);
    setAppointments([]);

    const dateStr = toLocalDateStr(selectedDate);
    
    apiClient
      .get("/api/appointments/day", {
        params: { date: dateStr },
        signal: ctrl.signal,
      })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        const data = res.data as AppointmentTodayResponse[];
        setAppointments(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        const axiosErr = err as {
          name?: string;
          code?: string;
          response?: { data?: { message?: string; error?: string } };
        };
        if (
          axiosErr?.name === "CanceledError" ||
          axiosErr?.code === "ERR_CANCELED" ||
          axiosErr?.name === "AbortError"
        )
          return;
        const msg =
          axiosErr?.response?.data?.message ??
          axiosErr?.response?.data?.error ??
          "No se pudieron cargar los turnos. Intentá nuevamente.";
        setFetchError(String(msg));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [selectedDate]);

  // ── Cancelación exitosa: actualizar estado local ──
  const handleCancelSuccess = useCallback(
    (appointmentId: number, status: AppointmentStatus) => {
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
      );
      setCancelModalId(null);
    },
    []
  );

  // ════════════════════════════════════════════════════════════════
  // DERIVADOS: turnos a mostrar
  // ════════════════════════════════════════════════════════════════
  const visibleAppointments = useMemo(() => {
    let list = appointments;

    // Toggle "Mostrar todos" — mostrar solo no cancelados/completados si está desactivado
    if (!showAll) {
      list = list.filter((a) => ACTIVE_STATUSES.includes(a.status));
    }

    // Filtro por paciente (local)
    if (filterPatient.trim()) {
      const term = filterPatient.trim().toLowerCase();
      list = list.filter((a) =>
        a.patient_name.toLowerCase().includes(term) ||
        a.patient_surname.toLowerCase().includes(term)
      );
    }

    // Filtro por servicio/product name (local)
    if (filterService.trim()) {
      const term = filterService.trim().toLowerCase();
      list = list.filter((a) =>
        a.serviceName?.toLowerCase().includes(term) ?? false
      );
    }

    // Ordenar por hora
    return list.sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, showAll, filterPatient, filterService]);

  // Conteos para las píldoras de resumen
  const totalAppointments = appointments.length;
  const activeCount = appointments.filter((a) =>
    ACTIVE_STATUSES.includes(a.status)
  ).length;
  const admittedCount = appointments.filter((a) => a.attendanceConfirmed).length;

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        padding: "32px 36px",
        background: C.bg,
        minHeight: "100%",
        fontFamily: FONT_SANS,
      }}
    >
      <style>{`
        @keyframes dentify-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes dentify-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════ */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 26,
            fontWeight: 400,
            color: C.textPrimary,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          Admisión
        </h1>
        <p
          style={{
            marginTop: 5,
            fontSize: 13,
            color: C.textSecondary,
            fontFamily: FONT_SANS,
            margin: "5px 0 0",
          }}
        >
          Turnos de hoy · {userProfile?.clinicName ?? "—"}
        </p>
      </div>

      {/* ════════════════════════════════════════════
          BARRA DE CONTROLES
      ════════════════════════════════════════════ */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "14px 18px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Buscadores */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, flexWrap: "wrap" }}>
          {/* Buscar por paciente */}
          <SearchInput
            value={filterPatient}
            onChange={setFilterPatient}
            placeholder="Buscar paciente…"
            width={200}
          />

          {/* Buscar por servicio */}
          <SearchInput
            value={filterService}
            onChange={setFilterService}
            placeholder="Buscar servicio…"
            width={200}
          />
        </div>

        {/* Derecha: navegación de fechas */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {/* Botón anterior */}
          <NavBtn
            onClick={() => {
              const prev = new Date(selectedDate);
              prev.setDate(prev.getDate() - 1);
              setSelectedDate(prev);
            }}
            title="Día anterior"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </NavBtn>

          {/* Fecha seleccionada */}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.textPrimary,
              fontFamily: FONT_SANS,
              letterSpacing: "0.01em",
              minWidth: 200,
              textAlign: "center",
            }}
          >
            {capitalize(formatDayLabel(toLocalDateStr(selectedDate)))}
          </span>

          {/* Botón siguiente */}
          <NavBtn
            onClick={() => {
              const next = new Date(selectedDate);
              next.setDate(next.getDate() + 1);
              setSelectedDate(next);
            }}
            title="Día siguiente"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </NavBtn>

          {/* Badge "Hoy" — regresa a la fecha actual */}
          <button
            onClick={() => setSelectedDate(new Date())}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "none",
              background: toLocalDateStr(selectedDate) === toLocalDateStr(new Date()) ? C.electric : C.border,
              color: toLocalDateStr(selectedDate) === toLocalDateStr(new Date()) ? "#fff" : C.textSecondary,
              fontFamily: FONT_SANS,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.02em",
              transition: "all 0.15s",
            }}
          >
            Hoy
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          RESUMEN RÁPIDO — 3 píldoras
      ════════════════════════════════════════════ */}
      {!loading && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <SummaryPill label="Total" value={totalAppointments} color={C.textSecondary} />
          <SummaryPill label="Activos" value={activeCount} color={C.electric} />
          <SummaryPill label="Admitidos" value={admittedCount} color="#16A34A" />
        </div>
      )}

      {/* ════════════════════════════════════════════
          ERROR BANNER (fetch)
      ════════════════════════════════════════════ */}
      {fetchError && (
        <ErrorBanner message={fetchError} onClose={() => setFetchError(null)} />
      )}

      {/* ════════════════════════════════════════════
          LISTA DE TURNOS DE HOY
      ════════════════════════════════════════════ */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Sub-header de la lista */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.textMuted,
              fontFamily: FONT_SANS,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="2" width="10" height="9" rx="2" stroke={C.textMuted} strokeWidth="1.3" />
              <path d="M4 1v2M8 1v2M1 6h10" stroke={C.textMuted} strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Turnos del día
          </span>

          {/* Toggle "Mostrar todos" */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <span style={{ fontSize: 12, color: C.textSecondary, fontFamily: FONT_SANS, fontWeight: 500 }}>
              Mostrar todos
            </span>
            {/* Switch visual */}
            <div
              style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                background: showAll ? C.electric : C.border,
                position: "relative",
                transition: "background 0.2s",
                cursor: "pointer",
              }}
              onClick={() => setShowAll((v) => !v)}
            >
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: showAll ? 16 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  transition: "left 0.2s",
                }}
              />
            </div>
          </label>
        </div>

        {/* Contenido */}
        <div style={{ padding: 16 }}>
          {/* Loading skeleton */}
          {loading && <ListSkeleton />}

          {/* Sin turnos */}
          {!loading && appointments.length === 0 && (
            <EmptyState text="No hay turnos para hoy." />
          )}

          {/* Lista de turnos */}
          {!loading && visibleAppointments.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleAppointments.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appointment={appt}
                  onNavigate={onNavigate}
                  onAppointmentSelected={onAppointmentSelected}
                  onCancelClick={(id) => setCancelModalId(id)}
                />
              ))}
            </div>
          )}

          {/* Resultados vacíos por filtro */}
          {!loading && appointments.length > 0 && visibleAppointments.length === 0 && (
            <EmptyState text="No hay turnos que coincidan con los filtros aplicados." />
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          CANCEL MODAL
      ════════════════════════════════════════════ */}
      {cancelModalId !== null && (
        <CancelModal
          appointmentId={cancelModalId}
          onClose={() => setCancelModalId(null)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// HELPERS DE RENDERIZADO
// ════════════════════════════════════════════════════════════════

/** Botón de navegación < > */
function NavBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 30,
        height: 30,
        borderRadius: 7,
        border: `1.5px solid ${hovered ? C.electric : C.border}`,
        background: hovered ? C.activeItemBg : C.cardBg,
        color: hovered ? C.electric : C.textSecondary,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

/** Input de búsqueda con icono lupa */
function SearchInput({
  value,
  onChange,
  placeholder,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative", width }}>
      <div
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: C.textMuted,
          display: "flex",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5.5" cy="5.5" r="4" />
          <path d="M8.5 8.5l3 3" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "9px 12px 9px 32px",
          border: `1.5px solid ${focused ? C.electric : C.border}`,
          borderRadius: 8,
          fontFamily: FONT_SANS,
          fontSize: 13,
          color: C.textPrimary,
          background: C.cardBg,
          outline: "none",
          boxSizing: "border-box",
          boxShadow: focused ? `0 0 0 3px rgba(37,99,235,0.10)` : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      />
    </div>
  );
}

/** Píldora de resumen rápido */
function SummaryPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 20,
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        fontFamily: FONT_SANS,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary }}>
        {label}:
      </span>
      <span style={{ fontSize: 13, fontWeight: 800, color }}>
        {value}
      </span>
    </div>
  );
}