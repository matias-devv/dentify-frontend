// ════════════════════════════════════════════════════════════════════════════
// TurnosViews.tsx — Vista "Otorgar Turno" — Dentify Dashboard
// Semana: grilla custom (reemplaza RBC week view — elimina crash interno)
// Mes: grilla custom (reemplaza RBC month view — CustomMonthGrid)
// date-fns · TypeScript estricto · sin moment.js · sin react-big-calendar
// ════════════════════════════════════════════════════════════════════════════
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Component,
  ErrorInfo,
  ReactNode,
} from "react";
import {
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
} from "date-fns";
import apiClient from "../../api/apiClient";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ════════════════════════════════════════════════════════════════
const C = {
  navy: "#0F2244",
  navyMid: "#1A2B4A",
  electric: "#2563EB",
  bg: "#F4F5F7",
  cardBg: "#FFFFFF",
  border: "#E4E6EC",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  sidebarBg: "#FFFFFF",
  sidebarBorder: "#E4E6EC",
  activeItemBg: "#EFF6FF",
  activeText: "#2563EB",
  slotFree: "#22C55E",
  slotFreeBg: "#22C55E",
  slotOccupiedBg: "#EFF6FF",
  slotOccupiedBorder: "#2563EB",
};
const FONT_SANS = "'DM Sans', sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════
interface AgendaItem {
  id_agenda: number;
  agenda_name: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  dentist_id?: number;         // ID del dentista dueño de la agenda
  dentist_full_name?: string;  // Nombre completo del dentista
}

interface AppointmentResponse {
  id: number;
  patient_name: string;
  patient_surname: string;
  status: string;
  productName: string;
}

interface SlotResponse {
  startTime: string;
  endTime: string;
  availability: boolean;
  appointment: AppointmentResponse | null;
}

interface DayResponse {
  date: string;
  dayOfWeek: string;
  isWorkingDay: boolean;
  slots: SlotResponse[] | null;
}

interface WeekResponse {
  id_agenda: number;
  agenda_name: string;
  id_product: number | null;      // null si la agenda no tiene producto asignado
  productName: string | null;    
  startDate: string;
  endDate: string;
  days: DayResponse[];
}

interface DailySummaryResponse {
  date: string;
  number_day: number;
  dayOfWeek: string;
  freeSlots: number;
  occupiedSlots: number;
  totalSlots: number;
  state: "NO_SCHEDULE" | "FULL" | "LOW_AVAILABILITY" | "AVAILABLE";
}

interface MonthResponse {
  id_agenda: number;
  year: number;
  month_number: number;
  month_name: string;
  product_name: string;
  duration_minutes: number;
  days: DailySummaryResponse[];
}

interface SlotResource {
  availability: boolean;
  appointment: AppointmentResponse | null;
  startTime?: string;
  endTime?: string;
  dayDate?: string;
}

interface RBCEvent {
  title: string;
  start: Date;
  end: Date;
  resource: SlotResource;
  allDay?: boolean;
}

// ════════════════════════════════════════════════════════════════
// TAREA 3 — SelectedSlotContext (exportado)
// ════════════════════════════════════════════════════════════════
export interface SelectedSlotContext {
  agendaId: number;
  agendaName: string;
  slotDate: string;     // "2026-04-22"
  startTime: string;    // "11:45:00"
  endTime: string;      // "12:30:00"
  dayOfWeek: string;    // "WEDNESDAY"
  dentistId: number;    // ID del dentista dueño de la agenda
  dentistFullName: string; // Nombre completo del dentista
  productId: number | null;    // ID del producto asignado a la agenda (null si no tiene)
  productName: string | null;  // Nombre del producto asignado a la agenda (null si no tiene)

}

// ════════════════════════════════════════════════════════════════
// API PARAM BUILDERS
// ════════════════════════════════════════════════════════════════
interface WeeklyParams {
  id_agenda: number;
  startDate: string;
  endDate: string;
  id_product?: number;
}
 
interface MonthlyParams {
  id_agenda: number;
  year: number;
  month_number: number;
  id_product?: number;
}
 
const buildWeeklyParams = (
  agendaId: number,
  startDate: string,
  endDate: string,
  productId?: number | null
): WeeklyParams => {
  const p: WeeklyParams = { id_agenda: agendaId, startDate, endDate };
  if (productId != null) p.id_product = productId;
  return p;
};
 
const buildMonthlyParams = (
  agendaId: number,
  year: number,
  month_number: number,
  productId?: number | null
): MonthlyParams => {
  const p: MonthlyParams = { id_agenda: agendaId, year, month_number };
  if (productId != null) p.id_product = productId;
  return p;
};


// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

/**
 * Calcula lunes y domingo de la semana que contiene `date`.
 * Usa aritmética local (sin toISOString) para evitar desfases de timezone.
 */
const getWeekBounds = (date: Date): { startDate: string; endDate: string } => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  return { startDate: fmt(monday), endDate: fmt(sunday) };
};

const formatWeekLabel = (date: Date): string => {
  const { startDate, endDate } = getWeekBounds(date);
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  const sLabel = s
    .toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    .toUpperCase();
  const eLabel = e
    .toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
  return `${sLabel} – ${eLabel}`;
};

const formatMonthLabel = (date: Date): string =>
  date
    .toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    .toUpperCase();

const isValidDate = (d: Date): boolean =>
  d instanceof Date && !isNaN(d.getTime());

/**
 * Parsea "HH:mm:ss" de forma robusta — nunca lanza excepciones.
 */
const parseTimeComponents = (timeStr: string): [number, number] | null => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return [h, m];
};

/**
 * Construye un Date seguro a partir de "yyyy-MM-dd" sin desfase de timezone.
 */
const safeDateFromString = (dateStr: string): Date | null => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const clean = dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const d = new Date(clean + "T00:00:00");
  return isValidDate(d) ? d : null;
};

/**
 * Formatea un rango de tiempo para mostrar en el bloque del slot.
 * "11:45:00", "12:30:00" → "11:45 – 12:30"
 */
const formatTimeRange = (start: string, end: string): string => {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
};


/**
 * Verifica si la semana calculada para `date` está dentro del rango de la agenda.
 */
const isWeekInAgendaRange = (
  date: Date,
  agendaStartDate: string,
  agendaEndDate: string
): boolean => {
  const { startDate, endDate } = getWeekBounds(date);
  return !(endDate < agendaStartDate || startDate > agendaEndDate);
};


// ════════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ════════════════════════════════════════════════════════════════
interface EBState {
  hasError: boolean;
  errorMsg: string;
}
interface EBProps {
  children: ReactNode;
  onRetry?: () => void;
}

class CalendarErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false, errorMsg: "" };

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, errorMsg: error?.message ?? "Error desconocido" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CalendarErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMsg: "" });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          padding: "48px 32px",
          textAlign: "center",
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          fontFamily: FONT_SANS,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#FEF2F2",
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 6v5M10 13.5v.5"
              stroke="#EF4444"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="10" cy="10" r="8.5" stroke="#EF4444" strokeWidth="1.5" />
          </svg>
        </div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.textPrimary,
            marginBottom: 6,
          }}
        >
          Error al renderizar el calendario
        </p>
        <p
          style={{
            fontSize: 12,
            color: C.textMuted,
            marginBottom: 20,
            maxWidth: 360,
            margin: "0 auto 20px",
          }}
        >
          Ocurrió un problema inesperado al mostrar los turnos. Si el problema
          persiste, recargá la página.
        </p>
        <button
          onClick={this.handleRetry}
          style={{
            padding: "9px 24px",
            borderRadius: 7,
            cursor: "pointer",
            background: C.electric,
            color: "#fff",
            border: "none",
            fontFamily: FONT_SANS,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Reintentar
        </button>
        {process.env.NODE_ENV === "development" && (
          <details style={{ marginTop: 16, textAlign: "left" }}>
            <summary
              style={{ fontSize: 11, color: C.textMuted, cursor: "pointer" }}
            >
              Detalles del error (solo en desarrollo)
            </summary>
            <pre
              style={{
                fontSize: 10,
                color: "#EF4444",
                background: "#FEF2F2",
                padding: 8,
                borderRadius: 4,
                marginTop: 8,
                overflow: "auto",
              }}
            >
              {this.state.errorMsg}
            </pre>
          </details>
        )}
      </div>
    );
  }
}

// ════════════════════════════════════════════════════════════════
// MINI COMPONENTS
// ════════════════════════════════════════════════════════════════
function EmptyState({
  text,
  onRetry,
}: {
  text: string;
  onRetry?: () => void;
}) {
  return (
    <div
      style={{ padding: "48px 0", textAlign: "center", fontFamily: FONT_SANS }}
    >
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
          <path
            d="M8 5v4M8 11v.5"
            stroke={C.textMuted}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p
        style={{
          fontSize: 13,
          color: C.textMuted,
          marginBottom: onRetry ? 16 : 0,
        }}
      >
        {text}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 4,
            padding: "8px 20px",
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
          Reintentar
        </button>
      )}
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div style={{ padding: "20px", minHeight: 500 }}>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          style={{
            height: 40,
            borderRadius: 6,
            background: "#F0F1F5",
            marginBottom: 12,
            opacity: 1 - i * 0.1,
            animation: "dentify-pulse 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CUSTOM WEEK GRID — reemplaza react-big-calendar week view
//
// JUSTIFICACIÓN (Opción B):
// react-big-calendar en modo WEEK puede lanzar excepciones internas
// al posicionar eventos de 30 minutos cuando las fechas tienen
// desfase de timezone (ej: new Date("2026-04-22T12:00:00") en UTC-3
// produce 2026-04-22T09:00:00Z que RBC puede interpretar como el día
// anterior). La grilla custom es determinística, nunca lanza, y
// produce exactamente el layout de la Imagen 2 (tabla con eje Y de
// horarios, eje X de días, bloques LIBRE en verde y ocupados en azul).
// ════════════════════════════════════════════════════════════════
interface WeekGridProps {
  data: WeekResponse;
  onSelectEvent: (event: RBCEvent) => void;
}

const CustomWeekGrid = React.memo(function CustomWeekGrid({
  data,
  onSelectEvent,
}: WeekGridProps) {
  // ── Colectar todos los startTimes únicos de días laborables ──
  const allStartTimes = useMemo(() => {
    const set = new Set<string>();
    if (!data?.days || !Array.isArray(data.days)) return [] as string[];
    data.days.forEach((day) => {
      if (day?.isWorkingDay && Array.isArray(day.slots)) {
        day.slots.forEach((slot) => {
          if (slot?.startTime) set.add(slot.startTime);
        });
      }
    });
    return Array.from(set).sort();
  }, [data]);

  // ── Agrupar times por hora (para mostrar label solo al inicio de hora) ──
  const hourOf = (t: string): string => {
    const parts = t.split(":");
    return `${parts[0]}:00`;
  };

  // ── Convertir slot + day a RBCEvent para el callback de selección ──
  const makeEvent = useCallback(
    (slot: SlotResponse, day: DayResponse): RBCEvent | null => {
      const base = safeDateFromString(day.date);
      if (!base) return null;
      const startParts = parseTimeComponents(slot.startTime);
      const endParts = parseTimeComponents(slot.endTime);
      if (!startParts || !endParts) return null;
      const [sh, sm] = startParts;
      const [eh, em] = endParts;
      const start = new Date(base);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(base);
      end.setHours(eh, em, 0, 0);
      if (!isValidDate(start) || !isValidDate(end) || start >= end) return null;
      return {
        title: slot.availability
          ? "LIBRE"
          : `${slot.appointment?.patient_surname ?? ""}, ${
              slot.appointment?.patient_name ?? ""
            }`.trim(),
        start,
        end,
        resource: {
          availability: slot.availability ?? false,
          appointment: slot.appointment ?? null,
          startTime: slot.startTime,
          endTime: slot.endTime,
          dayDate: day.date,
        } as SlotResource,
      };
    },
    []
  );

  // ── Lookup rápido: slot por (dayDate, startTime) ──
  const slotMap = useMemo(() => {
    const map = new Map<string, SlotResponse>();
    if (!data?.days) return map;
    data.days.forEach((day) => {
      if (day?.isWorkingDay && Array.isArray(day.slots)) {
        day.slots.forEach((slot) => {
          map.set(`${day.date}::${slot.startTime}`, slot);
        });
      }
    });
    return map;
  }, [data]);

  const days = useMemo(
    () => (Array.isArray(data?.days) ? data.days : []),
    [data]
  );

  if (allStartTimes.length === 0) {
    return <EmptyState text="No hay slots disponibles en esta semana" />;
  }

  // ── Formatear cabecera de día ──
  const formatDayHeader = (day: DayResponse) => {
    const d = safeDateFromString(day.date);
    if (!d) return { weekday: day.dayOfWeek.slice(0, 3), dayNum: "—" };
    const weekday = d
      .toLocaleDateString("es-AR", { weekday: "short" })
      .toUpperCase()
      .replace(".", "");
    const dayNum = d.getDate();
    return { weekday, dayNum };
  };

  const COL_HOUR = 72;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  let prevHour = "";

  return (
    <div
      style={{
        overflowX: "auto",
        overflowY: "auto",
        maxHeight: 580,
        fontFamily: FONT_SANS,
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          tableLayout: "fixed",
          minWidth: 480,
        }}
      >
        {/* Colgroup */}
        <colgroup>
          <col style={{ width: COL_HOUR }} />
          {days.map((d) => (
            <col key={d.date} />
          ))}
        </colgroup>

        {/* Header de días */}
        <thead>
          <tr>
            <th
              style={{
                padding: "10px 0 10px 12px",
                textAlign: "left",
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: C.textMuted,
                borderBottom: `2px solid ${C.border}`,
                background: C.cardBg,
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              Horario
            </th>
            {days.map((day) => {
              const { weekday, dayNum } = formatDayHeader(day);
              const todayCol = day.date === todayStr;
              return (
                <th
                  key={day.date}
                  style={{
                    padding: "8px 6px",
                    textAlign: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: todayCol ? C.electric : C.textSecondary,
                    borderBottom: `2px solid ${
                      todayCol ? C.electric : C.border
                    }`,
                    background: todayCol ? C.activeItemBg : C.cardBg,
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    borderLeft: `1px solid ${C.border}`,
                  }}
                >
                  <div>{weekday}</div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: todayCol ? C.electric : C.textPrimary,
                      lineHeight: 1.2,
                      marginTop: 2,
                    }}
                  >
                    {dayNum}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Body: una fila por slot */}
        <tbody>
          {allStartTimes.map((startTime) => {
            const currentHour = hourOf(startTime);
            const isHourBoundary = currentHour !== prevHour;
            prevHour = currentHour;

            return (
              <tr
                key={startTime}
                style={{
                  borderTop: isHourBoundary
                    ? `1px solid ${C.border}`
                    : `1px solid #F3F4F6`,
                }}
              >
                {/* Celda de hora */}
                <td
                  style={{
                    padding: "3px 8px 3px 12px",
                    verticalAlign: "top",
                    width: COL_HOUR,
                    whiteSpace: "nowrap",
                  }}
                >
                  {isHourBoundary && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.textMuted,
                        fontFamily: FONT_SANS,
                        lineHeight: "36px",
                      }}
                    >
                      {currentHour}
                    </span>
                  )}
                </td>

                {/* Celdas de días */}
                {days.map((day) => {
                  const slot = slotMap.get(`${day.date}::${startTime}`);
                  const todayCol = day.date === todayStr;

                  return (
                    <td
                      key={day.date}
                      style={{
                        padding: "2px 4px",
                        borderLeft: `1px solid ${C.border}`,
                        background: todayCol
                          ? "rgba(37,99,235,0.025)"
                          : undefined,
                        verticalAlign: "middle",
                        // TAREA 1 — altura de celda aumentada a 38px
                        height: 38,
                      }}
                    >
                      {slot ? (
                        <button
                          onClick={() => {
                            const ev = makeEvent(slot, day);
                            if (ev) onSelectEvent(ev);
                          }}
                          title={
                            slot.availability
                              ? `Libre: ${formatTimeRange(slot.startTime, slot.endTime)}`
                              : `${slot.appointment?.patient_surname ?? ""}, ${slot.appointment?.patient_name ?? ""} — ${formatTimeRange(slot.startTime, slot.endTime)}`
                          }
                          style={{
                            width: "100%",
                            // TAREA 1 — altura de botón aumentada a 36px
                            height: 36,
                            background: slot.availability
                              ? C.slotFreeBg
                              : C.slotOccupiedBg,
                            color: slot.availability ? "#fff" : C.electric,
                            border: slot.availability
                              ? "none"
                              : `1.5px solid ${C.slotOccupiedBorder}`,
                            borderLeft: slot.availability
                              ? "none"
                              : `3px solid ${C.slotOccupiedBorder}`,
                            borderRadius: 3,
                            padding: "2px 6px",
                            cursor: "pointer",
                            fontFamily: FONT_SANS,
                            textAlign: "left",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            gap: 1,
                          }}
                        >
                          {/* TAREA 1 — Línea 1: tipo/nombre */}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: slot.availability
                                ? "uppercase"
                                : "none",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              lineHeight: 1.2,
                              color: slot.availability ? "#fff" : C.electric,
                            }}
                          >
                            {slot.availability
                              ? "LIBRE"
                              : `${slot.appointment?.patient_surname ?? ""}, ${
                                  slot.appointment?.patient_name ?? ""
                                }`.trim() || "OCUPADO"}
                          </span>
                          {/* TAREA 1 — Línea 2: rango horario */}
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 600,
                              lineHeight: 1.2,
                              whiteSpace: "nowrap",
                              color: slot.availability
                                ? "rgba(255,255,255,0.85)"
                                : `rgba(37,99,235,0.7)`,
                            }}
                          >
                            {formatTimeRange(slot.startTime, slot.endTime)}
                          </span>
                        </button>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

// ════════════════════════════════════════════════════════════════
// CUSTOM MONTH GRID — reemplaza react-big-calendar month view
//
// Grilla mensual completamente custom, análoga en arquitectura a
// CustomWeekGrid. 7 columnas (Lun–Dom), N filas según semanas del mes.
// Recibe MonthResponse directamente desde el fetch — sin transformar
// a eventos RBC. Los días no son clickeables (iteración futura).
// ════════════════════════════════════════════════════════════════
interface MonthGridProps {
  data: MonthResponse;
}

const WEEKDAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const CELL_MIN_HEIGHT = 88;
const CELL_PADDING = "10px 10px 8px";

const CustomMonthGrid = React.memo(function CustomMonthGrid({
  data,
}: MonthGridProps) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // ── Construir la grilla de celdas ──
  const cells = useMemo((): (DailySummaryResponse | null)[] => {
    if (!data?.days || !Array.isArray(data.days) || data.days.length === 0) return [];

    // Fecha real del primer día retornado por el backend
    const firstReturnedDate = safeDateFromString(data.days[0].date);
    if (!firstReturnedDate) return [];

    // Offset hasta lunes de ese primer día real
    const startWeekday = firstReturnedDate.getDay(); // 0=dom, 1=lun...6=sáb
    const offsetToMonday = startWeekday === 0 ? 6 : startWeekday - 1;

    // Construir grilla: [null×offset, ...data.days]
    // Los nulls representan: (a) días de semanas anteriores al mes, y
    // (b) días del mes que la agenda no cubre (anteriores al inicio de agenda)
    const grid: (DailySummaryResponse | null)[] = [
      ...Array(offsetToMonday).fill(null),
      ...data.days,
    ];

    // Completar al final hasta múltiplo de 7
    while (grid.length % 7 !== 0) grid.push(null);

    return grid;
  }, [data]);

  if (!data?.days || data.days.length === 0) {
    return <EmptyState text="No hay datos para este mes" />;
  }

  const getBadgeStyle = (state: DailySummaryResponse["state"]): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "inline-block",
      borderRadius: 4,
      padding: "2px 7px",
      fontSize: 10,
      fontWeight: 700,
      color: "#fff",
      fontFamily: FONT_SANS,
      lineHeight: 1.5,
    };
    switch (state) {
      case "AVAILABLE":
        return { ...base, background: "#22C55E" };
      case "LOW_AVAILABILITY":
        return { ...base, background: "#F59E0B" };
      case "FULL":
        return {
          ...base,
          background: "#EF4444",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        };
      default:
        return base;
    }
  };

  const getCellStyle = (
    day: DailySummaryResponse | null
  ): React.CSSProperties => {
    if (!day) {
      return {
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: 8,
        minHeight: CELL_MIN_HEIGHT,
        padding: CELL_PADDING,
      };
    }
    switch (day.state) {
      case "NO_SCHEDULE":
        return {
          background: "#FAFBFC",
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          minHeight: CELL_MIN_HEIGHT,
          padding: CELL_PADDING,
        };
      case "FULL":
        return {
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 8,
          minHeight: CELL_MIN_HEIGHT,
          padding: CELL_PADDING,
        };
      case "AVAILABLE":
      case "LOW_AVAILABILITY":
      default:
        return {
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          minHeight: CELL_MIN_HEIGHT,
          padding: CELL_PADDING,
        };
    }
  };

  const getDayNumStyle = (
    day: DailySummaryResponse,
    isToday: boolean
  ): React.CSSProperties => {
    if (isToday) {
      return {
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: C.electric,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: FONT_SANS,
      };
    }
    const base: React.CSSProperties = {
      fontSize: 13,
      fontFamily: FONT_SANS,
      lineHeight: 1,
    };
    switch (day.state) {
      case "NO_SCHEDULE":
        return { ...base, color: C.textMuted, fontWeight: 500 };
      case "FULL":
        return { ...base, color: "#991B1B", fontWeight: 600 };
      default:
        return { ...base, color: C.textPrimary, fontWeight: 600 };
    }
  };

  const getBadgeText = (day: DailySummaryResponse): string => {
    if (day.state === "FULL") return "COMPLETO";
    const n = day.freeSlots ?? 0;
    return `${n} libre${n !== 1 ? "s" : ""}`;
  };

  return (
    <div style={{ fontFamily: FONT_SANS, padding: "4px 0" }}>
      {/* Header días de la semana */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
          marginBottom: 8,
          paddingBottom: 10,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            style={{
              textAlign: "center",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: C.textMuted,
              fontFamily: FONT_SANS,
              textTransform: "uppercase",
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Grilla de días */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
        }}
      >
        {cells.map((day, idx) => {
          if (!day) {
            // Celda vacía de relleno
            return (
              <div
                key={`empty-${idx}`}
                style={{
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 8,
                  minHeight: CELL_MIN_HEIGHT,
                  padding: CELL_PADDING,
                }}
              />
            );
          }

          const isToday = day.date === todayStr;
          const cellStyle = getCellStyle(day);
          const showBadge = day.state !== "NO_SCHEDULE";

          return (
            <div key={day.date} style={cellStyle}>
              {/* Número del día */}
              <div style={getDayNumStyle(day, isToday)}>
                {day.number_day}
              </div>
              {/* Badge de disponibilidad */}
              {showBadge && (
                <div style={{ marginTop: 8 }}>
                  <span style={getBadgeStyle(day.state)}>
                    {getBadgeText(day)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ════════════════════════════════════════════════════════════════
// TAREA 2 — CALENDAR TOOLBAR (rediseño navegación semanal)
// ════════════════════════════════════════════════════════════════
interface CalendarToolbarProps {
  viewMode: "week" | "month";
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToggleView: (v: "week" | "month") => void;
}

function CalendarToolbar({
  viewMode,
  currentDate,
  onPrev,
  onNext,
  onToggleView,
}: CalendarToolbarProps) {
  const label =
    viewMode === "week"
      ? formatWeekLabel(currentDate)
      : formatMonthLabel(currentDate);

  const prevLabel =
    viewMode === "week" ? "Semana anterior" : "Mes anterior";
  const nextLabel =
    viewMode === "week" ? "Semana siguiente" : "Mes siguiente";

  // Estado de hover para los botones de navegación
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);

  const navBtnBase: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 8,
    border: `1.5px solid ${C.border}`,
    background: C.cardBg,
    color: C.textSecondary,
    fontFamily: FONT_SANS,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "border-color 0.12s, color 0.12s",
    flexShrink: 0,
  };

  const navBtnHovered: React.CSSProperties = {
    borderColor: C.electric,
    color: C.electric,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 14,
        gap: 12,
      }}
    >
      {/* Botón izquierdo — Semana/Mes anterior */}
      <button
        style={{
          ...navBtnBase,
          ...(prevHovered ? navBtnHovered : {}),
        }}
        onClick={onPrev}
        onMouseEnter={() => setPrevHovered(true)}
        onMouseLeave={() => setPrevHovered(false)}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7.5 3l-3 3 3 3" />
        </svg>
        {prevLabel}
      </button>

      {/* Label central de rango */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: FONT_SANS,
            fontSize: 14,
            fontWeight: 700,
            color: C.textPrimary,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>

      {/* Botón derecho — Semana/Mes siguiente */}
      <button
        style={{
          ...navBtnBase,
          ...(nextHovered ? navBtnHovered : {}),
        }}
        onClick={onNext}
        onMouseEnter={() => setNextHovered(true)}
        onMouseLeave={() => setNextHovered(false)}
      >
        {nextLabel}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 3l3 3-3 3" />
        </svg>
      </button>

      {/* Toggle Semana / Mes — a la derecha del botón siguiente */}
      <div
        style={{
          display: "flex",
          border: `1.5px solid ${C.border}`,
          borderRadius: 8,
          overflow: "hidden",
          background: "#F4F5F7",
          flexShrink: 0,
        }}
      >
        {(["month", "week"] as const).map((v) => (
          <button
            key={v}
            onClick={() => onToggleView(v)}
            style={{
              padding: "7px 18px",
              border: "none",
              cursor: "pointer",
              fontFamily: FONT_SANS,
              fontSize: 12.5,
              fontWeight: 600,
              background: viewMode === v ? C.electric : "transparent",
              color: viewMode === v ? "#fff" : C.textSecondary,
              transition: "all 0.15s",
              letterSpacing: "0.01em",
            }}
          >
            {v === "month" ? "Mes" : "Semana"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AGENDA SELECTOR (sin cambios)
// ════════════════════════════════════════════════════════════════
interface AgendaSelectorProps {
  agendas: AgendaItem[];
  selectedId: number | null;
  loading: boolean;
  onChange: (id: number) => void;
}

function AgendaSelector({
  agendas,
  selectedId,
  loading,
  onChange,
}: AgendaSelectorProps) {
  const [focused, setFocused] = useState(false);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 320,
            height: 42,
            borderRadius: 8,
            background: "#F0F1F5",
            animation: "dentify-pulse 1.4s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: C.textMuted,
          fontFamily: FONT_SANS,
        }}
      >
        Agenda
      </label>
      <div style={{ position: "relative", width: 320 }}>
        <select
          value={selectedId ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            padding: "10px 36px 10px 14px",
            border: `1.5px solid ${focused ? C.electric : C.border}`,
            borderRadius: 8,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: selectedId ? C.textPrimary : C.textMuted,
            background: C.cardBg,
            appearance: "none",
            outline: "none",
            cursor: "pointer",
            transition: "border-color 0.15s",
            boxShadow: focused ? `0 0 0 3px rgba(37,99,235,0.10)` : "none",
          }}
        >
          <option value="" disabled>
            Seleccioná una agenda...
          </option>
          {agendas.map((a) => (
            <option key={a.id_agenda} value={a.id_agenda}>
              {a.agenda_name}
            </option>
          ))}
        </select>
        <div
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: C.textMuted,
            display: "flex",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 4.5l3 3 3-3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TYPES — OtorgarTurnoView
// ════════════════════════════════════════════════════════════════
interface UserProfileShape {
  name: string;
  surname: string;
  clinicName: string;
  roles: string[];
}
 
interface OtorgarTurnoViewProps {
  onNavigate: (id: string) => void;
  userProfile: UserProfileShape | null;
  onSlotSelected?: (context: SelectedSlotContext) => void;
  onAppointmentSelected?: (appointmentId: number) => void;
}
 

// ════════════════════════════════════════════════════════════════
// MAIN VIEW — OtorgarTurnoView
// ════════════════════════════════════════════════════════════════
export function OtorgarTurnoView({
  onNavigate,
  userProfile,
  onSlotSelected,
  onAppointmentSelected,
}: OtorgarTurnoViewProps) {
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [agendaLoad, setAgendaLoad] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
 
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
 
  const [weekData, setWeekData] = useState<WeekResponse | null>(null);
  const [monthData, setMonthData] = useState<MonthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<"empty" | "server" | "out_of_range" | null>(null);
 
  const cacheRef = useRef<Map<string, WeekResponse | MonthResponse>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const [boundaryKey, setBoundaryKey] = useState(0);
 
  const selectedAgenda = useMemo(
    () => agendas.find((a) => a.id_agenda === selectedId) ?? null,
    [agendas, selectedId]
  );
 
  // ── Carga de agendas ──
  useEffect(() => {
    if (userProfile === null) return;
    const isSecretary = userProfile.roles.includes("SECRETARY");
    const endpoint = isSecretary
      ? "/api/agendas/find/by-clinic"
      : "/api/agendas/find/by-dentist";
    setAgendaLoad(true);
    apiClient
      .get(endpoint)
      .then((res: { data: AgendaItem[] }) => {
        const active = res.data.filter((a) => a.active);
        setAgendas(active);
      })
      .catch(() => setAgendas([]))
      .finally(() => setAgendaLoad(false));
  }, [userProfile]);
 
  // ── Fetch week ──
  const fetchWeek = useCallback(
    async (agendaId: number, date: Date, agenda: AgendaItem | null) => {
      const { startDate, endDate } = getWeekBounds(date);
 
      if (
        agenda?.startDate &&
        agenda?.endDate &&
        !isWeekInAgendaRange(date, agenda.startDate, agenda.endDate)
      ) {
        setWeekData(null);
        setError("out_of_range");
        setLoading(false);
        return;
      }
 
      const key = `week-${agendaId}-${startDate}`;
 
      if (cacheRef.current.has(key)) {
        setWeekData(cacheRef.current.get(key) as WeekResponse);
        setError(null);
        return;
      }
 
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
 
      setLoading(true);
      setError(null);
      setWeekData(null);
 
      try {
        const res = await apiClient.get("/api/calendar/weekly/slots", {
          params: buildWeeklyParams(agendaId, startDate, endDate),
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        const data = res.data as WeekResponse;
        cacheRef.current.set(key, data);
        setWeekData(data);
        setError(null);
      } catch (err: unknown) {
        const axiosErr = err as { name?: string; code?: string; response?: { status?: number } };
        if (
          axiosErr?.name === "CanceledError" ||
          axiosErr?.code === "ERR_CANCELED" ||
          axiosErr?.name === "AbortError"
        ) {
          return;
        }
        const status = axiosErr?.response?.status;
        setError(
          typeof status === "number" && status >= 500 ? "server" : "empty"
        );
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );
 
  // ── Fetch month ──
  const fetchMonth = useCallback(
    async (agendaId: number, date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `month-${agendaId}-${year}-${String(month).padStart(2, "0")}`;
 
      if (cacheRef.current.has(key)) {
        setMonthData(cacheRef.current.get(key) as MonthResponse);
        setError(null);
        return;
      }
 
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
 
      setLoading(true);
      setError(null);
      setMonthData(null);
 
      try {
        const res = await apiClient.get("/api/calendar/monthly/slots", {
          params: buildMonthlyParams(agendaId, year, month),
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        const data = res.data as MonthResponse;
        cacheRef.current.set(key, data);
        setMonthData(data);
        setError(null);
      } catch (err: unknown) {
        const axiosErr = err as {
          name?: string;
          code?: string;
          response?: { status?: number; data?: { error?: string } };
        };
        if (
          axiosErr?.name === "CanceledError" ||
          axiosErr?.code === "ERR_CANCELED" ||
          axiosErr?.name === "AbortError"
        ) {
          return;
        }
        const errorCode = axiosErr?.response?.data?.error;
        if (errorCode === "AGENDA_DATE_OUT_OF_RANGE") {
          setError("out_of_range");
          return;
        }
        const status = axiosErr?.response?.status;
        setError(
          typeof status === "number" && status >= 500 ? "server" : "empty"
        );
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );
 
  useEffect(() => {
    if (!selectedId) return;
    if (viewMode === "week") {
      fetchWeek(selectedId, currentDate, selectedAgenda);
    } else {
      fetchMonth(selectedId, currentDate);
    }
  }, [selectedId, currentDate, viewMode, fetchWeek, fetchMonth, selectedAgenda]);
 
  const handlePrev = useCallback(() => {
    setCurrentDate((prev) =>
      viewMode === "week" ? subWeeks(prev, 1) : subMonths(prev, 1)
    );
  }, [viewMode]);
 
  const handleNext = useCallback(() => {
    setCurrentDate((prev) =>
      viewMode === "week" ? addWeeks(prev, 1) : addMonths(prev, 1)
    );
  }, [viewMode]);
 
  const handleToggleView = useCallback((v: "week" | "month") => {
    setViewMode(v);
    setCurrentDate(new Date());
  }, []);
 
  const handleSelectAgenda = useCallback((id: number) => {
    setSelectedId(id);
    setWeekData(null);
    setMonthData(null);
    setError(null);
    cacheRef.current.clear();
    setCurrentDate(new Date());
    setBoundaryKey((k) => k + 1);
  }, []);
 
  // ── CAMBIO 3: handleSlotClick — incluye productId y productName del weekData ──
  const handleSlotClick = useCallback(
    (event: RBCEvent) => {
      const res = event.resource as SlotResource;
 
      // Slot OCUPADO → navegar a detalle del turno
      if (!res.availability) {
        const apptId = res.appointment?.id;
        if (apptId) {
          onAppointmentSelected?.(apptId);
          onNavigate("turno-detail");
        }
        return;
      }
 
      // Slot LIBRE → validar agenda y navegar a crear turno
      if (!selectedAgenda?.dentist_id) {
        alert("Error: no se encontró el profesional de la agenda. Contactá con soporte.");
        return;
      }
 
      // Extraer producto de weekData (puede ser null si la agenda no tiene producto)
      const productId = weekData?.id_product ?? null;
      const productName = weekData?.productName ?? null;
 
      const context: SelectedSlotContext = {
        agendaId: selectedId!,
        agendaName: selectedAgenda?.agenda_name ?? "",
        slotDate: res.dayDate ?? "",
        startTime: res.startTime ?? "",
        endTime: res.endTime ?? "",
        dayOfWeek: "",
        dentistId: selectedAgenda.dentist_id,
        dentistFullName: selectedAgenda.dentist_full_name ?? "",
        productId,
        productName,
      };
 
      localStorage.setItem("selectedSlotContext", JSON.stringify(context));
      onSlotSelected?.(context);
      onNavigate("crear-turno");
    },
    [selectedId, selectedAgenda, weekData, onNavigate, onSlotSelected, onAppointmentSelected]
  );
 
  const handleRetry = useCallback(() => {
    if (!selectedId) return;
    cacheRef.current.clear();
    setError(null);
    setBoundaryKey((k) => k + 1);
    if (viewMode === "week") {
      fetchWeek(selectedId, currentDate, selectedAgenda);
    } else {
      fetchMonth(selectedId, currentDate);
    }
  }, [selectedId, viewMode, currentDate, fetchWeek, fetchMonth, selectedAgenda]);
 
  const outOfRangeMessage =
    viewMode === "week"
      ? "Esta semana está fuera del rango de la agenda"
      : "Este mes no está completamente cubierto por el rango de la agenda";
 
  return (
    <div
      style={{ padding: "32px 36px", background: C.bg, minHeight: "100%" }}
    >
      <style>{`
        @keyframes dentify-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
 
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 26,
            fontWeight: 400,
            color: C.textPrimary,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}
        >
          Otorgar turno
        </h1>
        <p
          style={{
            marginTop: 5,
            fontSize: 13,
            color: C.textSecondary,
            fontFamily: FONT_SANS,
          }}
        >
          Seleccioná una agenda para ver la disponibilidad
        </p>
      </div>
 
      {agendas.length === 0 && !agendaLoad ? (
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "40px",
            maxWidth: 480,
          }}
        >
          <EmptyState text="No hay agendas activas disponibles" />
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <AgendaSelector
            agendas={agendas}
            selectedId={selectedId}
            loading={agendaLoad}
            onChange={handleSelectAgenda}
          />
        </div>
      )}
 
      {selectedId && (
        <>
          <CalendarToolbar
            viewMode={viewMode}
            currentDate={currentDate}
            onPrev={handlePrev}
            onNext={handleNext}
            onToggleView={handleToggleView}
          />
 
          <CalendarErrorBoundary key={boundaryKey} onRetry={handleRetry}>
            <div
              style={{
                display: "flex",
                gap: 0,
                background: C.cardBg,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                {loading && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 5,
                      background: "rgba(255,255,255,0.85)",
                      backdropFilter: "blur(2px)",
                    }}
                  >
                    <SkeletonLoader />
                  </div>
                )}
 
                {!loading && error === "out_of_range" && (
                  <EmptyState text={outOfRangeMessage} />
                )}
 
                {!loading && error === "empty" && (
                  <EmptyState text="No hay disponibilidad para este período" />
                )}
 
                {!loading && error === "server" && (
                  <EmptyState
                    text="Error al cargar los turnos. Intentá nuevamente."
                    onRetry={handleRetry}
                  />
                )}
 
                {!error && (
                  <div style={{ padding: "16px" }}>
                    {viewMode === "week" ? (
                      weekData ? (
                        <CustomWeekGrid
                          data={weekData}
                          onSelectEvent={handleSlotClick}
                        />
                      ) : !loading ? (
                        <EmptyState text="No hay datos para esta semana" />
                      ) : null
                    ) : (
                      monthData ? (
                        <CustomMonthGrid data={monthData} />
                      ) : !loading ? (
                        <EmptyState text="No hay datos para este mes" />
                      ) : null
                    )}
                  </div>
                )}
              </div>
            </div>
          </CalendarErrorBoundary>
 
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginTop: 14,
              paddingLeft: 4,
            }}
          >
            {viewMode === "week" ? (
              <>
                <LegendDot color="#22C55E" label="Turno libre" />
                <LegendDot color={C.electric} label="Turno ocupado" border />
              </>
            ) : (
              <>
                <LegendDot color="#22C55E" label="Disponible" />
                <LegendDot color="#F59E0B" label="Baja disponibilidad" />
                <LegendDot color="#EF4444" label="Sin disponibilidad" />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LegendDot({
  color,
  label,
  border,
}: {
  color: string;
  label: string;
  border?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: border ? "#EFF6FF" : color,
          borderLeft: border ? `3px solid ${color}` : undefined,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontFamily: FONT_SANS,
          fontSize: 11,
          color: C.textMuted,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// HELPER — SelectedSlotContext persistente
// ════════════════════════════════════════════════════════════════
export const getSelectedSlotContext = (): SelectedSlotContext | null => {
  const raw = localStorage.getItem("selectedSlotContext");
  return raw ? JSON.parse(raw) : null;
};
 
export const clearSelectedSlotContext = (): void => {
  localStorage.removeItem("selectedSlotContext");
};
