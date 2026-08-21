// ════════════════════════════════════════════════════════════════════════════
// CrearTurnoView.tsx — Vista "Crear Turno" — Dentify Dashboard
// Recibe SelectedSlotContext desde OtorgarTurnoView al hacer click en slot libre
// TypeScript estricto · cero any · sin librerías nuevas · localStorage fallback hybrid
//
// NOTA DE DISEÑO: esta vista usa la tipografía 'Playfair Display' para títulos
// serif (header de módulo, SlotPanel, PastSlotError). Si el proyecto no la
// carga globalmente todavía, agregar en el <head> del punto de entrada:
//   <link rel="preconnect" href="https://fonts.googleapis.com">
//   <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
// Como defensa adicional, el componente también la solicita en runtime más abajo.
// ════════════════════════════════════════════════════════════════════════════
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate as useRouterNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { getSelectedSlotContext, clearSelectedSlotContext, type SelectedSlotContext } from "./TurnosViews";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS — sistema de paleta nuevo (ex Figma T)
// ════════════════════════════════════════════════════════════════
const T = {
  bg:            "#F4F3F0",
  bgWhite:       "#FFFFFF",
  bgLight:       "#F8F8F6",
  bgDark:        "#0A1628",
  accent:        "#1A6FD4",
  accentBright:  "#4A9EE8",
  accentNavy:    "#1A3A6A",
  textPrimary:   "#0A1628",
  textSecondary: "#5A6A7A",
  textMuted:     "#6A7A8A",
  textSubtle:    "#7A8A9A",
  borderLight:   "#EAEAE6",
  borderPanel:   "#E8EFF6",
  activeItemBg:  "#EEF4FD",
  errorBg:       "#FEF2F2",
  errorBorder:   "#FECACA",
  errorText:     "#991B1B",
  errorIcon:     "#EF4444",
} as const;

const SANS = "'DM Sans', sans-serif";
const SERIF = "'Playfair Display', serif";

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
  onNavigate?: (id: string) => void;        // ← opcional
  userProfile: UserProfileShape | null;
  slotContext?: SelectedSlotContext | null;  // ← opcional
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
// ATOMS — sistema visual nuevo (ex Figma export)
// ════════════════════════════════════════════════════════════════

function Spinner({ color = "#fff" }: { color?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      style={{ animation: "dentify-spin 0.7s linear infinite", flexShrink: 0 }}
    >
      <circle cx="6.5" cy="6.5" r="5" stroke={`${color}40`} strokeWidth="1.8" />
      <path d="M6.5 1.5A5 5 0 0 1 11.5 6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Label({
  children,
  required,
  badge,
}: {
  children: React.ReactNode;
  required?: boolean;
  badge?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: T.textMuted,
          fontFamily: SANS,
        }}
      >
        {children}
        {required && <span style={{ color: T.accent, marginLeft: 3 }}>*</span>}
      </span>
      {badge && (
        <span
          style={{
            background: T.bgLight,
            border: `1px solid ${T.borderLight}`,
            color: T.textMuted,
            fontSize: 9,
            fontWeight: 600,
            borderRadius: 4,
            padding: "2px 7px",
            fontFamily: SANS,
            letterSpacing: "0.05em",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: T.bgWhite,
        border: `1px solid ${T.borderLight}`,
        borderRadius: 12,
        padding: "22px 24px",
        boxShadow: "0 1px 4px rgba(10,22,40,0.04)",
      }}
    >
      {children}
    </div>
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
      <span
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: T.textMuted,
          pointerEvents: "none",
          display: "flex",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="4.5" />
          <path d="M9.5 9.5l3 3" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { setFocused(true); onFocusChange?.(true); }}
        onBlur={() => { setFocused(false); onFocusChange?.(false); }}
        style={{
          width: "100%",
          padding: "10px 38px 10px 36px",
          border: `1.5px solid ${focused ? T.accent : T.borderLight}`,
          borderRadius: 8,
          fontFamily: SANS,
          fontSize: 13.5,
          color: T.textPrimary,
          background: disabled ? T.bgLight : T.bgWhite,
          outline: "none",
          boxSizing: "border-box",
          boxShadow: focused ? "0 0 0 3px rgba(26,111,212,0.09)" : "none",
          transition: "border-color .15s, box-shadow .15s",
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
      {loading && (
        <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
          <Spinner color={T.textMuted} />
        </div>
      )}
    </div>
  );
}

function Dropdown({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        right: 0,
        background: T.bgWhite,
        border: `1.5px solid ${T.borderLight}`,
        borderRadius: 10,
        zIndex: 40,
        maxHeight: 220,
        overflowY: "auto",
        boxShadow: "0 8px 28px rgba(10,22,40,0.12)",
      }}
    >
      {children}
    </div>
  );
}

function DropItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseDown={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: "10px 14px",
        background: hov ? T.activeItemBg : "transparent",
        border: "none",
        borderBottom: `1px solid ${T.borderLight}`,
        textAlign: "left",
        fontFamily: SANS,
        fontSize: 13.5,
        color: T.textPrimary,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SelectedCard({ primary, secondary, onClear }: { primary: string; secondary: string; onClear: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        background: T.activeItemBg,
        border: `1.5px solid ${T.borderPanel}`,
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, lineHeight: 1.3 }}>{primary}</div>
        {secondary && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4, lineHeight: 1.5 }}>{secondary}</div>}
      </div>
      <button
        onClick={onClear}
        aria-label="Eliminar selección"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 3,
          color: T.textMuted,
          display: "flex",
          flexShrink: 0,
          marginLeft: 10,
          borderRadius: 4,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.textPrimary; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.textMuted; }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function PillToggle<V extends string>({
  options,
  value,
  onChange,
  size = "normal",
}: {
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
  size?: "normal" | "small";
}) {
  const padding = size === "small" ? "7px 18px" : "8px 22px";
  return (
    <div style={{ display: "inline-flex", border: `1.5px solid ${T.borderLight}`, borderRadius: 8, overflow: "hidden", background: T.bgLight }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding,
              border: "none",
              cursor: "pointer",
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 600,
              background: active ? T.accent : "transparent",
              color: active ? "#fff" : T.textSecondary,
              transition: "all .15s",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Textarea({
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
        padding: "11px 14px",
        border: `1.5px solid ${focused ? T.accent : T.borderLight}`,
        borderRadius: 8,
        fontFamily: SANS,
        fontSize: 13.5,
        color: T.textPrimary,
        background: T.bgWhite,
        outline: "none",
        resize: "vertical",
        lineHeight: 1.65,
        boxSizing: "border-box",
        transition: "border-color .15s, box-shadow .15s",
        boxShadow: focused ? "0 0 0 3px rgba(26,111,212,0.09)" : "none",
      }}
    />
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      style={{
        marginBottom: 24,
        background: T.errorBg,
        border: `1px solid ${T.errorBorder}`,
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontFamily: SANS,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M8 5v4M8 11v.5" stroke={T.errorIcon} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="8" r="6.5" stroke={T.errorIcon} strokeWidth="1.4" />
      </svg>
      <p style={{ fontSize: 13, color: T.errorText, flex: 1, margin: 0, lineHeight: 1.5 }}>{message}</p>
      <button
        onClick={onClose}
        aria-label="Cerrar"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: T.errorText, display: "flex" }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke={T.errorText} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — FallbackSelect genérico (no existe en el export de Figma,
// rediseñado siguiendo el mismo lenguaje visual)
// TODO: reemplazar por autocomplete cuando los endpoints estén disponibles
// ════════════════════════════════════════════════════════════════
function FallbackSelect({ entityName }: { entityName: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: T.bgLight,
        border: `1.5px solid ${T.borderLight}`,
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="7.5" cy="7.5" r="6.5" stroke={T.textMuted} strokeWidth="1.4" />
        <path d="M7.5 6.5v3M7.5 5v.5" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, margin: 0, fontFamily: SANS, lineHeight: 1.5 }}>
          Buscador de {entityName} no disponible
        </p>
        <p style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 0", fontFamily: SANS, lineHeight: 1.5 }}>
          El servicio de búsqueda no está disponible en este momento. Reintentá en unos minutos.
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — PastSlotError — estado full-screen (nuevo estilo, Playfair Display)
// ════════════════════════════════════════════════════════════════
function PastSlotError({ onAction }: { onAction: () => void }) {
  return (
    <div
      style={{
        background: T.bg,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SANS,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400, padding: "0 32px" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: T.errorBg,
            border: `1px solid ${T.errorBorder}`,
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke={T.errorIcon} strokeWidth="1.8" />
            <path d="M12 7v5l3.5 2" stroke={T.errorIcon} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3
          style={{
            fontFamily: SERIF,
            fontSize: 22,
            fontWeight: 700,
            color: T.textPrimary,
            marginBottom: 10,
            letterSpacing: "-0.02em",
          }}
        >
          Este turno ya no está disponible
        </h3>
        <p style={{ fontSize: 13.5, color: T.textSecondary, lineHeight: 1.65, marginBottom: 28 }}>
          El horario seleccionado pertenece a una fecha u hora pasada. Seleccioná un turno próximo desde el calendario.
        </p>
        <button
          onClick={onAction}
          style={{
            padding: "11px 36px",
            borderRadius: 8,
            border: "none",
            background: T.accent,
            color: "#fff",
            fontFamily: SANS,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = T.accentNavy; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = T.accent; }}
        >
          Volver al calendario
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — SlotPanel — columna derecha sticky (reemplaza a StickyHeader)
// Recibe datos reales (SelectedSlotContext) y handlers reales de producción
// ════════════════════════════════════════════════════════════════
function SlotPanel({
  slot,
  isFormValid,
  submitting,
  onCancel,
  onSave,
}: {
  slot: SelectedSlotContext;
  isFormValid: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const duration = calcDurationMinutes(slot.startTime, slot.endTime);
  const saveDisabled = !isFormValid || submitting;

  return (
    <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Slot context card */}
      <div
        style={{
          background: T.bgWhite,
          border: `1px solid ${T.borderLight}`,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 2px 12px rgba(10,22,40,0.07)",
        }}
      >
        {/* Card header — dark navy */}
        <div style={{ background: T.bgDark, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(74,158,232,0.9)",
                fontFamily: SANS,
              }}
            >
              Turno seleccionado
            </span>
            <span
              style={{
                background: "rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.80)",
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 4,
                padding: "3px 9px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: SANS,
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              Presencial
            </span>
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            {slot.agendaName}
          </div>
        </div>

        {/* Slot fields */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "Fecha", value: formatSlotDate(slot.slotDate) },
            { label: "Hora", value: `${fmtTime(slot.startTime)} – ${fmtTime(slot.endTime)}` },
            { label: "Duración", value: duration > 0 ? `${duration} min` : "—" },
          ].map((f) => (
            <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: T.textMuted,
                  fontFamily: SANS,
                }}
              >
                {f.label}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, fontFamily: SANS }}>{f.value}</span>
            </div>
          ))}
        </div>

        {/* Hairline */}
        <div style={{ height: 1, background: T.borderLight, margin: "0 20px" }} />

        {/* Actions — llaman a los handlers reales de producción */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onSave}
            disabled={saveDisabled}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 8,
              border: "none",
              background: saveDisabled ? "#9BBCE8" : T.accent,
              color: "#fff",
              fontFamily: SANS,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: saveDisabled ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background .15s",
              boxShadow: saveDisabled ? "none" : "0 2px 10px rgba(26,111,212,0.30)",
            }}
            onMouseEnter={(e) => { if (!saveDisabled) (e.currentTarget as HTMLButtonElement).style.background = T.accentNavy; }}
            onMouseLeave={(e) => { if (!saveDisabled) (e.currentTarget as HTMLButtonElement).style.background = T.accent; }}
          >
            {submitting ? (<><Spinner color="#fff" />Guardando...</>) : "Guardar turno"}
          </button>
          <button
            onClick={onCancel}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: `1.5px solid ${T.borderLight}`,
              background: "transparent",
              color: T.textSecondary,
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "border-color .12s, color .12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = T.accent;
              (e.currentTarget as HTMLButtonElement).style.color = T.accent;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = T.borderLight;
              (e.currentTarget as HTMLButtonElement).style.color = T.textSecondary;
            }}
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Validation hint */}
      {!isFormValid && (
        <p style={{ fontSize: 11.5, color: T.textSubtle, fontFamily: SANS, textAlign: "center", lineHeight: 1.5, margin: 0 }}>
          Completá paciente, servicio y método de pago para guardar.
        </p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN VIEW — CrearTurnoView
// ════════════════════════════════════════════════════════════════
export function CrearTurnoView({
  onNavigate: onNavigateProp,
  userProfile,
  slotContext: propSlotContext,
  onAppointmentCreated,
}: CrearTurnoViewProps) {

  // Fallback: si no llegó prop (flujo Router), leer de localStorage
  const resolvedContext = propSlotContext ?? getSelectedSlotContext();

  // Router fallback para onNavigate (mismo patrón que OtorgarTurnoView)
  const routerNav = useRouterNavigate();
  const handleNavigate = useCallback(
    (section: string) => {
      if (onNavigateProp) { onNavigateProp(section); return; }
      const routeMap: Record<string, string> = {
        "otorgar-turno": "/dentist/dashboard/turnos/otorgar",
        "turno-detail":  "/dentist/dashboard/turnos/detalle",
        home:            "/dentist/dashboard",
      };
      const route = routeMap[section];
      if (route) routerNav(route);
    },
    [onNavigateProp, routerNav]
  );

  // Redirigir si no hay contexto (protección de ruta)
  useEffect(() => {
    if (!resolvedContext) {
      handleNavigate("otorgar-turno");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpiar localStorage al desmontar (contexto ya fue consumido)
  useEffect(() => {
    return () => {
      clearSelectedSlotContext();
    };
  }, []);

  // Si no hay contexto todavía, no renderizar nada mientras redirige
  if (!resolvedContext) return null;

  // ── Producto: pre-seleccionar desde contexto si viene con productId ──
  // (usamos un componente interno con estado para manejar esto limpiamente)
  return (
    <CrearTurnoViewInner
      resolvedContext={resolvedContext}
      onAppointmentCreated={onAppointmentCreated}
      handleNavigate={handleNavigate}
      userProfile={userProfile}
    />
  );
}

// ════════════════════════════════════════════════════════════════
// INNER COMPONENT — CrearTurnoViewInner
// Separado para poder usar hooks después de los guards
// ════════════════════════════════════════════════════════════════
function CrearTurnoViewInner({
  resolvedContext,
  onAppointmentCreated,
  handleNavigate,
  userProfile: _userProfile,
}: {
  resolvedContext: SelectedSlotContext;
  onAppointmentCreated?: (response: CreateAppointmentResponse) => void;
  handleNavigate: (section: string) => void;
  userProfile: { name: string; surname: string; clinicName: string; roles: string[] } | null;
}) {
  // ── Producto: pre-seleccionar desde contexto ──
  const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(() => {
    if (resolvedContext.productId != null && resolvedContext.productName) {
      return { id: resolvedContext.productId, name: resolvedContext.productName, category: "" };
    }
    return null;
  });

  useEffect(() => {
    if (resolvedContext?.productId != null && resolvedContext.productName) {
      setSelectedProduct({
        id: resolvedContext.productId,
        name: resolvedContext.productName,
        category: "",
      });
    }
  }, [resolvedContext?.productId, resolvedContext?.productName]);

  // ── Paciente ──
  const [patientQuery, setPatientQuery] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);

  // ── Producto ──
  const [productQuery, setProductQuery] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

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
    if (!resolvedContext) return false;
    // Segunda línea de defensa: validar que el slot no sea pasado
    if (isSlotPastDatetime(resolvedContext.slotDate, resolvedContext.startTime)) return false;
    if (resolvedContext.dentistId == null) return false;
    if (!selectedPatient) return false;
    if (!selectedProduct) return false;
    if (!paymentMethod) return false;
    if (paymentMethod === "CASH" && payNow === null) return false;
    return true;
  }, [resolvedContext, selectedPatient, selectedProduct, paymentMethod, payNow]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!isFormValid || !resolvedContext || !selectedPatient || !selectedProduct || !paymentMethod) return;

    if (resolvedContext.dentistId == null) {
      setErrorMsg("No se pudo resolver el profesional de la agenda. Intentá nuevamente.");
      return;
    }

    const body: CreateAppointmentRequest = {
      id_patient: selectedPatient.id,
      id_dentist: resolvedContext.dentistId,
      id_agenda: resolvedContext.agendaId,
      id_product: selectedProduct.id,
      date: resolvedContext.slotDate,
      start_time: resolvedContext.startTime.slice(0, 5),
      duration_minutes: calcDurationMinutes(resolvedContext.startTime, resolvedContext.endTime),
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
      handleNavigate("turno-detail");
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
    isFormValid, resolvedContext, selectedPatient, selectedProduct,
    paymentMethod, payNow, notes, patientInstructions,
    onAppointmentCreated, handleNavigate,
  ]);

  // ── Guard: slot corresponde a datetime pasado ──
  if (isSlotPastDatetime(resolvedContext.slotDate, resolvedContext.startTime)) {
    return (
      <PastSlotError
        onAction={() => {
          handleNavigate("otorgar-turno");
        }}
      />
    );
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER — layout de dos columnas (1fr / 300px), panel derecho sticky,
  // sin header sticky superior, scroll natural de la página
  // ════════════════════════════════════════════════════════════════
  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: SANS }}>
      {/* Carga defensiva de Playfair Display por si el punto de entrada no la incluye todavía */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
      />
      <style>{`
        @keyframes dentify-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input::placeholder, textarea::placeholder { color: ${T.textSubtle}; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:${T.borderLight}; border-radius:3px; }
        ::-webkit-scrollbar-track { background:transparent; }
      `}</style>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 36px 80px" }}>

        {/* ── Header de módulo (no sticky) ── */}
        <div style={{ marginBottom: 36 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: T.accentBright,
              fontFamily: SANS,
              marginBottom: 8,
            }}
          >
            Módulo Turnos
          </div>
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: 36,
              fontWeight: 700,
              color: T.textPrimary,
              margin: "0 0 8px",
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            Otorgar turno
          </h1>
          <p style={{ fontSize: 14, color: T.textSecondary, margin: 0, lineHeight: 1.5 }}>
            {resolvedContext.agendaName} · {formatSlotDate(resolvedContext.slotDate)}
          </p>
        </div>

        {/* ── Error banner ── */}
        {errorMsg && <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} />}

        {/* ── Grid de dos columnas ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

          {/* ── IZQUIERDA: secciones del formulario ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ════════════════════════════════════════════════════
                SECCIÓN: PACIENTE
            ════════════════════════════════════════════════════ */}
            <Card>
              <Label required>Paciente</Label>

              {selectedPatient ? (
                <SelectedCard
                  primary={`${selectedPatient.surname}, ${selectedPatient.name}`}
                  secondary={[
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
                    placeholder="Buscar por nombre, apellido o DNI"
                    value={patientQuery}
                    onChange={(v) => { setPatientQuery(v); setPatientDropdownOpen(true); }}
                    onFocusChange={(f) => { if (f) setPatientDropdownOpen(true); }}
                    loading={patientLoading}
                  />
                  {patientDropdownOpen && patientResults.length > 0 && (
                    <Dropdown>
                      {patientResults.map((p) => (
                        <DropItem
                          key={p.id}
                          onClick={() => { setSelectedPatient(p); setPatientQuery(""); setPatientDropdownOpen(false); }}
                        >
                          <span style={{ fontWeight: 600 }}>{p.surname}, {p.name}</span>
                          <span style={{ color: T.textMuted, marginLeft: 10, fontSize: 12 }}>DNI {p.dni}</span>
                          {p.phone && <span style={{ color: T.textSubtle, marginLeft: 10, fontSize: 12 }}>{p.phone}</span>}
                        </DropItem>
                      ))}
                    </Dropdown>
                  )}
                  {patientDropdownOpen && !patientLoading && patientResults.length === 0 && debouncedPatientQ.trim().length >= 2 && (
                    <Dropdown>
                      <div style={{ padding: "14px 14px", fontSize: 13, color: T.textMuted, fontFamily: SANS }}>
                        No se encontraron pacientes con ese nombre o DNI
                      </div>
                    </Dropdown>
                  )}
                </div>
              )}
            </Card>

            {/* ════════════════════════════════════════════════════
                SECCIÓN: PRODUCTO / SERVICIO
            ════════════════════════════════════════════════════ */}
            <Card>
              <Label required>Producto / Servicio</Label>

              {selectedProduct ? (
                <SelectedCard
                  primary={selectedProduct.name}
                  secondary={[
                    selectedProduct.category || null,
                    selectedProduct.id === resolvedContext?.productId ? "Pre-seleccionado desde la agenda" : null,
                  ].filter((v): v is string => v !== null && v !== "").join("  ·  ")}
                  onClear={() => { setSelectedProduct(null); setProductQuery(""); }}
                />
              ) : productFallback ? (
                <FallbackSelect entityName="productos" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ position: "relative" }}>
                    <SearchInput
                      placeholder="Buscar por nombre de producto o servicio"
                      value={productQuery}
                      onChange={(v) => { setProductQuery(v); setProductDropdownOpen(true); }}
                      onFocusChange={(f) => { if (f) setProductDropdownOpen(true); }}
                      loading={productLoading}
                    />
                    {productDropdownOpen && productResults.length > 0 && (
                      <Dropdown>
                        {productResults.map((p) => (
                          <DropItem
                            key={p.id}
                            onClick={() => { setSelectedProduct(p); setProductQuery(""); setProductDropdownOpen(false); }}
                          >
                            <span style={{ fontWeight: 600 }}>{p.name}</span>
                            {p.category && <span style={{ color: T.textMuted, marginLeft: 10, fontSize: 12 }}>{p.category}</span>}
                          </DropItem>
                        ))}
                      </Dropdown>
                    )}
                    {productDropdownOpen && !productLoading && productResults.length === 0 && debouncedProductQ.trim().length >= 2 && (
                      <Dropdown>
                        <div style={{ padding: "14px 14px", fontSize: 13, color: T.textMuted, fontFamily: SANS }}>
                          No se encontraron productos o servicios
                        </div>
                      </Dropdown>
                    )}
                  </div>

                  {/* Botón de pre-selección — solo si la agenda tiene producto asignado */}
                  {resolvedContext?.productId != null && resolvedContext.productName && (
                    <div>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: T.textMuted,
                          marginBottom: 8,
                          fontFamily: SANS,
                        }}
                      >
                        Sugerido por la agenda
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProduct({
                            id: resolvedContext.productId!,
                            name: resolvedContext.productName!,
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
                          border: `1.5px solid ${T.borderPanel}`,
                          borderRadius: 8,
                          background: T.activeItemBg,
                          color: T.accent,
                          fontFamily: SANS,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all .12s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = T.accent;
                          (e.currentTarget as HTMLButtonElement).style.background = "#DBEAFE";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = T.borderPanel;
                          (e.currentTarget as HTMLButtonElement).style.background = T.activeItemBg;
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <circle cx="6.5" cy="6.5" r="6" stroke={T.accent} strokeWidth="1.4" />
                          <path d="M4 6.5l1.8 1.8L9.5 5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {resolvedContext.productName}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* ════════════════════════════════════════════════════
                SECCIÓN: MÉTODO DE PAGO
            ════════════════════════════════════════════════════ */}
            <Card>
              <Label required>Método de pago</Label>

              <PillToggle
                options={[
                  { value: "CASH" as const, label: "Efectivo" },
                  { value: "MERCADO_PAGO" as const, label: "Mercado Pago" },
                ]}
                value={paymentMethod}
                onChange={(v) => setPaymentMethod(v)}
              />

              {paymentMethod === "CASH" && (
                <div style={{ marginTop: 20 }}>
                  <Label required>¿El paciente paga ahora?</Label>
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
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    background: T.bgLight,
                    border: `1px solid ${T.borderPanel}`,
                    borderRadius: 8,
                    padding: "11px 14px",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="7" cy="7" r="6" stroke={T.accentBright} strokeWidth="1.4" />
                    <path d="M7 6v4M7 4.5v.5" stroke={T.accentBright} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, margin: 0 }}>
                    Se generará un link de pago de Mercado Pago y se enviará al paciente por email.
                  </p>
                </div>
              )}
            </Card>

            {/* ════════════════════════════════════════════════════
                SECCIÓN: INSTRUCCIONES Y NOTAS
            ════════════════════════════════════════════════════ */}
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                <div>
                  <Label>Instrucciones para el paciente</Label>
                  <Textarea
                    placeholder="Se enviarán en el recordatorio"
                    value={patientInstructions}
                    onChange={setPatientInstructions}
                    rows={3}
                  />
                </div>
                <div>
                  <Label badge="Solo visible para vos">Notas internas</Label>
                  <Textarea
                    placeholder="No se enviarán al paciente"
                    value={notes}
                    onChange={setNotes}
                    rows={3}
                  />
                </div>
              </div>
            </Card>

          </div>

          {/* ── DERECHA: panel sticky con contexto del turno + acciones reales ── */}
          <SlotPanel
            slot={resolvedContext}
            isFormValid={isFormValid}
            submitting={submitting}
            onCancel={() => handleNavigate("otorgar-turno")}
            onSave={handleSubmit}
          />

        </div>
      </div>
    </div>
  );
}