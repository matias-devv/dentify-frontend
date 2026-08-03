// ════════════════════════════════════════════════════════════════════════════
// HistorialClinicoView.tsx — Vista "Historial Clínico" (listado) — Dentify
// Consume GET /api/medical-histories/find-all/{patientId}
// Punto de entrada al módulo de Medical History, anidado en Pacientes.
// Implementa Requirements.md — Vista "Historial Clínico" (listado) anidada en
// Pacientes: RN-1..RN-5, validaciones §3, catálogo de errores §7,
// criterios de aceptación §8.
// TypeScript estricto · cero any · consistente con PatientViews.tsx
// ════════════════════════════════════════════════════════════════════════════
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import apiClient from "../../api/apiClient";
import type {
  MedicalHistorySummaryResponse,
  PatientHeaderInfo,
  OdontogramType,
} from "./medicalHistory.types";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS — idénticos al objeto `C` de PatientViews.tsx.
// Fuente de verdad: Requirements.md §9 ("cualquier discrepancia menor
// se resuelve a favor de PatientViews.tsx, por ser el componente con el
// que esta vista comparte layout padre directo").
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
  successBg:     "#F0FDF4",
  successBorder: "#BBF7D0",
  successText:   "#166534",
  warnBg:        "#FFFBEB",
  warnBorder:    "#FDE68A",
  warnText:      "#92400E",
  warnIcon:      "#D97706",
  infoBg:        "#F9FAFB",
  infoBorder:    "#E5E7EB",
  infoText:      "#374151",
} as const;

const FONT_SANS = "'DM Sans', sans-serif";

// ════════════════════════════════════════════════════════════════
// PROPS
// ════════════════════════════════════════════════════════════════
interface UserProfileShape {
  name:       string;
  surname:    string;
  clinicName: string;
  roles:      string[];
}

export interface HistorialClinicoViewProps {
  userProfile:    UserProfileShape | null;
  patientId:      number;
  /**
   * Header del paciente (nombre/edad/fecha de nac.), resuelto en el wrapper
   * de routing vía location.state (opción (a) de Requirements.md §9).
   * null cuando el usuario llega por deep-link sin ese state.
   */
  patientHeader?: PatientHeaderInfo | null;
  onNavigate:     (section: string, params?: Record<string, unknown>) => void;
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

/** Normaliza texto para búsqueda: sin tildes, minúsculas (idéntico a PatientViews.tsx). */
const normalize = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** "YYYY-MM-DD" → "DD/MM/YYYY". */
const formatDate = (d: string | null | undefined): string => {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/** Calcula la edad a partir de "YYYY-MM-DD". */
const calcAge = (dob: string | null | undefined): string => {
  if (!dob) return "";
  const birth = new Date(dob + "T00:00:00");
  if (isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} años`;
};

const initialsOf = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const mapOdontogramType = (t: OdontogramType | string): string => {
  switch (t) {
    case "ADULT": return "Adulto";
    case "CHILD": return "Niño";
    default:      return t;
  }
};

/**
 * Trunca `observations` según RN-5 (máx. 120 caracteres, una sola línea con
 * ellipsis) y aplica el fallback de la tabla de validaciones §3 para
 * null/"" ("Sin observaciones registradas").
 */
const formatObservations = (obs: string | null): { text: string; isEmpty: boolean } => {
  if (!obs || obs.trim() === "") {
    return { text: "Sin observaciones registradas", isEmpty: true };
  }
  const trimmed = obs.trim();
  return {
    text: trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed,
    isEmpty: false,
  };
};

// ════════════════════════════════════════════════════════════════
// HOOK — useDebounce (idéntico al patrón de PatientViews.tsx)
// ════════════════════════════════════════════════════════════════
function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState<T>(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

// ════════════════════════════════════════════════════════════════
// HOOK — useFetchMedicalHistories
// Análogo a useFetchPatients, con catálogo de errores diferenciado por
// status (Requirements.md §4 y §7).
// ════════════════════════════════════════════════════════════════
type MedicalHistoryErrorType = "403" | "404" | "5xx" | "network";

interface MedicalHistoryError {
  type:    MedicalHistoryErrorType;
  message: string;
}

interface UseFetchMedicalHistoriesState {
  histories: MedicalHistorySummaryResponse[];
  loading:   boolean;
  error:     MedicalHistoryError | null;
  refetch:   () => void;
}

function useFetchMedicalHistories(patientId: number): UseFetchMedicalHistoriesState {
  const [histories, setHistories] = useState<MedicalHistorySummaryResponse[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<MedicalHistoryError | null>(null);
  const [tick,      setTick]      = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .get<MedicalHistorySummaryResponse[]>(`/api/medical-histories/find-all/${patientId}`)
      .then((res) => {
        if (cancelled) return;
        setHistories(res.data ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as {
          name?: string;
          code?: string;
          response?: { status?: number; data?: { message?: string } };
        };

        // Errores de cancelación se ignoran silenciosamente (mismo patrón que useFetchPatients).
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED" || e?.name === "AbortError") return;

        const status = e?.response?.status;

        // 401 ya es manejado transparentemente por el interceptor de apiClient
        // (refresh + retry / redirect a /login) — no requiere manejo adicional acá.
        if (status === 403) {
          setError({ type: "403", message: "No tenés acceso a los historiales de este paciente." });
        } else if (status === 404) {
          setError({ type: "404", message: "No se encontró el paciente solicitado." });
        } else if (typeof status === "number" && status >= 500) {
          setError({ type: "5xx", message: "Ocurrió un error inesperado. Intentá nuevamente en unos minutos." });
        } else {
          setError({
            type: "network",
            message:
              e?.response?.data?.message ??
              "No se pudo cargar el historial clínico. Verificá tu conexión e intentá nuevamente.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [patientId, tick]);

  return { histories, loading, error, refetch };
}

// ════════════════════════════════════════════════════════════════
// MINI-COMPONENTS — estados de carga / error / vacío
// ════════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div style={{ padding: "0 36px" }}>
      <style>{`
        @keyframes dentify-shimmer-hc {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            height:         64,
            borderRadius:   8,
            marginBottom:   6,
            background:     "linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)",
            backgroundSize: "400px 100%",
            animation:      "dentify-shimmer-hc 1.2s infinite linear",
            opacity:        1 - i * 0.12,
          }}
        />
      ))}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  secondaryAction,
}: {
  message: string;
  onRetry?: () => void;
  secondaryAction?: { label: string; onClick: () => void };
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ padding: "72px 0", textAlign: "center", fontFamily: FONT_SANS }}>
      <div
        style={{
          width:          48,
          height:         48,
          borderRadius:   "50%",
          background:     C.errorBg,
          border:         `1px solid ${C.errorBorder}`,
          margin:         "0 auto 18px",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 7v6M11 15v.5" stroke={C.errorIcon} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="11" cy="11" r="9" stroke={C.errorIcon} strokeWidth="1.5" />
        </svg>
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
        No se pudo cargar el historial clínico
      </p>
      <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
        {message}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {onRetry && (
          <button
            onClick={onRetry}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              padding:      "10px 28px",
              borderRadius: 7,
              border:       `1.5px solid ${hovered ? C.electric : C.border}`,
              background:   hovered ? C.activeItemBg : C.cardBg,
              color:        hovered ? C.electric : C.textSecondary,
              fontFamily:   FONT_SANS,
              fontSize:     13,
              fontWeight:   600,
              cursor:       "pointer",
              transition:   "all 0.15s",
            }}
          >
            Reintentar
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            style={{
              padding:      "10px 28px",
              borderRadius: 7,
              border:       "none",
              background:   C.navy,
              color:        "#fff",
              fontFamily:   FONT_SANS,
              fontSize:     13,
              fontWeight:   600,
              cursor:       "pointer",
            }}
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div style={{ padding: "72px 0", textAlign: "center", fontFamily: FONT_SANS }}>
      <div
        style={{
          width:          44,
          height:         44,
          borderRadius:   "50%",
          background:     C.cardBg,
          border:         `1px solid ${C.border}`,
          margin:         "0 auto 16px",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M4 4h9l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke={C.textMuted} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M7 9h6M7 12h6M7 15h3" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
        {filtered ? "Sin resultados" : "Sin historiales clínicos"}
      </p>
      <p style={{ fontSize: 13, color: C.textMuted }}>
        {filtered
          ? "No se encontraron evoluciones para tu búsqueda."
          : "Este paciente todavía no tiene historiales clínicos cargados."}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — AllergyBanner (RN-1)
// ════════════════════════════════════════════════════════════════
type AllergyBannerState = "none" | "present" | "absent";

function deriveAllergyState(histories: MedicalHistorySummaryResponse[]): AllergyBannerState {
  if (histories.length === 0) return "none";
  return histories.some((h) => h.hasAllergies) ? "present" : "absent";
}

function AllergyBanner({ state }: { state: AllergyBannerState }) {
  if (state === "none") return null;
  const isPresent = state === "present";

  return (
    <div
      role="status"
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          8,
        background:   isPresent ? C.warnBg : C.infoBg,
        border:       `1px solid ${isPresent ? C.warnBorder : C.infoBorder}`,
        borderRadius: 7,
        padding:      "8px 14px",
        fontFamily:   FONT_SANS,
        fontSize:     12.5,
        fontWeight:   600,
        color:        isPresent ? C.warnText : C.infoText,
        flexShrink:   0,
      }}
    >
      {isPresent ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M7 1.5l6 11H1l6-11z" stroke={C.warnIcon} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M7 5.5v3M7 10.5v.01" stroke={C.warnIcon} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="6" stroke={C.textMuted} strokeWidth="1.4" />
          <path d="M7 6.3v4M7 4v.01" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
      {isPresent ? "Paciente con alergias registradas" : "Paciente sin alergias registradas"}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — PatientHeaderBar
// ════════════════════════════════════════════════════════════════
function PatientHeaderBar({
  patientHeader,
  patientId,
  allergyState,
}: {
  patientHeader: PatientHeaderInfo | null;
  patientId:     number;
  allergyState:  AllergyBannerState;
}) {
  const fullName = patientHeader?.fullName ?? `Paciente #${patientId}`;
  const age      = calcAge(patientHeader?.birthDate ?? null);
  const dob      = formatDate(patientHeader?.birthDate ?? null);

  return (
    <div
      style={{
        background:   C.cardBg,
        borderBottom: `1px solid ${C.border}`,
        padding:      "18px 36px",
        display:      "flex",
        alignItems:   "center",
        gap:          16,
        flexWrap:     "wrap",
      }}
    >
      <div
        style={{
          width:          40,
          height:         40,
          borderRadius:   "50%",
          background:     C.navy,
          color:          "#fff",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontFamily:     FONT_SANS,
          fontSize:       13,
          fontWeight:     700,
          flexShrink:     0,
        }}
      >
        {initialsOf(fullName)}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 15, fontWeight: 700, color: C.textPrimary }}>
          {fullName}
        </div>
        {patientHeader?.birthDate && (
          <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted, marginTop: 1 }}>
            {age} · {dob}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <AllergyBanner state={allergyState} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — EvolucionMenu (botón "+ EVOLUCIÓN" y su dropdown, RN-2)
// ════════════════════════════════════════════════════════════════
interface EvolucionOption {
  key:     string;
  label:   string;
  enabled: boolean;
}

// Único comportamiento definido en RN-2: "Historia Clínica General" habilitada,
// las 3 restantes deshabilitadas visualmente, sin lógica ni navegación.
const EVOLUCION_OPTIONS: EvolucionOption[] = [
  { key: "historia-clinica-general", label: "Historia Clínica General", enabled: true },
  { key: "historia-clinica-previa",  label: "Historia Clínica Previa",  enabled: false },
  { key: "registro-imagenes",        label: "Registro de imágenes",     enabled: false },
  { key: "reporte-alergias",         label: "Reporte de alergias",      enabled: false },
];

function EvolucionMenuItem({ option, onSelect }: { option: EvolucionOption; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);

  if (!option.enabled) {
    // Deshabilitada: grisada, cursor not-allowed, sin acción, tooltip nativo "Próximamente".
    return (
      <div
        role="menuitem"
        aria-disabled="true"
        tabIndex={-1}
        title="Próximamente"
        style={{
          padding:      "9px 12px",
          borderRadius: 6,
          fontFamily:   FONT_SANS,
          fontSize:     13,
          fontWeight:   500,
          color:        C.textMuted,
          opacity:      0.55,
          cursor:       "not-allowed",
          userSelect:   "none",
        }}
      >
        {option.label}
      </div>
    );
  }

  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding:      "9px 12px",
        borderRadius: 6,
        fontFamily:   FONT_SANS,
        fontSize:     13,
        fontWeight:   500,
        color:        hovered ? C.electric : C.textPrimary,
        background:   hovered ? C.activeItemBg : "transparent",
        cursor:       "pointer",
        outline:      "none",
        transition:   "all 0.12s",
      }}
    >
      {option.label}
    </div>
  );
}

function EvolucionMenu({ onSelect }: { onSelect: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHoveredBtn(true)}
        onMouseLeave={() => setHoveredBtn(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          6,
          padding:      "9px 16px",
          borderRadius: 7,
          border:       "none",
          background:   hoveredBtn ? "#1d4ed8" : C.electric,
          color:        "#fff",
          fontFamily:   FONT_SANS,
          fontSize:     13,
          fontWeight:   600,
          cursor:       "pointer",
          transition:   "background 0.15s",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1.5v10M1.5 6.5h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        EVOLUCIÓN
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position:     "absolute",
            top:          "calc(100% + 6px)",
            left:         0,
            zIndex:       20,
            minWidth:     240,
            background:   C.cardBg,
            border:       `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow:    "0 6px 24px rgba(15,34,68,0.12)",
            padding:      6,
            display:      "flex",
            flexDirection: "column",
            gap:          2,
          }}
        >
          {EVOLUCION_OPTIONS.map((opt) => (
            <EvolucionMenuItem
              key={opt.key}
              option={opt}
              onSelect={() => {
                if (!opt.enabled) return;
                setOpen(false);
                onSelect(opt.key);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — ActionsBar (búsqueda RN-3 + Imprimir/Filtros RN-4)
// ════════════════════════════════════════════════════════════════
function ActionsBar({
  onEvolucionSelect,
  searchQuery,
  onSearchChange,
}: {
  onEvolucionSelect: (key: string) => void;
  searchQuery:       string;
  onSearchChange:    (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const tooShort = searchQuery.trim().length > 0 && searchQuery.trim().length < 3;

  return (
    <div
      style={{
        background:   C.cardBg,
        borderBottom: `1px solid ${C.border}`,
        padding:      "14px 36px",
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        flexWrap:     "wrap",
      }}
    >
      <EvolucionMenu onSelect={onEvolucionSelect} />

      <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220, maxWidth: 420 }}>
        <div
          style={{
            position:  "absolute",
            left:      12,
            top:       "50%",
            transform: "translateY(-50%)",
            color:     focused ? C.electric : C.textMuted,
            display:   "flex",
            pointerEvents: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5l3 3" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Busca una evolución (ingrese al menos 3 caracteres)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width:        "100%",
            padding:      "9px 12px 9px 36px",
            border:       `1.5px solid ${focused ? C.electric : C.border}`,
            borderRadius: 8,
            fontFamily:   FONT_SANS,
            fontSize:     13,
            color:        C.textPrimary,
            background:   C.cardBg,
            outline:      "none",
            boxSizing:    "border-box",
            transition:   "border-color 0.15s",
            boxShadow:    focused ? "0 0 0 3px rgba(37,99,235,0.10)" : "none",
          }}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Imprimir — presente visualmente, sin funcionalidad (RN-4) */}
      <button
        disabled
        title="Sin funcionalidad en este MVP"
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          width:          36,
          height:         36,
          borderRadius:   7,
          border:         `1.5px solid ${C.border}`,
          background:     C.cardBg,
          color:          C.textMuted,
          cursor:         "not-allowed",
          opacity:        0.6,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5V2h7v3M4 11h7v3H4v-3zM2.5 5h10a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H11V9H4v2H2.5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
        </svg>
      </button>

      {/* Filtros — presente visualmente, sin funcionalidad (RN-4) */}
      <button
        disabled
        title="Sin funcionalidad en este MVP"
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          6,
          padding:      "9px 14px",
          borderRadius: 7,
          border:       `1.5px solid ${C.border}`,
          background:   C.cardBg,
          color:        C.textMuted,
          fontFamily:   FONT_SANS,
          fontSize:     13,
          fontWeight:   600,
          cursor:       "not-allowed",
          opacity:      0.6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h10M4 7h6M6 11h2" />
        </svg>
        Filtros
      </button>

      {tooShort && (
        <div style={{ width: "100%", fontFamily: FONT_SANS, fontSize: 11.5, color: C.textMuted, marginTop: -2 }}>
          Ingresá al menos 3 caracteres para filtrar
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — Tabla de evoluciones
// ════════════════════════════════════════════════════════════════
const GRID_TEMPLATE = "0.85fr 0.85fr 1.15fr 1.15fr 0.6fr 0.6fr 0.6fr 2fr";

function TableHeader() {
  const cols = ["Fecha", "Odontograma", "Odontólogo", "Editado por", "Alergias", "Piezas", "Exámenes", "Observaciones"];
  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: GRID_TEMPLATE,
        gap:                 16,
        padding:             "10px 24px",
        background:          "#F9FAFB",
        borderBottom:        `1px solid ${C.border}`,
        borderTop:           `1px solid ${C.border}`,
      }}
    >
      {cols.map((c, i) => (
        <div
          key={i}
          style={{
            fontFamily:    FONT_SANS,
            fontSize:      10,
            fontWeight:    700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color:         C.textMuted,
          }}
        >
          {c}
        </div>
      ))}
    </div>
  );
}

function Cell({ children, mono, truncate }: { children: React.ReactNode; mono?: boolean; truncate?: boolean }) {
  return (
    <div
      style={{
        fontFamily:   mono ? "'DM Mono', 'Fira Code', monospace" : FONT_SANS,
        fontSize:     13,
        color:        C.textSecondary,
        whiteSpace:   truncate ? "nowrap" : undefined,
        overflow:     truncate ? "hidden" : undefined,
        textOverflow: truncate ? "ellipsis" : undefined,
      }}
    >
      {children}
    </div>
  );
}

function HistoryRow({ history }: { history: MedicalHistorySummaryResponse }) {
  const [hovered, setHovered] = useState(false);
  const obs = formatObservations(history.observations);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:             "grid",
        gridTemplateColumns: GRID_TEMPLATE,
        alignItems:          "center",
        gap:                 16,
        padding:             "14px 24px",
        background:          hovered ? C.activeItemBg : C.cardBg,
        borderBottom:        `1px solid ${C.border}`,
        transition:          "background 0.12s",
      }}
    >
      <Cell>{formatDate(history.startDate)}</Cell>
      <Cell>{mapOdontogramType(history.odontogramType)}</Cell>
      <Cell truncate>{history.dentist.fullName}</Cell>
      {/* editedBy === null → se omite, no se muestra "—" (validaciones §3) */}
      <Cell truncate>{history.editedBy ? history.editedBy.fullName : ""}</Cell>
      <Cell mono>{history.allergyCount}</Cell>
      <Cell mono>{history.toothRecordCount}</Cell>
      <Cell mono>{history.examCount}</Cell>
      <div
        style={{
          fontFamily:   FONT_SANS,
          fontSize:     13,
          color:        obs.isEmpty ? C.textMuted : C.textSecondary,
          fontStyle:    obs.isEmpty ? "italic" : "normal",
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {obs.text}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN VIEW — HistorialClinicoView
// ════════════════════════════════════════════════════════════════
export function HistorialClinicoView({
  userProfile: _userProfile,
  patientId,
  patientHeader = null,
  onNavigate,
}: HistorialClinicoViewProps) {

  // ── Fetch ──
  const { histories, loading, error, refetch } = useFetchMedicalHistories(patientId);

  // ── Search (RN-3: client-side, sin nueva request) ──
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQ  = useDebounce(searchQuery, 250);
  const activeQuery = debouncedQ.trim();
  // Validaciones §3: la búsqueda solo se activa a partir de 3 caracteres.
  const searchActive = activeQuery.length >= 3;

  // ── Banner de alergias (RN-1) ──
  const allergyState = useMemo(() => deriveAllergyState(histories), [histories]);

  // ── Filtrado en memoria ──
  const filtered = useMemo(() => {
    if (!searchActive) return histories;
    const q = normalize(activeQuery);
    return histories.filter((h) => {
      const haystack = normalize(
        [
          formatDate(h.startDate),
          h.dentist.fullName,
          h.editedBy?.fullName ?? "",
          h.observations ?? "",
        ].join(" ")
      );
      return haystack.includes(q);
    });
  }, [histories, activeQuery, searchActive]);

  // ── Navegación desde el menú "+ EVOLUCIÓN" ──
  const handleEvolucionSelect = useCallback(
    (key: string) => {
      onNavigate(key, { patientId });
    },
    [onNavigate, patientId]
  );

  // ── Acción alternativa del ErrorState 404 ──
  const handleVolverAPacientes = useCallback(() => {
    onNavigate("pacientes-list", { patientId });
  }, [onNavigate, patientId]);

  // 403 / 404 no llevan botón "Reintentar" (catálogo de errores §7).
  const showRetry = error !== null && error.type !== "403" && error.type !== "404";

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        height:        "100%",
        overflow:      "hidden",
        background:    C.bg,
        fontFamily:    FONT_SANS,
      }}
    >
      <PatientHeaderBar
        patientHeader={patientHeader}
        patientId={patientId}
        allergyState={allergyState}
      />

      <ActionsBar
        onEvolucionSelect={handleEvolucionSelect}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* ── Estado de carga ── */}
        {loading && (
          <div style={{ paddingTop: 24 }}>
            <LoadingSkeleton />
          </div>
        )}

        {/* ── Estado de error (403 / 404 / 5xx / red) ── */}
        {!loading && error && (
          <div style={{ padding: "0 36px", paddingTop: 24 }}>
            <ErrorState
              message={error.message}
              onRetry={showRetry ? refetch : undefined}
              secondaryAction={
                error.type === "404"
                  ? { label: "Volver a pacientes", onClick: handleVolverAPacientes }
                  : undefined
              }
            />
          </div>
        )}

        {/* ── Paciente sin historiales cargados ── */}
        {!loading && !error && histories.length === 0 && (
          <EmptyState filtered={false} />
        )}

        {/* ── Búsqueda sin resultados ── */}
        {!loading && !error && histories.length > 0 && searchActive && filtered.length === 0 && (
          <EmptyState filtered />
        )}

        {/* ── Tabla de evoluciones ── */}
        {!loading && !error && filtered.length > 0 && (
          <div
            style={{
              margin:       "24px 36px",
              background:   C.cardBg,
              border:       `1px solid ${C.border}`,
              borderRadius: 10,
              overflow:     "hidden",
              boxShadow:    "0 1px 8px rgba(15,34,68,0.05)",
            }}
          >
            <TableHeader />
            {filtered.map((h) => (
              <HistoryRow key={h.id} history={h} />
            ))}
          </div>
        )}

        {/* ── Footer informativo cuando hay resultados filtrados ── */}
        {!loading && !error && searchActive && filtered.length > 0 && (
          <div
            style={{
              padding:    "0 36px 24px",
              fontFamily: FONT_SANS,
              fontSize:   12,
              color:      C.textMuted,
              textAlign:  "right",
            }}
          >
            Mostrando {filtered.length} de {histories.length} evoluciones
          </div>
        )}
      </div>
    </div>
  );
}