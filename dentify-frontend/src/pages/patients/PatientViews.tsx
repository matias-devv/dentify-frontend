// ════════════════════════════════════════════════════════════════════════════
// PatientViews.tsx — Vista "Pacientes" — Dentify Dashboard
// Consume POST /api/patients/find-all/by-clinic
// TypeScript estricto · cero any · sin librerías nuevas
// ════════════════════════════════════════════════════════════════════════════
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS — idénticos al resto del dashboard Dentify
// ════════════════════════════════════════════════════════════════
const C = {
  navy:           "#0F2244",
  navyMid:        "#1A2B4A",
  electric:       "#2563EB",
  bg:             "#F4F5F7",
  cardBg:         "#FFFFFF",
  border:         "#E4E6EC",
  textPrimary:    "#111827",
  textSecondary:  "#6B7280",
  textMuted:      "#9CA3AF",
  activeItemBg:   "#EFF6FF",
  errorBg:        "#FEF2F2",
  errorBorder:    "#FECACA",
  errorText:      "#991B1B",
  errorIcon:      "#EF4444",
  successBg:      "#F0FDF4",
  successBorder:  "#BBF7D0",
  successText:    "#166534",
} as const;

const FONT_SANS  = "'DM Sans', sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

// ════════════════════════════════════════════════════════════════
// TIPOS — PatientResponse (espejo del record Java del backend)
// ════════════════════════════════════════════════════════════════
type CoverageType =
  | "SELF_PAY"
  | "HEALTH_INSURANCE"
  | "PREPAID_INSURANCE"
  | "OTHER";

interface PatientResponse {
  id:            number;
  name:          string;
  surname:       string;
  dni:           string;
  phoneNumber:   string | null;
  dateOfBirth:   string | null;   // "YYYY-MM-DD" (LocalDate serializado por Jackson)
  coverageType:  CoverageType | null;
  insurance:     string | null;
}

// ════════════════════════════════════════════════════════════════
// TIPOS — Props del componente
// ════════════════════════════════════════════════════════════════
interface UserProfileShape {
  name:       string;
  surname:    string;
  clinicName: string;
  roles:      string[];
}

export interface PacientesListViewProps {
  userProfile: UserProfileShape | null;
  onNavigate?: (section: string, params?: Record<string, unknown>) => void;
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

/** Mapea CoverageType a español. */
const mapCoverageType = (ct: CoverageType | string | null | undefined): string => {
  switch (ct) {
    case "SELF_PAY":          return "Particular";
    case "HEALTH_INSURANCE":  return "Obra social";
    case "PREPAID_INSURANCE": return "Prepaga";
    case "OTHER":             return "Otra cobertura";
    default:                  return "Sin cobertura";
  }
};

/** Mapea CoverageType a un color de badge. */
const coverageBadgeStyle = (ct: CoverageType | string | null | undefined): React.CSSProperties => {
  switch (ct) {
    case "HEALTH_INSURANCE":
      return { background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" };
    case "PREPAID_INSURANCE":
      return { background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" };
    case "SELF_PAY":
      return { background: "#F9FAFB", color: "#374151", border: "1px solid #E5E7EB" };
    default:
      return { background: "#FFF7ED", color: "#92400E", border: "1px solid #FDE68A" };
  }
};

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

/** Normaliza texto para búsqueda: sin tildes, minúsculas. */
const normalize = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Iniciales de nombre + apellido para el avatar del usuario logueado. */
const getInitials = (name: string, surname: string): string =>
  ((name[0] ?? "") + (surname[0] ?? "")).toUpperCase();

// ════════════════════════════════════════════════════════════════
// HOOK — useDebounce
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
// HOOK — useFetchPatients
// ════════════════════════════════════════════════════════════════
interface UseFetchPatientsState {
  patients: PatientResponse[];
  loading:  boolean;
  error:    string | null;
  refetch:  () => void;
}

function useFetchPatients(): UseFetchPatientsState {
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [tick,     setTick]     = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .post<PatientResponse[]>("/api/patients/find-all/by-clinic")
      .then((res) => {
        if (cancelled) return;
        setPatients(res.data ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { name?: string; code?: string; response?: { data?: { message?: string } } };
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED" || e?.name === "AbortError") return;
        const msg =
          e?.response?.data?.message ??
          "No se pudo cargar la lista de pacientes. Verificá tu conexión e intentá nuevamente.";
        setError(String(msg));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  return { patients, loading, error, refetch };
}

// ════════════════════════════════════════════════════════════════
// MINI-COMPONENTS
// ════════════════════════════════════════════════════════════════

/**
 * PageHeader — eyebrow + título editorial (Playfair Display) + subtítulo
 * con el conteo real de pacientes, y a la derecha el bloque de usuario
 * (nombre/apellido + clínica + avatar de iniciales) cuando userProfile
 * está disponible.
 */
function PageHeader({
  totalCount,
  userProfile,
}: {
  totalCount:  number;
  userProfile: UserProfileShape | null;
}) {
  const initials = userProfile
    ? getInitials(userProfile.name, userProfile.surname)
    : "";

  return (
    <div
      style={{
        padding: "36px 36px 0",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      {/* Izquierda: eyebrow + título + subtítulo */}
      <div>
        <div
          style={{
            fontFamily:    FONT_SANS,
            fontSize:      10,
            fontWeight:    700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color:         C.electric,
            marginBottom:  6,
          }}
        >
          Módulo Pacientes
        </div>
        <h1
          style={{
            fontFamily:    FONT_SERIF,
            fontSize:      34,
            fontWeight:    700,
            color:         C.textPrimary,
            margin:        0,
            lineHeight:    1.1,
            letterSpacing: "-0.01em",
          }}
        >
          Pacientes
        </h1>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize:   13,
            color:      C.textSecondary,
            marginTop:  7,
          }}
        >
          {totalCount} {totalCount === 1 ? "paciente registrado" : "pacientes registrados"}
          {userProfile?.clinicName ? ` · ${userProfile.clinicName}` : ""}
        </div>
      </div>

      {/* Derecha: bloque de usuario — solo si hay datos disponibles */}
      {userProfile && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, paddingTop: 4 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
              {userProfile.name} {userProfile.surname}
            </div>
            {userProfile.clinicName && (
              <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: C.textSecondary }}>
                {userProfile.clinicName}
              </div>
            )}
          </div>
          <div
            style={{
              width:  36,
              height: 36,
              borderRadius: "50%",
              background:   C.electric,
              color:        "#fff",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              fontFamily:   FONT_SANS,
              fontSize:     13,
              fontWeight:   700,
              flexShrink:   0,
            }}
          >
            {initials}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Toolbar — fila con el botón "Nuevo paciente" y el buscador,
 * separada del header como en el mockup.
 */
function Toolbar({
  searchQuery,
  onSearchChange,
  onNewPatient,
}: {
  searchQuery:    string;
  onSearchChange: (v: string) => void;
  onNewPatient?:  () => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      style={{
        padding: "24px 36px 0",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {onNewPatient && <NewPatientButton onClick={onNewPatient} />}

      <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 420 }}>
        <div
          style={{
            position:  "absolute",
            left:      13,
            top:       "50%",
            transform: "translateY(-50%)",
            color:     focused ? C.electric : C.textMuted,
            display:   "flex",
            pointerEvents: "none",
            transition: "color 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5l3 3" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre, apellido o DNI…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width:        "100%",
            padding:      "10px 36px 10px 38px",
            border:       `1.5px solid ${focused ? C.electric : C.border}`,
            borderRadius: 8,
            fontFamily:   FONT_SANS,
            fontSize:     13,
            color:        C.textPrimary,
            background:   C.cardBg,
            outline:      "none",
            boxSizing:    "border-box",
            transition:   "border-color 0.15s, box-shadow 0.15s",
            boxShadow:    focused ? "0 0 0 3px rgba(37,99,235,0.10)" : "none",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            aria-label="Limpiar búsqueda"
            style={{
              position:  "absolute",
              right:     10,
              top:       "50%",
              transform: "translateY(-50%)",
              background: "none",
              border:    "none",
              cursor:    "pointer",
              color:     C.textMuted,
              display:   "flex",
              padding:   2,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function NewPatientButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          7,
        padding:      "10px 22px",
        borderRadius: 7,
        border:       "none",
        background:   hovered ? C.navy : C.navyMid,
        color:        "#fff",
        fontFamily:   FONT_SANS,
        fontSize:     13,
        fontWeight:   600,
        cursor:       "pointer",
        transition:   "background 0.15s",
        flexShrink:   0,
        whiteSpace:   "nowrap",
        boxShadow:    "0 1px 3px rgba(15,34,68,0.18)",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M7 2v10M2 7h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      Nuevo paciente
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "0 36px" }}>
      <style>{`
        @keyframes dentify-shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          style={{
            height:       64,
            borderRadius: 8,
            marginBottom: 6,
            background:   "linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)",
            backgroundSize: "400px 100%",
            animation:    "dentify-shimmer 1.2s infinite linear",
            opacity:      1 - i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        padding:    "72px 0",
        textAlign:  "center",
        fontFamily: FONT_SANS,
      }}
    >
      <div
        style={{
          width:         48,
          height:        48,
          borderRadius:  "50%",
          background:    C.errorBg,
          border:        `1px solid ${C.errorBorder}`,
          margin:        "0 auto 18px",
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 7v6M11 15v.5" stroke={C.errorIcon} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="11" cy="11" r="9" stroke={C.errorIcon} strokeWidth="1.5" />
        </svg>
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
        No se pudo cargar la lista
      </p>
      <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 24, maxWidth: 340, margin: "0 auto 24px" }}>
        {message}
      </p>
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
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div
      style={{
        padding:    "72px 0",
        textAlign:  "center",
        fontFamily: FONT_SANS,
      }}
    >
      <div
        style={{
          width:         44,
          height:        44,
          borderRadius:  "50%",
          background:    C.cardBg,
          border:        `1px solid ${C.border}`,
          margin:        "0 auto 16px",
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-4 0-6 2-6 3v1h12v-1c0-1-2-3-6-3z" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
        {filtered ? "Sin resultados" : "No hay pacientes registrados"}
      </p>
      <p style={{ fontSize: 13, color: C.textMuted }}>
        {filtered
          ? "Probá con otro nombre, apellido o DNI"
          : "Los pacientes registrados en la clínica aparecerán aquí"}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — PatientRow (fila de la tabla)
// ════════════════════════════════════════════════════════════════
function PatientRow({
  patient,
  onClick,
}: {
  patient: PatientResponse;
  onClick: (p: PatientResponse) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const fullName = `${patient.surname}, ${patient.name}`;
  const age      = calcAge(patient.dateOfBirth);
  const coverage = mapCoverageType(patient.coverageType);
  const badgeSt  = coverageBadgeStyle(patient.coverageType);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(patient)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(patient); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        "grid",
        gridTemplateColumns: "2fr 1.2fr 1fr 1.3fr 1fr 1fr 40px",
        alignItems:     "center",
        gap:            16,
        padding:        "15px 24px",
        background:     hovered ? "#F7F8FA" : C.cardBg,
        borderBottom:   `1px solid ${C.border}`,
        cursor:         "pointer",
        transition:     "background 0.12s",
        outline:        "none",
        userSelect:     "none",
      }}
    >
      {/* Nombre completo + email/insurance */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily:   FONT_SANS,
            fontSize:     14,
            fontWeight:   600,
            color:        hovered ? C.electric : C.textPrimary,
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            transition:   "color 0.12s",
          }}
        >
          {fullName}
        </div>
        {patient.insurance && (
          <div
            style={{
              fontFamily:   FONT_SANS,
              fontSize:     12,
              color:        C.textMuted,
              marginTop:    2,
              whiteSpace:   "nowrap",
              overflow:     "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {patient.insurance}
          </div>
        )}
      </div>

      {/* DNI */}
      <Cell mono>{patient.dni}</Cell>

      {/* Teléfono */}
      <Cell>{patient.phoneNumber ?? "—"}</Cell>

      {/* Fecha de nac. + edad */}
      <div>
        <Cell>{formatDate(patient.dateOfBirth)}</Cell>
        {age && (
          <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: C.textMuted, marginTop: 1 }}>
            {age}
          </div>
        )}
      </div>

      {/* Cobertura — badge tipo pill */}
      <div>
        <span
          style={{
            ...badgeSt,
            fontFamily:    FONT_SANS,
            fontSize:      11,
            fontWeight:    600,
            borderRadius:  20,
            padding:       "3px 10px",
            letterSpacing: "0.01em",
            whiteSpace:    "nowrap",
          }}
        >
          {coverage}
        </span>
      </div>

      {/* Seguro / obra social */}
      <Cell truncate>{patient.insurance ?? "—"}</Cell>

      {/* Chevron */}
      <div
        style={{
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          color:           hovered ? C.electric : C.textMuted,
          transition:      "color 0.12s",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 3l4 4-4 4" />
        </svg>
      </div>
    </div>
  );
}

function Cell({
  children,
  mono,
  truncate,
}: {
  children: React.ReactNode;
  mono?:    boolean;
  truncate?: boolean;
}) {
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

// ════════════════════════════════════════════════════════════════
// COMPONENT — TableHeader
// ════════════════════════════════════════════════════════════════
function TableHeader() {
  const cols = [
    "Paciente",
    "DNI",
    "Teléfono",
    "Fecha de nac.",
    "Cobertura",
    "Seguro / O.S.",
    "",
  ];
  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: "2fr 1.2fr 1fr 1.3fr 1fr 1fr 40px",
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

// ════════════════════════════════════════════════════════════════
// MAIN VIEW — PacientesListView
// ════════════════════════════════════════════════════════════════
export function PacientesListView({
  userProfile,
  onNavigate: _onNavigate,
}: PacientesListViewProps) {

  const navigate = useNavigate();

  // ── Fetch ──
  const { patients, loading, error, refetch } = useFetchPatients();

  // ── Search ──
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQ = useDebounce(searchQuery, 250);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    if (!debouncedQ.trim()) return patients;
    const q = normalize(debouncedQ.trim());
    return patients.filter((p) =>
      normalize(`${p.name} ${p.surname} ${p.dni}`).includes(q)
    );
  }, [patients, debouncedQ]);

  // ── Handle row click ──
  const handlePatientClick = useCallback(
  (patient: PatientResponse) => {
    navigate(`/dentist/dashboard/pacientes/${patient.id}/historial`, {
      state: {
        // Pasamos lo mínimo que HistorialClinicoView necesita para el
        // header (nombre/edad/fecha de nacimiento), ya que el endpoint de
        // historiales no lo expone. Ver medicalHistory.types.ts →
        // PatientHeaderInfo, y el TODO en HistorialClinicoView sobre
        // reemplazar esto por un fetch a un endpoint liviano de detalle
        // de paciente si se decide la opción (b) del Requirements.md
        // sección 9.
        patient: {
          id: patient.id,
          fullName: patient.name,  
          birthDate: patient.dateOfBirth ?? null,
        },
      },
    });
  },
  [navigate]
);

  // ── Handle nuevo paciente (placeholder — puede conectarse a un modal o ruta) ──
  const handleNewPatient = useCallback(() => {
    navigate("/dentist/dashboard/pacientes/nuevo");
  }, [navigate]);

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes dentify-spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes dentify-shimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
      `}</style>

      {/* ── Header editorial + bloque de usuario ── */}
      <PageHeader
        totalCount={loading ? 0 : filtered.length}
        userProfile={userProfile}
      />

      {/* ── Toolbar: botón "Nuevo paciente" + búsqueda ── */}
      <Toolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewPatient={handleNewPatient}
      />

      {/* ── Body scrolleable ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* ── Estado de carga ── */}
        {loading && (
          <div style={{ paddingTop: 24 }}>
            <LoadingSkeleton />
          </div>
        )}

        {/* ── Estado de error ── */}
        {!loading && error && (
          <div style={{ padding: "0 36px", paddingTop: 24 }}>
            <ErrorState message={error} onRetry={refetch} />
          </div>
        )}

        {/* ── Lista vacía (sin pacientes en la clínica) ── */}
        {!loading && !error && patients.length === 0 && (
          <EmptyState filtered={false} />
        )}

        {/* ── Sin resultados de búsqueda ── */}
        {!loading && !error && patients.length > 0 && filtered.length === 0 && (
          <EmptyState filtered />
        )}

        {/* ── Tabla de pacientes ── */}
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
            {filtered.map((p) => (
              <PatientRow key={p.id} patient={p} onClick={handlePatientClick} />
            ))}
          </div>
        )}

        {/* ── Footer informativo cuando hay resultados filtrados ── */}
        {!loading && !error && debouncedQ.trim() && filtered.length > 0 && (
          <div
            style={{
              padding:    "0 36px 24px",
              fontFamily: FONT_SANS,
              fontSize:   12,
              color:      C.textMuted,
              textAlign:  "right",
            }}
          >
            Mostrando {filtered.length} de {patients.length} pacientes
          </div>
        )}
      </div>
    </div>
  );
}