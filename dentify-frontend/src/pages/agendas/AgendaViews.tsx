import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS (tomados del diseño de Figma)
// ════════════════════════════════════════════════════════════════
const C = {
  navy:          "#0F2244",
  navyMid:       "#1A2B4A",
  electric:      "#2563EB",
  bg:            "#F4F5F7",
  cardBg:        "#FFFFFF",
  border:        "#E4E6EC",
  textPrimary:   "#111827",
  textSecondary: "#6B7280",
  textMuted:     "#9CA3AF",
  green:         "#10B981",
  red:           "#EF4444",
};
const FONT_SANS  = "'DM Sans', sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

// ════════════════════════════════════════════════════════════════
// TYPES (sin cambios respecto al código real)
// ════════════════════════════════════════════════════════════════
interface UserProfile {
  id?: number;
  name: string;
  surname: string;
  clinicName: string;
  clinicId?: number;
  roles: string[];
}

interface ScheduleSummary {
  startTime: string;
  endTime:   string;
  days:      string[];
}

interface AgendaListItem {
  id:              number;
  agendaName:      string;
  dentistFullName: string;
  active:          boolean;
  startDate:       string;
  finalDate:       string;
  durationMinutes: number;
  productName:     string | null;
}

type DayOfWeek =
  | "MONDAY" | "TUESDAY" | "WEDNESDAY"
  | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

interface ScheduleBlock {
  startTime: string;
  endTime:   string;
  days:      DayOfWeek[];
}

interface CreateAgendaRequest {
  agendaName:        string;
  startDate:         string;
  finalDate:         string;
  duration_minutes:  number;
  active:            boolean;
  idDentist:         number | null;
  idProduct:         number | null;
  schedules:         ScheduleBlock[];
}

interface DentistOption { id: number; name: string; surname: string; }
interface ProductOption  { id: number; nameProduct: string; }

interface AgendaListViewProps {
  onNavigate?:  (id: string) => void;
  userProfile?: UserProfile | null;
}

interface AgendaCreateViewProps {
  onNavigate?:  (id: string) => void;
  userProfile?: {
    id?: number;
    name: string;
    surname: string;
    clinicName: string;
    clinicId?: number;
    roles: string[];
  } | null;
}

// ════════════════════════════════════════════════════════════════
// BACKEND ERROR CODES
// ════════════════════════════════════════════════════════════════
const BACKEND_ERRORS: Record<string, string> = {
  INVALID_AGENDA_NAME:     "El nombre no cumple los requisitos",
  INVALID_AGENDA_DATE:     "Las fechas no son válidas",
  INVALID_AGENDA_DURATION: "La duración está fuera del rango permitido",
  SCHEDULE_OVERLAP:        "Hay solapamiento entre dos bloques horarios",
  DENTIST_NOT_FOUND:       "El profesional seleccionado no existe",
  PRODUCT_NOT_FOUND:       "El servicio seleccionado no existe",
  MISSING_PARAMETER:       "Falta un parámetro requerido",
  DENTIST_ID_MISMATCH:     "No podés asignar la agenda a otro profesional",
  ROLE_NOT_ALLOWED:        "No tenés permisos para realizar esta acción",
  INVALID_SCHEDULE:        "Hay un error en los bloques horarios",
};

// ════════════════════════════════════════════════════════════════
// DAY CONFIG
// ════════════════════════════════════════════════════════════════
const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "MONDAY",    label: "L" },
  { key: "TUESDAY",   label: "M" },
  { key: "WEDNESDAY", label: "X" },
  { key: "THURSDAY",  label: "J" },
  { key: "FRIDAY",    label: "V" },
  { key: "SATURDAY",  label: "S" },
  { key: "SUNDAY",    label: "D" },
];

const DURATIONS = [15, 30, 60];

// ════════════════════════════════════════════════════════════════
// MICRO HELPERS
// ════════════════════════════════════════════════════════════════
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatDateShort(iso: string): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("es-AR", {
    day:   "2-digit",
    month: "2-digit",
    year:  "2-digit",
  });
}

function getInitials(name?: string, surname?: string): string {
  const n = (name?.trim()?.[0] ?? "").toUpperCase();
  const s = (surname?.trim()?.[0] ?? "").toUpperCase();
  return `${n}${s}` || "—";
}

// ════════════════════════════════════════════════════════════════
// SHARED ATOMS
// ════════════════════════════════════════════════════════════════
function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label style={{
      display: "block",
      fontFamily: FONT_SANS,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: C.textMuted,
      marginBottom: 6,
    }}>
      {text}{required && <span style={{ color: C.electric, marginLeft: 2 }}>*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{
      fontFamily: FONT_SANS,
      fontSize: 11,
      color: "#DC2626",
      marginTop: 4,
    }}>
      {msg}
    </p>
  );
}

function InputBase(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const { error, style, ...rest } = props;
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...rest}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); rest.onBlur?.(e); }}
      style={{
        width: "100%",
        padding: "10px 14px",
        border: `1.5px solid ${error ? "#FCA5A5" : focused ? C.electric : C.border}`,
        borderRadius: 8,
        fontFamily: FONT_SANS,
        fontSize: 13,
        color: C.textPrimary,
        background: "#FFFFFF",
        outline: "none",
        transition: "border-color 0.15s",
        boxSizing: "border-box",
        ...style,
      }}
    />
  );
}

// Tarjeta de sección estilo Figma: eyebrow "PASO N" + título serif
function SectionCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.cardBg,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "28px 32px",
      marginBottom: 24,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: FONT_SANS,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.electric,
          marginBottom: 4,
        }}>
          {eyebrow}
        </div>
        <h3 style={{
          fontFamily: FONT_SERIF,
          fontSize: 18,
          fontWeight: 600,
          color: C.textPrimary,
          margin: 0,
        }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// Icon atoms
const IcPencil = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"/>
  </svg>
);
const IcTrash = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 4.5h11M6 4.5V3h4v1.5M5.5 4.5l.5 8h4l.5-8"/>
  </svg>
);
const IcSearch = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6.5" cy="6.5" r="4"/>
    <path d="M11 11l3 3"/>
  </svg>
);
const IcPlus = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M7 2v10M2 7h10"/>
  </svg>
);
const IcAlert = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2L1.5 14h13L8 2z"/>
    <path d="M8 7v3M8 12v.5"/>
  </svg>
);
const IcSpinner = () => (
  <span style={{
    display: "inline-block",
    width: 11, height: 11,
    border: "2px solid rgba(255,255,255,0.35)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "agendaSpin 0.65s linear infinite",
    flexShrink: 0,
  }} />
);

// ════════════════════════════════════════════════════════════════
// PAGE HEADER (Figma) — eyebrow + título serif + subtítulo
// ════════════════════════════════════════════════════════════════
function PageHeader({
  eyebrow, title, subtitle,
}: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div>
      <div style={{
        fontFamily: FONT_SANS,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: C.electric,
        marginBottom: 6,
      }}>
        {eyebrow}
      </div>
      <h1 style={{
        fontFamily: FONT_SERIF,
        fontSize: 34,
        fontWeight: 700,
        color: C.textPrimary,
        margin: 0,
        lineHeight: 1.1,
        letterSpacing: "-0.01em",
      }}>
        {title}
      </h1>
      {subtitle && (
        <div style={{
          fontFamily: FONT_SANS,
          fontSize: 13,
          color: C.textSecondary,
          marginTop: 6,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// USER INFO BLOCK — reemplaza al Topbar; se reubica junto al PageHeader
// ════════════════════════════════════════════════════════════════
function UserInfoBlock({ userProfile }: { userProfile?: UserProfile | null }) {
  const fullName = userProfile
    ? `${userProfile.name} ${userProfile.surname}`.trim()
    : "";
  const clinicName = userProfile?.clinicName ?? "";
  const initials = getInitials(userProfile?.name, userProfile?.surname);

  if (!userProfile) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
          {fullName}
        </div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: C.textSecondary }}>
          {clinicName}
        </div>
      </div>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: C.electric, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700,
        flexShrink: 0,
      }}>
        {initials}
      </div>
    </div>
  );
}

// Fila superior compartida: PageHeader a la izquierda, info de usuario a la derecha
function ViewHeaderRow({
  eyebrow, title, subtitle, userProfile,
}: { eyebrow: string; title: string; subtitle?: string; userProfile?: UserProfile | null }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 24,
      marginBottom: 32,
    }}>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <UserInfoBlock userProfile={userProfile} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// EMPTY STATE
// ════════════════════════════════════════════════════════════════
function AgendaEmptyState({ text }: { text: string }) {
  return (
    <div style={{
      padding: "48px 24px",
      textAlign: "center",
      color: C.textMuted,
      fontFamily: FONT_SANS,
      fontSize: 13,
    }}>
      <div style={{
        width: 36, height: 36,
        borderRadius: "50%",
        background: "#F4F5F7",
        margin: "0 auto 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 5v4M8 11v.5" stroke={C.textMuted} strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </div>
      {text}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// GRID — 7 columnas. Se agrega paddingLeft extra en "Nombre" para
// separarla visualmente de "Estado" sin tocar el resto de columnas.
// ════════════════════════════════════════════════════════════════
const GRID_COLS = "40px 1fr 160px 120px 240px 210px 80px";
const NAME_COL_EXTRA_GAP = 16; // px de aire extra entre "Estado" y "Nombre"

// ════════════════════════════════════════════════════════════════
// STATUS BADGE — sin punto de color, solo texto sobre pill
// ════════════════════════════════════════════════════════════════
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      fontFamily: FONT_SANS,
      fontSize: 11,
      fontWeight: 600,
      color: active ? "#059669" : "#DC2626",
      background: active ? "#ECFDF5" : "#FEF2F2",
      padding: "2px 10px",
      borderRadius: 20,
      whiteSpace: "nowrap",
    }}>
      {active ? "Activa" : "Inactiva"}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// SKELETON ROWS — actualizado para 7 columnas
// ════════════════════════════════════════════════════════════════
function SkeletonRows() {
  const pulse: React.CSSProperties = { borderRadius: 6, background: "#F3F4F6" };
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          display: "grid",
          gridTemplateColumns: GRID_COLS,
          columnGap: 20,
          alignItems: "center",
          padding: "13px 20px",
          borderBottom: `1px solid ${C.border}`,
        }}>
          {/* Estado */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: 34, height: 16, borderRadius: 20, ...pulse }} />
          </div>
          {/* Nombre */}
          <div style={{ paddingLeft: NAME_COL_EXTRA_GAP, width: [160, 200, 140][i], height: 12, ...pulse }} />
          {/* Profesional */}
          <div style={{ width: 120, height: 12, ...pulse }} />
          {/* Duración */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: 48, height: 12, ...pulse }} />
          </div>
          {/* Producto */}
          <div style={{ width: 100, height: 12, ...pulse }} />
          {/* Vigencia */}
          <div style={{ width: 140, height: 12, ...pulse }} />
          {/* Acciones */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, ...pulse }} />
            <div style={{ width: 18, height: 18, borderRadius: 4, ...pulse }} />
          </div>
        </div>
      ))}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// STATUS FILTER PILLS
// ════════════════════════════════════════════════════════════════
type FilterStatus = "all" | "active" | "inactive";

function FilterPills({ value, onChange }: {
  value: FilterStatus;
  onChange: (v: FilterStatus) => void;
}) {
  const options: { key: FilterStatus; label: string }[] = [
    { key: "all",      label: "Todas"    },
    { key: "active",   label: "Activas"  },
    { key: "inactive", label: "Inactivas"},
  ];
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: "7px 14px",
              borderRadius: 7,
              border: `1.5px solid ${active ? C.navyMid : C.border}`,
              background: active ? C.navyMid : "#FFFFFF",
              color: active ? "#FFFFFF" : C.textSecondary,
              fontFamily: FONT_SANS,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.12s",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AGENDA ROW — 7 columnas, StatusBadge sin dot
// ════════════════════════════════════════════════════════════════
interface AgendaRowProps {
  item:     AgendaListItem;
  onDelete: (id: number) => void;
}

function AgendaRow({ item, onDelete }: AgendaRowProps) {
  const [hover,          setHover]          = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [deleteError,    setDeleteError]    = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/api/agendas/${item.id}`);
      onDelete(item.id);
    } catch {
      setDeleteError("Error al eliminar. Intentá nuevamente.");
      setDeleting(false);
    }
  };

  const vigencia = `${formatDateShort(item.startDate)} – ${formatDateShort(item.finalDate)}`;

  return (
    <>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "grid",
          gridTemplateColumns: GRID_COLS,
          columnGap: 20,
          alignItems: "center",
          padding: "13px 20px",
          background: hover ? "#FAFBFC" : "transparent",
          transition: "background 0.12s",
          minHeight: 48,
          cursor: "default",
          position: "relative",
        }}
      >
        {/* ── Col 1: Estado (badge sin dot) ── */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <StatusBadge active={item.active} />
        </div>

        {/* ── Col 2: Nombre de la agenda (con aire extra respecto a Estado) ── */}
        <span style={{
          paddingLeft: NAME_COL_EXTRA_GAP,
          fontFamily: FONT_SANS,
          fontSize: 13,
          fontWeight: 600,
          color: C.textPrimary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {item.agendaName}
        </span>

        {/* ── Col 3: Profesional ── */}
        <span style={{
          fontFamily: FONT_SANS,
          fontSize: 12,
          fontWeight: 400,
          color: C.textSecondary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {item.dentistFullName}
        </span>

        {/* ── Col 4: Duración ── */}
        <span style={{
          fontFamily: FONT_SANS,
          fontSize: 12,
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
          color: C.textSecondary,
          whiteSpace: "nowrap",
        }}>
          {item.durationMinutes} min
        </span>

        {/* ── Col 5: Producto ── */}
        <span style={{
          fontFamily: FONT_SANS,
          fontSize: 12,
          fontWeight: 400,
          color: item.productName ? C.textSecondary : C.textMuted,
          fontStyle: item.productName ? "normal" : "italic",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {item.productName ?? "—"}
        </span>

        {/* ── Col 6: Vigencia ── */}
        <span style={{
          fontFamily: FONT_SANS,
          fontSize: 12,
          fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
          color: C.textSecondary,
          whiteSpace: "nowrap",
        }}>
          {vigencia}
        </span>

        {/* ── Col 7: Acciones ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}>
          <button
            aria-label="Editar agenda"
            title="Editar (próximamente)"
            onClick={() => {/* próximamente */}}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.textMuted,
              display: "flex",
              alignItems: "center",
              padding: 4,
              borderRadius: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.electric)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
          >
            <IcPencil />
          </button>

          <button
            aria-label="Eliminar agenda"
            onClick={() => { setConfirmVisible((v) => !v); setDeleteError(null); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.textMuted,
              display: "flex",
              alignItems: "center",
              padding: 4,
              borderRadius: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
          >
            <IcTrash />
          </button>
        </div>
      </div>

      {confirmVisible && (
        <div style={{
          margin: "0 20px 12px",
          padding: "12px 16px",
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#991B1B", display: "flex" }}><IcAlert /></span>
            <span style={{
              fontFamily: FONT_SANS,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#991B1B",
            }}>
              {deleteError ?? "¿Eliminar esta agenda?"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => { setConfirmVisible(false); setDeleteError(null); }}
              disabled={deleting}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: `1px solid #FECACA`,
                background: "#FFFFFF",
                color: "#991B1B",
                fontFamily: FONT_SANS,
                fontSize: 12,
                fontWeight: 600,
                cursor: deleting ? "default" : "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleting}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: deleting ? "#FCA5A5" : "#DC2626",
                color: "#FFFFFF",
                fontFamily: FONT_SANS,
                fontSize: 12,
                fontWeight: 600,
                cursor: deleting ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {deleting ? <><IcSpinner /> Eliminando...</> : "Eliminar"}
            </button>
          </div>
        </div>
      )}

      <div style={{ height: 1, background: "#F3F4F6" }} />
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// AGENDA LIST VIEW
// ════════════════════════════════════════════════════════════════
export function AgendaListView({ onNavigate, userProfile }: AgendaListViewProps) {
  const [agendas,      setAgendas]      = useState<AgendaListItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const navigate = useNavigate();
  const handleNavigate = useCallback((section: string) => {
    if (onNavigate) { onNavigate(section); return; }
    const routeMap: Record<string, string> = {
      "agendas-list":   "/dentist/dashboard/agendas",
      "agendas-create": "/dentist/dashboard/agendas/nueva",
      home:             "/dentist/dashboard",
    };
    const route = routeMap[section];
    if (route) navigate(route);
  }, [onNavigate, navigate]);

  const isSecretary = userProfile?.roles?.includes("SECRETARY") ?? false;
  const endpoint = isSecretary
    ? "/api/agendas/find/by-clinic"
    : "/api/agendas/find/by-dentist";

  const fetchAgendas = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiClient.get(endpoint);
      const raw: any[] = Array.isArray(res.data) ? res.data : [];

      const mapped: AgendaListItem[] = raw.map((item) => ({
        id:              item.id_agenda,
        agendaName:      item.agenda_name,
        dentistFullName: item.dentist_full_name ?? "",
        active:          item.active,
        startDate:       item.start_date,
        finalDate:       item.final_date,
        durationMinutes: item.duration ?? 0,
        productName:     item.product_name ?? null,
      }));

      setAgendas(mapped);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { fetchAgendas(); }, [fetchAgendas]);

  const handleDelete = (id: number) => {
    setAgendas((prev) => prev.filter((a) => a.id !== id));
  };

  const filtered = agendas.filter((a) => {
    const matchesSearch =
      searchQuery.length < 3 ||
      a.agendaName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active"   &&  a.active) ||
      (filterStatus === "inactive" && !a.active);
    return matchesSearch && matchesStatus;
  });

  const colHeaderStyle: React.CSSProperties = {
    fontFamily: FONT_SANS,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: C.textMuted,
  };

  return (
    <>
      <style>{`@keyframes agendaSpin { to { transform: rotate(360deg); } }`}</style>

      {/* ── HEADER: PageHeader + info de usuario (reemplaza Topbar/breadcrumb) ── */}
      <ViewHeaderRow
        eyebrow="MÓDULO AGENDAS"
        title="Mis agendas"
        subtitle={`${agendas.length} agenda${agendas.length === 1 ? "" : "s"} registrada${agendas.length === 1 ? "" : "s"}${userProfile?.clinicName ? ` · ${userProfile.clinicName}` : ""}`}
        userProfile={userProfile}
      />

      {/* ── TOOLBAR ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 24,
        flexWrap: "wrap",
      }}>
        <button
          onClick={() => handleNavigate("agendas-create")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "14px 28px",
            borderRadius: 7,
            border: "none",
            background: C.navyMid,
            color: "#FFFFFF",
            fontFamily: FONT_SANS,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            boxShadow: "0 1px 3px rgba(15,34,68,0.2)",
          }}
        >
          <IcPlus /> Agenda
        </button>

        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <span style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: C.textMuted,
            display: "flex",
            pointerEvents: "none",
          }}>
            <IcSearch />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar agenda (ingrese al menos 3 caracteres)"
            style={{
              width: "100%",
              padding: "10px 14px 10px 36px",
              border: `1.5px solid ${C.border}`,
              borderRadius: 8,
              fontFamily: FONT_SANS,
              fontSize: 13,
              color: C.textPrimary,
              background: "#FFFFFF",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e)  => (e.currentTarget.style.borderColor = C.electric)}
            onBlur={(e)   => (e.currentTarget.style.borderColor = C.border)}
          />
        </div>

        <FilterPills value={filterStatus} onChange={setFilterStatus} />
      </div>

      {/* ── CARD CONTENEDOR ── */}
      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: GRID_COLS,
          columnGap: 20,
          alignItems: "center",
          padding: "10px 20px",
          background: "#FAFBFC",
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={colHeaderStyle}>St.</span>
          </div>
          <span style={{ ...colHeaderStyle, paddingLeft: NAME_COL_EXTRA_GAP }}>Nombre</span>
          <span style={colHeaderStyle}>Profesional</span>
          <span style={colHeaderStyle}>Duración</span>
          <span style={colHeaderStyle}>Producto</span>
          <span style={colHeaderStyle}>Vigencia</span>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={colHeaderStyle}>Acc.</span>
          </div>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <div style={{
            padding: "32px 24px",
            textAlign: "center",
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.textSecondary,
          }}>
            Error al cargar las agendas.{" "}
            <button
              onClick={fetchAgendas}
              style={{
                background: "none",
                border: "none",
                color: C.electric,
                fontFamily: FONT_SANS,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Intentá nuevamente.
            </button>
          </div>
        ) : agendas.length === 0 ? (
          <AgendaEmptyState text="No hay agendas registradas aún" />
        ) : filtered.length === 0 ? (
          <AgendaEmptyState text="No se encontraron agendas con ese criterio" />
        ) : (
          filtered.map((a) => (
            <AgendaRow key={a.id} item={a} onDelete={handleDelete} />
          ))
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{
            padding: "10px 20px",
            borderTop: `1px solid ${C.border}`,
            fontFamily: FONT_SANS,
            fontSize: 11.5,
            color: C.textMuted,
          }}>
            Mostrando {filtered.length} de {agendas.length} agendas
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// SCHEDULE BLOCK
// ════════════════════════════════════════════════════════════════
interface ScheduleBlockErrors {
  days?:      string;
  startTime?: string;
  endTime?:   string;
}

interface ScheduleBlockEditorProps {
  index:        number;
  block:        ScheduleBlock;
  canDelete:    boolean;
  errors:       ScheduleBlockErrors;
  durationMin:  number;
  onChange:     (index: number, block: ScheduleBlock) => void;
  onDelete:     (index: number) => void;
}

function ScheduleBlockEditor({
  index, block, canDelete, errors, durationMin, onChange, onDelete,
}: ScheduleBlockEditorProps) {

  const toggleDay = (day: DayOfWeek) => {
    const has = block.days.includes(day);
    const next = has ? block.days.filter((d) => d !== day) : [...block.days, day];
    onChange(index, { ...block, days: next });
  };

  return (
    <div style={{
      background: "#FAFBFC",
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "20px 24px",
      marginBottom: 16,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
      }}>
        <span style={{
          fontFamily: FONT_SANS,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: C.textMuted,
        }}>
          Bloque {index + 1}
        </span>
        {canDelete && (
          <button
            aria-label={`Eliminar bloque ${index + 1}`}
            onClick={() => onDelete(index)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "none",
              border: "none",
              color: C.textMuted,
              fontFamily: FONT_SANS,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 4,
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
          >
            <IcTrash /> Eliminar bloque
          </button>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.8fr) 1fr 1fr auto",
        gap: 20,
        alignItems: "flex-end",
      }}>
        <div style={{ minWidth: 0 }}>
          <FieldLabel text="Días de atención" required />
          <div style={{
            display: "flex",
            gap: 6,
            flexWrap: "nowrap",
          }}>
            {DAYS.map(({ key, label }) => {
              const active = block.days.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleDay(key)}
                  aria-label={key}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    border: `1.5px solid ${active ? C.navyMid : C.border}`,
                    background: active ? C.navyMid : "#FFFFFF",
                    color: active ? "#FFFFFF" : C.textSecondary,
                    fontFamily: FONT_SANS,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.12s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxSizing: "border-box",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <FieldError msg={errors.days} />
        </div>

        <div style={{ minWidth: 0 }}>
          <FieldLabel text="Hora inicio" required />
          <InputBase
            type="time"
            value={block.startTime}
            error={!!errors.startTime}
            onChange={(e) => onChange(index, { ...block, startTime: e.target.value })}
            style={{ fontSize: 14 }}
          />
          <FieldError msg={errors.startTime} />
        </div>

        <div style={{ minWidth: 0 }}>
          <FieldLabel text="Hora fin" required />
          <InputBase
            type="time"
            value={block.endTime}
            error={!!errors.endTime}
            onChange={(e) => onChange(index, { ...block, endTime: e.target.value })}
            style={{ fontSize: 14 }}
          />
          <FieldError msg={errors.endTime} />
        </div>

        <div />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AGENDA CREATE VIEW
// ════════════════════════════════════════════════════════════════
export function AgendaCreateView({ onNavigate, userProfile }: AgendaCreateViewProps) {
  const [dentists, setDentists] = useState<DentistOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [agendaName,       setAgendaName]       = useState("");
  const [startDate,        setStartDate]         = useState("");
  const [finalDate,        setFinalDate]         = useState("");
  const [durationMinutes,  setDurationMinutes]   = useState(30);
  const [idDentist,        setIdDentist]         = useState<number | null>(null);
  const [idProduct,        setIdProduct]         = useState<number | null>(null);
  const [schedules,        setSchedules]         = useState<ScheduleBlock[]>([
    { startTime: "09:00", endTime: "17:00", days: [] },
  ]);

  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [blockErrors, setBlockErrors] = useState<ScheduleBlockErrors[]>([{}]);

  const [isLoading,    setIsLoading]    = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  const isDentist   = userProfile?.roles?.includes("DENTIST")   ?? false;
  const isSecretary = userProfile?.roles?.includes("SECRETARY") ?? false;
  const [active, setActive] = useState<boolean>(true);

  const navigate = useNavigate();
  const handleNavigate = useCallback((section: string) => {
    if (onNavigate) { onNavigate(section); return; }
    const routeMap: Record<string, string> = {
      "agendas-list":   "/dentist/dashboard/agendas",
      "agendas-create": "/dentist/dashboard/agendas/nueva",
      home:             "/dentist/dashboard",
    };
    const route = routeMap[section];
    if (route) navigate(route);
  }, [onNavigate, navigate]);

  useEffect(() => {
    if (isSecretary) {
      apiClient.get("/api/dentists").then((r) => setDentists(r.data)).catch(() => {});
    }
    apiClient.get("/api/products/active")
    .then((r) => {
      const mapped: ProductOption[] = (Array.isArray(r.data) ? r.data : []).map((p: any) => ({
        id:          p.id_product,
        nameProduct: p.name_product,
      }));
      setProducts(mapped);
    })
    .catch(() => {});
  }, [isSecretary]);

  const handleBlockChange = (index: number, block: ScheduleBlock) => {
    setSchedules((prev) => prev.map((b, i) => i === index ? block : b));
  };

  const handleBlockDelete = (index: number) => {
    setSchedules((prev) => prev.filter((_, i) => i !== index));
    setBlockErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddBlock = () => {
    setSchedules((prev) => [...prev, { startTime: "", endTime: "", days: [] }]);
    setBlockErrors((prev) => [...prev, {}]);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const bErrs: ScheduleBlockErrors[] = schedules.map(() => ({}));
    let valid = true;

    if (agendaName.trim().length < 3) {
      errs.agendaName = "Mínimo 3 caracteres"; valid = false;
    } else if (agendaName.trim().length > 24) {
      errs.agendaName = "Máximo 24 caracteres"; valid = false;
    }

    const today = todayISO();
    if (!startDate) {
      errs.startDate = "Campo requerido"; valid = false;
    } else if (startDate < today) {
      errs.startDate = "No puede ser anterior a hoy"; valid = false;
    }

    if (!finalDate) {
      errs.finalDate = "Campo requerido"; valid = false;
    } else if (startDate && finalDate <= startDate) {
      errs.finalDate = "Debe ser posterior a la fecha de inicio"; valid = false;
    }

    if (durationMinutes < 5 || durationMinutes > 120) {
      errs.duration = "La duración debe ser entre 5 y 120 minutos"; valid = false;
    }

    if ((isSecretary) && idDentist === null) {
      errs.idDentist = "Seleccioná un profesional"; valid = false;
    }

    if (active === undefined || active === null) {
      errs.active = "Seleccioná el estado de la agenda"; valid = false;
    }

    if (schedules.length === 0) {
      errs.schedules = "Agregá al menos un bloque horario"; valid = false;
    }

    schedules.forEach((block, i) => {
      if (block.days.length === 0) {
        bErrs[i].days = "Seleccioná al menos un día"; valid = false;
      }
      if (!block.startTime) {
        bErrs[i].startTime = "Requerido"; valid = false;
      }
      if (!block.endTime) {
        bErrs[i].endTime = "Requerido"; valid = false;
      } else if (block.startTime && block.endTime <= block.startTime) {
        bErrs[i].endTime = "Debe ser posterior a la hora de inicio"; valid = false;
      } else if (block.startTime && block.endTime) {
        const diff = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
        if (diff < durationMinutes) {
          bErrs[i].endTime = `El rango debe ser ≥ ${durationMinutes} min`; valid = false;
        }
      }
    });

    setErrors(errs);
    setBlockErrors(bErrs);
    return valid;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!validate()) return;

    setIsLoading(true);
    const payload: CreateAgendaRequest = {
      agendaName:       agendaName.trim(),
      startDate,
      finalDate,
      duration_minutes: durationMinutes,
      active:           active,
      idDentist:        isDentist ? null : idDentist,
      idProduct,
      schedules:        schedules.map((s) => ({
        startTime: s.startTime.length === 5 ? `${s.startTime}:00` : s.startTime,
        endTime:   s.endTime.length   === 5 ? `${s.endTime}:00`   : s.endTime,
        days:      s.days,
      })),
    };

    try {
      await apiClient.post("/api/agendas/save", payload);
      handleNavigate("agendas-list");
    } catch (err: any) {
      const data = err?.response?.data;
      const code = data?.code as string | undefined;

      if (code === "VALIDATION_ERROR" && Array.isArray(data?.errors)) {
        const msgs = (data.errors as string[])
          .map((e: string) => e.includes(": ") ? e.split(": ").slice(1).join(": ") : e)
          .join(" · ");
        setSubmitError(msgs);
      } else {
        setSubmitError(
          (code && BACKEND_ERRORS[code]) ??
          (data?.message as string | undefined) ??
          "Error al crear la agenda. Intentá nuevamente."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const today = todayISO();
  const minFinalDate = startDate ? addDays(startDate, 1) : today;

  return (
    <>
      <style>{`@keyframes agendaSpin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "16px 48px 80px" }}>

        {/* ── HEADER: PageHeader + info de usuario (reemplaza Topbar/breadcrumb) ── */}
        <ViewHeaderRow
          eyebrow="MÓDULO AGENDAS"
          title="Nueva agenda"
          subtitle="Completá los datos para registrar una nueva agenda de atención"
          userProfile={userProfile}
        />

        {/* ── SECCIÓN 1: DATOS GENERALES ── */}
        <SectionCard eyebrow="PASO 1" title="Datos generales">
          <div style={{ marginBottom: 24 }}>
            <FieldLabel text="Nombre de la agenda" required />
            <InputBase
              type="text"
              value={agendaName}
              onChange={(e) => setAgendaName(e.target.value)}
              placeholder="Ej: Agenda Mañana"
              maxLength={30}
              error={!!errors.agendaName}
              aria-required="true"
              style={{ fontSize: 14 }}
            />
            <FieldError msg={errors.agendaName} />
          </div>

          {!isDentist && (
            <div style={{ marginBottom: 24 }}>
              <FieldLabel text="Profesional asignado" required />
              <select
                value={idDentist ?? ""}
                onChange={(e) => setIdDentist(e.target.value ? Number(e.target.value) : null)}
                aria-required="true"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  border: `1.5px solid ${errors.idDentist ? "#FCA5A5" : C.border}`,
                  borderRadius: 8,
                  fontFamily: FONT_SANS,
                  fontSize: 14,
                  color: idDentist ? C.textPrimary : C.textMuted,
                  background: "#FFFFFF",
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                }}
              >
                <option value="">Seleccionar profesional</option>
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.surname}
                  </option>
                ))}
              </select>
              <FieldError msg={errors.idDentist} />
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <FieldLabel text="Duración de turnos" required />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDurationMinutes(d)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 7,
                    border: `1.5px solid ${durationMinutes === d ? C.navyMid : C.border}`,
                    background: durationMinutes === d ? C.navyMid : "#FFFFFF",
                    color: durationMinutes === d ? "#FFFFFF" : C.textSecondary,
                    fontFamily: FONT_SANS,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.12s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {d} min
                </button>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <InputBase
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  value={DURATIONS.includes(durationMinutes) ? "" : durationMinutes}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setDurationMinutes(v);
                  }}
                  placeholder="Otro"
                  style={{
                    width: 80,
                    padding: "8px 12px",
                    fontSize: 14,
                    appearance: "textfield",
                    MozAppearance: "textfield",
                    margin: 0,
                  }}
                  error={!!errors.duration}
                />
                <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textMuted, whiteSpace: "nowrap" }}>min</span>
              </div>
            </div>
            <FieldError msg={errors.duration} />
          </div>

          <div>
            <FieldLabel text="Servicio / Producto (opcional)" />
            <select
              value={idProduct ?? ""}
              onChange={(e) => setIdProduct(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: "100%",
                padding: "11px 14px",
                border: `1.5px solid ${C.border}`,
                borderRadius: 8,
                fontFamily: FONT_SANS,
                fontSize: 14,
                color: idProduct ? C.textPrimary : C.textMuted,
                background: "#FFFFFF",
                outline: "none",
                cursor: "pointer",
                appearance: "none",
              }}
            >
              <option value="">Sin servicio asociado</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.nameProduct}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 24 }}>
            <FieldLabel text="Estado de la agenda" required />
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { value: true, label: "Activa" },
                { value: false, label: "Inactiva" },
              ].map(({ value, label }) => {
                const isSelected = active === value;
                return (
                  <button
                    key={label}
                    onClick={() => setActive(value)}
                    type="button"
                    style={{
                      padding: "8px 20px",
                      borderRadius: 7,
                      border: `1.5px solid ${isSelected ? (value ? "#059669" : "#DC2626") : C.border}`,
                      background: isSelected ? (value ? "#ECFDF5" : "#FEF2F2") : "#FFFFFF",
                      color: isSelected ? (value ? "#059669" : "#DC2626") : C.textSecondary,
                      fontFamily: FONT_SANS,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.12s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <FieldError msg={errors.active} />
          </div>
        </SectionCard>

        {/* ── SECCIÓN 2: VIGENCIA ── */}
        <SectionCard eyebrow="PASO 2" title="Vigencia">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <FieldLabel text="Fecha de inicio" required />
              <InputBase
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (finalDate && finalDate <= e.target.value) setFinalDate("");
                }}
                error={!!errors.startDate}
                aria-required="true"
                style={{ fontSize: 14 }}
              />
              <FieldError msg={errors.startDate} />
            </div>
            <div>
              <FieldLabel text="Fecha de fin" required />
              <InputBase
                type="date"
                value={finalDate}
                min={minFinalDate}
                onChange={(e) => setFinalDate(e.target.value)}
                error={!!errors.finalDate}
                aria-required="true"
                disabled={!startDate}
                style={{ fontSize: 14 }}
              />
              <FieldError msg={errors.finalDate} />
            </div>
          </div>
        </SectionCard>

        {/* ── SECCIÓN 3: HORARIOS ── */}
        <SectionCard eyebrow="PASO 3" title="Bloques horarios">
          <p style={{
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.textSecondary,
            marginTop: -8,
            marginBottom: 20,
            lineHeight: 1.5,
          }}>
            Definí uno o más bloques de atención con sus días y horarios.
          </p>

          {errors.schedules && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#FEF2F2", border: "1px solid #FECACA",
              borderRadius: 7, padding: "10px 14px", marginBottom: 18,
              color: "#991B1B", fontFamily: FONT_SANS, fontSize: 13,
            }}>
              <IcAlert /> {errors.schedules}
            </div>
          )}

          {schedules.map((block, i) => (
            <ScheduleBlockEditor
              key={i}
              index={i}
              block={block}
              canDelete={schedules.length > 1}
              errors={blockErrors[i] ?? {}}
              durationMin={durationMinutes}
              onChange={handleBlockChange}
              onDelete={handleBlockDelete}
            />
          ))}

          <button
            onClick={handleAddBlock}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 20px",
              borderRadius: 7,
              border: `1.5px solid ${C.border}`,
              background: "#FFFFFF",
              color: C.electric,
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#EFF6FF")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            <IcPlus /> Agregar bloque horario
          </button>
        </SectionCard>

        {/* ── SUBMIT ERROR BANNER ── */}
        {submitError && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: "13px 16px",
              marginBottom: 24,
              marginTop: 24,
              color: "#991B1B",
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <span style={{ flexShrink: 0, display: "flex" }}><IcAlert /></span>
            {submitError}
          </div>
        )}

        {/* ── ACCIONES BOTTOM ── */}
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          paddingTop: 16,
        }}>
          <button
            onClick={() => handleNavigate("agendas-list")}
            disabled={isLoading}
            style={{
              padding: "11px 24px",
              borderRadius: 7,
              border: `1.5px solid ${C.border}`,
              background: "#FFFFFF",
              color: C.textSecondary,
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoading ? "default" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            style={{
              padding: "11px 28px",
              borderRadius: 7,
              border: "none",
              background: isLoading ? "#93C5FD" : C.navyMid,
              color: "#FFFFFF",
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoading ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: isLoading ? 0.75 : 1,
              transition: "opacity 0.15s",
              boxShadow: "0 1px 3px rgba(15,34,68,0.25)",
            }}
          >
            {isLoading ? <><IcSpinner /> Creando...</> : <>Crear agenda →</>}
          </button>
        </div>
      </div>
    </>
  );
}