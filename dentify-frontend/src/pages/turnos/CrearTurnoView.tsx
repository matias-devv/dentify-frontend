// ════════════════════════════════════════════════════════════════════════════
// CrearTurnoView.tsx — Vista "Crear Turno" — Dentify Dashboard
// Recibe SelectedSlotContext desde OtorgarTurnoView al hacer click en slot libre
// TypeScript estricto · cero any · sin librerías nuevas · localStorage fallback hybrid
// ════════════════════════════════════════════════════════════════════════════
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import apiClient from "../../api/apiClient";
import { getSelectedSlotContext, clearSelectedSlotContext, type SelectedSlotContext } from "./TurnosViews";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS — idénticos a TurnosViews.tsx
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

// ════════════════════════════════════════════════════════════════
// TIPOS — SelectedSlotContext (importado desde TurnosViews.tsx)
// ════════════════════════════════════════════════════════════════
// export interface SelectedSlotContext { ... } ← ver TurnosViews.tsx

// ════════════════════════════════════════════════════════════════
// TIPOS — AgendaItem extendido con dentist_id
// El backend ahora retorna el record CreateAgendaResponse que incluye:
//   Long dentist_id, String dentist_full_name
// ════════════════════════════════════════════════════════════════
interface AgendaItem {
  id_agenda: number;
  agenda_name: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  dentist_id?: number;         // NUEVO — id del dentista dueño de la agenda
  dentist_full_name?: string;  // NUEVO — nombre del dentista para display
}

// ════════════════════════════════════════════════════════════════
// TIPOS — API request / response
// ════════════════════════════════════════════════════════════════
interface CreateAppointmentRequest {
  id_patient: number;
  id_dentist: number;
  id_agenda: number;
  id_product: number;
  date: string;                         // "YYYY-MM-DD"
  start_time: string;                   // "HH:mm"
  duration_minutes: number;
  paymentMethod: "CASH" | "MERCADO_PAGO";
  payNow: boolean | null;
  notes: string | null;
  patient_instructions: string | null;
}

export interface CreateAppointmentResponse {
  id_appointment: number;
  id_pay: number;
  id_treatment: number;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  amount_to_pay: number;
  payment_method: "CASH" | "MERCADO_PAGO";
  payment_link: string | null;
  appointment_status: "SCHEDULED";
  payment_status: "PAID" | "PENDING";
  product_name: string;
}

// ════════════════════════════════════════════════════════════════
// TIPOS — entidades del autocomplete
// ════════════════════════════════════════════════════════════════
interface PatientResult {
  id: number;
  name: string;
  surname: string;
  dni: string;
  phone: string | null;
  birthdate: string | null;
  coverageType: string | null;
}

interface ProductResult {
  id: number;
  name: string;
  category: string;
}

// ════════════════════════════════════════════════════════════════
// TIPOS — props de la vista
// ════════════════════════════════════════════════════════════════
interface UserProfileShape {
  name: string;
  surname: string;
  clinicName: string;
  roles: string[];
}

interface CrearTurnoViewProps {
  onNavigate: (id: string) => void;
  userProfile: UserProfileShape | null;
  slotContext: SelectedSlotContext | null;
  onAppointmentCreated?: (response: CreateAppointmentResponse) => void;
}

// TODO: TurnoDetailView — recibe CreateAppointmentResponse y muestra el resumen del turno creado
// Navegar con: onNavigate("turno-detail")
// Props necesarias: appointmentData: CreateAppointmentResponse

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

/** Calcula diferencia en minutos entre "HH:mm:ss" o "HH:mm". Retorna 0 si inválido. */
const calcDurationMinutes = (start: string, end: string): number => {
  const parse = (t: string): number | null => {
    const parts = t.split(":");
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };
  const s = parse(start);
  const e = parse(end);
  if (s === null || e === null || e <= s) return 0;
  return e - s;
};

/** Formatea "2026-04-22" → "22 de abril de 2026" sin desfase de timezone. */
const formatSlotDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/** Formatea "HH:mm:ss" → "HH:mm". */
const fmtTime = (t: string): string => (t ? t.slice(0, 5) : "—");

/** Valida si el slot corresponde a un datetime pasado. */
const isSlotPastDatetime = (slotDate: string, startTime: string): boolean => {
  if (!slotDate || !startTime) return false;
  try {
    // Construir datetime combinando slotDate + startTime (formato "HH:mm" o "HH:mm:ss")
    const timeStr = startTime.slice(0, 5); // Garantizar "HH:mm"
    const slotDatetime = new Date(`${slotDate}T${timeStr}`);
    const now = new Date();
    // Es pasado si el datetime del slot < ahora
    return slotDatetime < now;
  } catch {
    return false;
  }
};

/** Mapea coverageType de backend (inglés) a español. */
const mapCoverageType = (ct: string | null | undefined): string => {
  switch (ct) {
    case "SELF_PAY":
      return "Particular";
    case "HEALTH_INSURANCE":
      return "Obra social";
    case "PREPAID_INSURANCE":
      return "Prepaga";
    case "OTHER":
      return "Otra cobertura";
    default:
      return "Sin cobertura";
  }
};

/** Mapea name_speciality de backend (inglés) a español. */
const mapSpeciality = (s: string | null | undefined): string => {
  switch (s) {
    case "general_dentistry":
      return "Odontología general";
    case "orthodontics":
      return "Ortodoncia";
    case "endodontics":
      return "Endodoncia";
    case "periodontics":
      return "Periodoncia";
    case "pediatric_dentistry":
      return "Odontología pediátrica";
    case "oral_surgery":
      return "Cirugía oral";
    case "prosthodontics":
      return "Prostodoncia";
    case "cosmetic_dentistry":
      return "Odontología estética";
    default:
      return s ?? "";
  }
};

// ════════════════════════════════════════════════════════════════
// HOOK — useDebounce
// ════════════════════════════════════════════════════════════════
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}



// ════════════════════════════════════════════════════════════════
// HOOK — useFetchAllPatients (fetch una sola vez, filtrar localmente)
// ════════════════════════════════════════════════════════════════
interface UseFetchAllPatientsState {
  patients: PatientResult[];
  loading: boolean;
  fallback: boolean;
}

function useFetchAllPatients(): UseFetchAllPatientsState {
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiClient
      .post("/api/patients/find-all/by-clinic")
      .then((res: { data: Array<{ id: number; name: string; surname: string; dni: string; phoneNumber?: string | null; dateOfBirth?: string | null; coverageType?: string | null }> }) => {
        const mapped = (res.data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          surname: p.surname,
          dni: p.dni,
          phone: p.phoneNumber ?? null,
          birthdate: p.dateOfBirth ?? null,
          coverageType: p.coverageType ?? null,
        }));
        setPatients(mapped);
        setFallback(false);
      })
      .catch((err: unknown) => {
        const e = err as { name?: string; code?: string };
        if (
          e?.name === "CanceledError" ||
          e?.code === "ERR_CANCELED" ||
          e?.name === "AbortError"
        ) return;
        setFallback(true);
        setPatients([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { patients, loading, fallback };
}

// ════════════════════════════════════════════════════════════════
// HOOK — useFetchAllProducts (fetch una sola vez, filtrar localmente)
// ════════════════════════════════════════════════════════════════
interface UseFetchAllProductsState {
  products: ProductResult[];
  loading: boolean;
  fallback: boolean;
}

function useFetchAllProducts(): UseFetchAllProductsState {
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/api/products/active")
      .then((res: { data: Array<{ id_product: number; name_product: string; unit_price?: number; description?: string; id_speciality?: number; name_speciality: string }> }) => {
        const mapped = (res.data ?? []).map((p) => ({
          id: p.id_product,
          name: p.name_product,
          category: mapSpeciality(p.name_speciality),
        }));
        setProducts(mapped);
        setFallback(false);
      })
      .catch((err: unknown) => {
        const e = err as { name?: string; code?: string };
        if (
          e?.name === "CanceledError" ||
          e?.code === "ERR_CANCELED" ||
          e?.name === "AbortError"
        ) return;
        setFallback(true);
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { products, loading, fallback };
}

// ════════════════════════════════════════════════════════════════
// MINI COMPONENTS
// ════════════════════════════════════════════════════════════════

function EmptyState({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        padding: "72px 0",
        textAlign: "center",
        fontFamily: FONT_SANS,
        background: C.bg,
        minHeight: "100%",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          margin: "0 auto 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 5.5v5M9 12.5v.5"
            stroke={C.textMuted}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="9" cy="9" r="7.5" stroke={C.textMuted} strokeWidth="1.4" />
        </svg>
      </div>
      <p style={{ fontSize: 13, color: C.textMuted, fontFamily: FONT_SANS, marginBottom: onAction ? 18 : 0 }}>
        {text}
      </p>
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          style={{
            padding: "9px 22px",
            borderRadius: 7,
            border: `1.5px solid ${C.border}`,
            background: C.cardBg,
            color: C.electric,
            fontFamily: FONT_SANS,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function PastSlotError({ onAction }: { onAction: () => void }) {
  return (
    <div
      style={{
        padding: "64px 32px",
        textAlign: "center",
        fontFamily: FONT_SANS,
        background: C.bg,
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        {/* Ícono de reloj/calendario */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: C.errorBg,
            border: `1px solid ${C.errorBorder}`,
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke={C.errorIcon} strokeWidth="1.8" />
            <path d="M12 7v5l3.5 2" stroke={C.errorIcon} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {/* Título */}
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: C.textPrimary,
            marginBottom: 8,
            letterSpacing: "-0.01em",
          }}
        >
          Este turno ya no está disponible
        </h3>
        {/* Subtítulo */}
        <p
          style={{
            fontSize: 13,
            color: C.textSecondary,
            lineHeight: 1.6,
            marginBottom: 24,
            fontFamily: FONT_SANS,
          }}
        >
          El horario seleccionado pertenece a una fecha u hora pasada. Seleccioná un turno próximo desde el calendario.
        </p>
        {/* Botón primario */}
        <button
          onClick={onAction}
          style={{
            padding: "11px 32px",
            borderRadius: 8,
            border: "none",
            background: C.electric,
            color: "#fff",
            fontFamily: FONT_SANS,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#1d4ed8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = C.electric;
          }}
        >
          Volver al calendario
        </button>
      </div>
    </div>
  );
}

function InlineSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ animation: "dentify-spin 0.7s linear infinite" }}
    >
      <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
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
        marginBottom: 20,
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
        aria-label="Cerrar"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.errorText, display: "flex", alignItems: "center", flexShrink: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke={C.errorText} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function SectionLabel({
  children,
  required,
  badge,
}: {
  children: React.ReactNode;
  required?: boolean;
  badge?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: C.textMuted,
          fontFamily: FONT_SANS,
          lineHeight: 1,
        }}
      >
        {children}
        {required && <span style={{ color: C.electric, marginLeft: 2 }}>*</span>}
      </label>
      {badge && (
        <span
          style={{
            background: "#F4F5F7",
            color: C.textMuted,
            fontSize: 9,
            fontWeight: 600,
            borderRadius: 4,
            padding: "2px 7px",
            fontFamily: FONT_SANS,
            letterSpacing: "0.04em",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function FormSection({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "20px 24px",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function StyledTextarea({
  placeholder,
  value,
  onChange,
  rows = 3,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        padding: "10px 14px",
        border: `1.5px solid ${focused ? C.electric : C.border}`,
        borderRadius: 8,
        fontFamily: FONT_SANS,
        fontSize: 14,
        color: C.textPrimary,
        background: C.cardBg,
        outline: "none",
        resize: "vertical",
        lineHeight: 1.6,
        transition: "border-color 0.15s",
        boxSizing: "border-box",
        boxShadow: focused ? `0 0 0 3px rgba(37,99,235,0.10)` : "none",
      }}
    />
  );
}

function SelectedChip({ text, onClear }: { text: string; onClear: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: C.activeItemBg,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "8px 12px",
        marginTop: 4,
        fontFamily: FONT_SANS,
        fontSize: 13.5,
        color: C.textPrimary,
        lineHeight: 1.5,
        gap: 10,
      }}
    >
      <span style={{ flex: 1 }}>{text}</span>
      <button
        onClick={onClear}
        aria-label="Eliminar selección"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.textMuted, display: "flex", alignItems: "center", flexShrink: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function ResultsDropdown({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        right: 0,
        background: C.cardBg,
        border: `1.5px solid ${C.border}`,
        borderRadius: 8,
        zIndex: 20,
        maxHeight: 220,
        overflowY: "auto",
        boxShadow: "0 4px 20px rgba(15,34,68,0.08)",
      }}
    >
      {children}
    </div>
  );
}

function DropdownItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseDown={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        width: "100%",
        padding: "10px 14px",
        background: hovered ? C.activeItemBg : "transparent",
        border: "none",
        borderBottom: `1px solid ${C.border}`,
        textAlign: "left",
        fontFamily: FONT_SANS,
        fontSize: 13.5,
        color: C.textPrimary,
        cursor: "pointer",
        transition: "background 0.1s",
        lineHeight: 1.5,
      }}
    >
      {children}
    </button>
  );
}

function SearchInput({
  placeholder,
  value,
  onChange,
  onFocusChange,
  loading = false,
  disabled = false,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onFocusChange?: (focused: boolean) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { setFocused(true); onFocusChange?.(true); }}
        onBlur={() => { setFocused(false); onFocusChange?.(false); }}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "10px 40px 10px 14px",
          border: `1.5px solid ${focused ? C.electric : C.border}`,
          borderRadius: 8,
          fontFamily: FONT_SANS,
          fontSize: 14,
          color: C.textPrimary,
          background: disabled ? "#F9FAFB" : C.cardBg,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.15s",
          boxShadow: focused ? `0 0 0 3px rgba(37,99,235,0.10)` : "none",
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
      <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: C.textMuted, display: "flex" }}>
        {loading ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: "dentify-spin 0.7s linear infinite" }}>
            <circle cx="7" cy="7" r="5.5" stroke={C.border} strokeWidth="1.8" />
            <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke={C.textMuted} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5l3 3" />
          </svg>
        )}
      </div>
    </div>
  );
}

function PillToggle<T extends string>({
  options,
  value,
  onChange,
  size = "normal",
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  size?: "normal" | "small";
}) {
  const padding = size === "small" ? "6px 16px" : "8px 20px";
  const fontSize = size === "small" ? 13.5 : 13.5;
  return (
    <div style={{ display: "inline-flex", border: `1.5px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: "#F4F5F7" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding,
            border: "none",
            cursor: "pointer",
            fontFamily: FONT_SANS,
            fontSize,
            fontWeight: 600,
            background: value === opt.value ? C.electric : "transparent",
            color: value === opt.value ? "#fff" : C.textSecondary,
            transition: "all 0.15s",
            letterSpacing: "0.01em",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — SlotInfoCard (solo lectura)
// ════════════════════════════════════════════════════════════════
function SlotInfoCard({ slot }: { slot: SelectedSlotContext }) {
  const duration = calcDurationMinutes(slot.startTime, slot.endTime);
  const fields = [
    { label: "Nombre de la agenda", value: slot.agendaName },
    { label: "Fecha", value: formatSlotDate(slot.slotDate) },
    { label: "Hora", value: `${fmtTime(slot.startTime)} – ${fmtTime(slot.endTime)}` },
    { label: "Duración", value: duration > 0 ? `${duration} min` : "—" },
  ];
  return (
    <div
      style={{
        background: C.activeItemBg,
        border: `1.5px solid rgba(37,99,235,0.25)`,
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 28,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "14px 24px",
        fontFamily: FONT_SANS,
      }}
    >
      {fields.map((f) => (
        <div key={f.label}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textMuted, lineHeight: 1 }}>
            {f.label}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginTop: 4, lineHeight: 1.3 }}>
            {f.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — StickyHeader
// ════════════════════════════════════════════════════════════════
function StickyHeader({
  submitting,
  isFormValid,
  onCancel,
  onSave,
}: {
  submitting: boolean;
  isFormValid: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [cancelHovered, setCancelHovered] = useState(false);
  const saveDisabled = !isFormValid || submitting;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: C.cardBg,
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", color: C.textPrimary, textTransform: "uppercase" }}>
          Otorgar turno
        </span>
        <span
          style={{
            background: C.electric,
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 4,
            padding: "3px 10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginLeft: 12,
            fontFamily: FONT_SANS,
          }}
        >
          Presencial
        </span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel}
          onMouseEnter={() => setCancelHovered(true)}
          onMouseLeave={() => setCancelHovered(false)}
          style={{
            padding: "9px 22px",
            borderRadius: 7,
            border: `1.5px solid ${cancelHovered ? C.electric : C.border}`,
            background: C.cardBg,
            color: cancelHovered ? C.electric : C.textSecondary,
            fontFamily: FONT_SANS,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "border-color 0.12s, color 0.12s",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={saveDisabled}
          style={{
            padding: "9px 22px",
            borderRadius: 7,
            border: "none",
            background: saveDisabled ? "#93AEDE" : C.electric,
            color: "#fff",
            fontFamily: FONT_SANS,
            fontSize: 13,
            fontWeight: 700,
            cursor: saveDisabled ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "background 0.15s",
          }}
        >
          {submitting ? <><InlineSpinner />Guardando...</> : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — FallbackSelect genérico
// TODO: reemplazar por autocomplete cuando los endpoints estén disponibles
// ════════════════════════════════════════════════════════════════
function FallbackSelect({ entityName }: { entityName: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <select
        value=""
        onChange={() => { /* no-op hasta que endpoint esté disponible */ }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "10px 36px 10px 14px",
          border: `1.5px solid ${focused ? C.electric : C.border}`,
          borderRadius: 8,
          fontFamily: FONT_SANS,
          fontSize: 13,
          color: C.textMuted,
          background: C.cardBg,
          appearance: "none",
          outline: "none",
          cursor: "pointer",
          boxSizing: "border-box",
        }}
      >
        <option value="" disabled>
          Buscador de {entityName} no disponible — reintentá en un momento
        </option>
      </select>
      <p style={{ fontSize: 11, color: C.textMuted, marginTop: 6, fontFamily: FONT_SANS }}>
        El servicio de búsqueda no está disponible en este momento.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN VIEW — CrearTurnoView
// ════════════════════════════════════════════════════════════════
export function CrearTurnoView({
  onNavigate,
  userProfile: _userProfile,
  slotContext: slotContextProp,
  onAppointmentCreated,
}: CrearTurnoViewProps) {
  // ── Opción C HYBRID: intenta recibir slotContext como prop y fallback a localStorage ──
  const [slotContext, setSlotContext] = useState<SelectedSlotContext | null>(slotContextProp ?? null);

  // Llenar desde localStorage al mount si prop es null
  useEffect(() => {
    if (slotContextProp === null && slotContext === null) {
      const stored = getSelectedSlotContext();
      
      if (stored) {
        setSlotContext(stored);
      }
    }
  }, []);

  useEffect(() => {
  if (slotContext?.productId != null && slotContext.productName) {
    setSelectedProduct({
      id: slotContext.productId,
      name: slotContext.productName,
      category: "",
    });
  }
  }, [slotContext?.productId, slotContext?.productName]);

  // Paciente ──
  const [patientQuery, setPatientQuery] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);

  // ── Producto ──
  const [productQuery, setProductQuery] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(null);

  // ── Pago ──
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MERCADO_PAGO" | null>(null);
  const [payNow, setPayNow] = useState<boolean | null>(null);

  // ── Notas ──
  const [patientInstructions, setPatientInstructions] = useState("");
  const [notes, setNotes] = useState("");

  // ── UI ──
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Debounce ──
  const debouncedPatientQ = useDebounce(patientQuery, 300);
  const debouncedProductQ = useDebounce(productQuery, 300);

  // ── Fetch all patients and products once on mount ──
  const {
    patients: allPatients,
    loading: patientsFetching,
    fallback: patientsFallback,
  } = useFetchAllPatients();

  const {
    products: allProducts,
    loading: productsFetching,
    fallback: productsFallback,
  } = useFetchAllProducts();

  // ── Filter patients locally (case insensitive) ──
  const patientResults = useMemo(() => {
    if (!debouncedPatientQ.trim()) return [];
    const q = debouncedPatientQ.toLowerCase();
    return allPatients.filter((p) =>
      `${p.name} ${p.surname} ${p.dni}`.toLowerCase().includes(q)
    );
  }, [allPatients, debouncedPatientQ]);

  // ── Filter products locally (case insensitive) ──
  const productResults = useMemo(() => {
    if (!debouncedProductQ.trim()) return [];
    const q = debouncedProductQ.toLowerCase();
    return allProducts.filter((p) =>
      p.name.toLowerCase().includes(q)
    );
  }, [allProducts, debouncedProductQ]);

  // ── Determine loading and fallback state ──
  const patientLoading = patientsFetching;
  const patientFallback = patientsFallback;
  const productLoading = productsFetching;
  const productFallback = productsFallback;

  // ── Resetear payNow al cambiar a MERCADO_PAGO ──
  useEffect(() => {
    if (paymentMethod === "MERCADO_PAGO") setPayNow(null);
  }, [paymentMethod]);

  // ── Validación para habilitar GUARDAR ──
  const isFormValid = useMemo(() => {
    if (!slotContext) return false;
    // Segunda línea de defensa: validar que el slot no sea pasado
    if (isSlotPastDatetime(slotContext.slotDate, slotContext.startTime)) return false;
    if (slotContext.dentistId == null) return false;
    if (!selectedPatient) return false;
    if (!selectedProduct) return false;
    if (!paymentMethod) return false;
    if (paymentMethod === "CASH" && payNow === null) return false;
    return true;
  }, [slotContext, selectedPatient, selectedProduct, paymentMethod, payNow]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!isFormValid || !slotContext || !selectedPatient || !selectedProduct || !paymentMethod) return;

    if (slotContext.dentistId == null) {
      setErrorMsg("No se pudo resolver el profesional de la agenda. Intentá nuevamente.");
      return;
    }

    const body: CreateAppointmentRequest = {
      id_patient: selectedPatient.id,
      id_dentist: slotContext.dentistId,
      id_agenda: slotContext.agendaId,
      id_product: selectedProduct.id,
      date: slotContext.slotDate,
      start_time: slotContext.startTime.slice(0, 5),
      duration_minutes: calcDurationMinutes(slotContext.startTime, slotContext.endTime),
      paymentMethod,
      payNow: paymentMethod === "CASH" ? payNow : null,
      notes: notes.trim() || null,
      patient_instructions: patientInstructions.trim() || null,
    };

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await apiClient.post("/api/appointments/save", body);
      const data = res.data as CreateAppointmentResponse;
      onAppointmentCreated?.(data);
      // Limpiar localStorage después de crear el turno exitosamente
      clearSelectedSlotContext();
      onNavigate("turno-detail");
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string; error?: string } };
      };
      const msg =
        axiosErr?.response?.data?.message ??
        axiosErr?.response?.data?.error ??
        "Ocurrió un error al guardar el turno. Intentá nuevamente.";
      setErrorMsg(String(msg));
    } finally {
      setSubmitting(false);
    }
  }, [
    isFormValid, slotContext, selectedPatient, selectedProduct,
    paymentMethod, payNow, notes, patientInstructions,
    onAppointmentCreated, onNavigate,
  ]);

  // ── Guard: slotContext null ──
  if (!slotContext) {
    return (
      <EmptyState
        text="No se seleccionó un slot válido. Volvé al calendario."
        actionLabel="Volver al calendario"
        onAction={() => {
          clearSelectedSlotContext();
          onNavigate("turnos");
        }}
      />
    );
  }

  // ── Guard: slot corresponde a datetime pasado ──
  if (isSlotPastDatetime(slotContext.slotDate, slotContext.startTime)) {
    return (
      <PastSlotError
        onAction={() => {
          clearSelectedSlotContext();
          onNavigate("turnos");
        }}
      />
    );
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: C.bg, fontFamily: FONT_SANS }}>
      <style>{`
        @keyframes dentify-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes dentify-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ── HEADER STICKY ── */}
      <StickyHeader
        submitting={submitting}
        isFormValid={isFormValid}
        onCancel={() => onNavigate("turnos")}
        onSave={handleSubmit}
      />

      {/* ── BODY SCROLLEABLE ── */}
      <div style={{ padding: "32px 36px", flex: 1, overflowY: "auto" }}>

        {errorMsg && <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} />}

        {/* ── Card info del slot (solo lectura) ── */}
        <SlotInfoCard slot={slotContext} />

        {/* ════════════════════════════════════════════════════
            SECCIÓN: PACIENTE
        ════════════════════════════════════════════════════ */}
        <FormSection>
          <SectionLabel required>Paciente</SectionLabel>

          {selectedPatient ? (
            <SelectedChip
              text={[
                `${selectedPatient.surname}, ${selectedPatient.name}`,
                `DNI: ${selectedPatient.dni}`,
                mapCoverageType(selectedPatient.coverageType),
                selectedPatient.phone ? `Tel: ${selectedPatient.phone}` : null,
                selectedPatient.birthdate ? `Nac. ${selectedPatient.birthdate}` : null,
              ].filter((v): v is string => v !== null && v !== "").join("  ·  ")}
              onClear={() => { setSelectedPatient(null); setPatientQuery(""); }}
            />
          ) : patientFallback ? (
            // TODO: reemplazar por autocomplete cuando el endpoint /api/patients/search esté disponible
            <FallbackSelect entityName="pacientes" />
          ) : (
            <div style={{ position: "relative" }}>
              <SearchInput
                placeholder="Busca un paciente"
                value={patientQuery}
                onChange={(v) => { setPatientQuery(v); setPatientDropdownOpen(true); }}
                onFocusChange={(f) => { if (f) setPatientDropdownOpen(true); }}
                loading={patientLoading}
              />
              {patientDropdownOpen && patientResults.length > 0 && (
                <ResultsDropdown>
                  {patientResults.map((p) => (
                    <DropdownItem
                      key={p.id}
                      onClick={() => { setSelectedPatient(p); setPatientQuery(""); setPatientDropdownOpen(false); }}
                    >
                      <span style={{ fontWeight: 600 }}>{p.surname}, {p.name}</span>
                      <span style={{ color: C.textMuted, marginLeft: 8 }}>DNI: {p.dni}</span>
                      {p.phone && <span style={{ color: C.textMuted, marginLeft: 8 }}>Tel: {p.phone}</span>}
                    </DropdownItem>
                  ))}
                </ResultsDropdown>
              )}
              {patientDropdownOpen && !patientLoading && patientResults.length === 0 && debouncedPatientQ.trim().length >= 2 && (
                <ResultsDropdown>
                  <div style={{ padding: "12px 14px", fontSize: 12, color: C.textMuted, fontFamily: FONT_SANS }}>
                    No se encontraron pacientes con ese nombre o DNI
                  </div>
                </ResultsDropdown>
              )}
            </div>
          )}
        </FormSection>

        {/* ════════════════════════════════════════════════════
            SECCIÓN: PRODUCTO / SERVICIO
        ════════════════════════════════════════════════════ */}
        <FormSection>
  <SectionLabel required>Producto / Servicio</SectionLabel>

  {selectedProduct ? (
    <SelectedChip
      text={[
        selectedProduct.name,
        selectedProduct.category || null,
        // Indicar visualmente si proviene de la agenda
        selectedProduct.id === slotContext?.productId
          ? "Pre-seleccionado desde la agenda"
          : null,
      ]
        .filter((v): v is string => v !== null && v !== "")
        .join("  ·  ")}
      onClear={() => {
        setSelectedProduct(null);
        setProductQuery("");
      }}
    />
  ) : productFallback ? (
    <FallbackSelect entityName="productos" />
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Input de búsqueda */}
      <div style={{ position: "relative" }}>
        <SearchInput
          placeholder="Buscar por nombre de producto o servicio"
          value={productQuery}
          onChange={(v) => {
            setProductQuery(v);
            setProductDropdownOpen(true);
          }}
          onFocusChange={(f) => {
            if (f) setProductDropdownOpen(true);
          }}
          loading={productLoading}
        />
        {productDropdownOpen && productResults.length > 0 && (
          <ResultsDropdown>
            {productResults.map((p) => (
              <DropdownItem
                key={p.id}
                onClick={() => {
                  setSelectedProduct(p);
                  setProductQuery("");
                  setProductDropdownOpen(false);
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                {p.category && (
                  <span style={{ color: C.textMuted, marginLeft: 8 }}>
                    {p.category}
                  </span>
                )}
              </DropdownItem>
            ))}
          </ResultsDropdown>
        )}
        {productDropdownOpen &&
          !productLoading &&
          productResults.length === 0 &&
          debouncedProductQ.trim().length >= 2 && (
            <ResultsDropdown>
              <div
                style={{
                  padding: "12px 14px",
                  fontSize: 12,
                  color: C.textMuted,
                  fontFamily: FONT_SANS,
                }}
              >
                No se encontraron productos o servicios
              </div>
            </ResultsDropdown>
          )}
      </div>

      {/* Botón de pre-selección — solo si la agenda tiene producto asignado */}
      {slotContext?.productId != null && slotContext.productName && (
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.textMuted,
              fontFamily: FONT_SANS,
              marginBottom: 6,
            }}
          >
            Pre-seleccionado desde la agenda
          </p>
          <button
            onClick={() => {
              setSelectedProduct({
                id: slotContext.productId!,
                name: slotContext.productName!,
                category: "",
              });
              setProductQuery("");
              setProductDropdownOpen(false);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              border: `1.5px solid rgba(37,99,235,0.35)`,
              borderRadius: 7,
              background: C.activeItemBg,
              color: C.electric,
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "border-color 0.12s, background 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.electric;
              e.currentTarget.style.background = "#DBEAFE";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(37,99,235,0.35)";
              e.currentTarget.style.background = C.activeItemBg;
            }}
          >
            {/* Ícono check */}
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="6" stroke={C.electric} strokeWidth="1.4" />
              <path
                d="M4 6.5l1.8 1.8L9.5 5"
                stroke={C.electric}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {slotContext.productName}
          </button>
        </div>
      )}
    </div>
  )}
</FormSection>

        {/* ════════════════════════════════════════════════════
            SECCIÓN: PAGO
        ════════════════════════════════════════════════════ */}
        <FormSection>
          <SectionLabel required>Método de pago</SectionLabel>

          <PillToggle
            options={[
              { value: "CASH" as const, label: "Efectivo" },
              { value: "MERCADO_PAGO" as const, label: "Mercado Pago" },
            ]}
            value={paymentMethod}
            onChange={(v) => setPaymentMethod(v)}
          />

          {paymentMethod === "CASH" && (
            <div style={{ marginTop: 16 }}>
              <SectionLabel required>¿El paciente paga ahora?</SectionLabel>
              <PillToggle
                options={[
                  { value: "true" as const, label: "Sí" },
                  { value: "false" as const, label: "No" },
                ]}
                value={payNow === null ? null : String(payNow) as "true" | "false"}
                onChange={(v) => setPayNow(v === "true")}
                size="small"
              />
            </div>
          )}

          {paymentMethod === "MERCADO_PAGO" && (
            <p style={{ marginTop: 10, fontSize: 13, color: C.textMuted, fontStyle: "italic", fontFamily: FONT_SANS, lineHeight: 1.5 }}>
              Se generará un link de pago de Mercado Pago y se enviará al paciente por email.
            </p>
          )}
        </FormSection>

        {/* ════════════════════════════════════════════════════
            SECCIÓN: INSTRUCCIONES Y NOTAS
        ════════════════════════════════════════════════════ */}
        <FormSection>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <SectionLabel>Instrucciones para el paciente</SectionLabel>
              <StyledTextarea
                placeholder="Se enviarán en el recordatorio"
                value={patientInstructions}
                onChange={setPatientInstructions}
                rows={3}
              />
            </div>
            <div>
              <SectionLabel badge="Solo visible para vos">Notas internas</SectionLabel>
              <StyledTextarea
                placeholder="No se enviarán al paciente"
                value={notes}
                onChange={setNotes}
                rows={3}
              />
            </div>
          </div>
        </FormSection>

      </div>
    </div>
  );
}