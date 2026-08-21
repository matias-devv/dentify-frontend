// ════════════════════════════════════════════════════════════════════════════
// TurnosViews.tsx — Vista "Otorgar Turno" — Dentify Dashboard
// Semana: grilla custom (reemplaza RBC week view — elimina crash interno)
// Mes: grilla custom (reemplaza RBC month view — CustomMonthGrid)
// date-fns · TypeScript estricto · sin moment.js · sin react-big-calendar
//
// Rediseño visual (Figma) integrado sobre la lógica real — ver notas inline.
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
// CAMBIO 1 — import de useNavigate del router
import { useNavigate as useRouterNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS — reemplazados por la paleta del mock de Figma,
// con las 3 correcciones solicitadas aplicadas directamente acá.
// ════════════════════════════════════════════════════════════════
const C = {
  bg: "#F4F3F0",
  cardBg: "#FFFFFF",
  cardSecondary: "#F8F8F6",
  navy: "#0A1628",
  navyMid: "#1A2B4A",
  blue: "#1A6FD4",
  blueLight: "#4A9EE8",
  blueFaint: "#EBF2FB",
  textPrimary: "#0A1628",
  textSecondary: "#5A6A7A",
  textMuted: "#6A7A8A",
  textTertiary: "#8A9AA8",
  border: "#EAEAE6",
  borderPanel: "#E8EFF6",
  // Corrección 1 — slot "libre": más claro y vívido que el original de Figma
  // (#3B7A6A), manteniendo paleta institucional (sin caer en verde neón).
  slotFree: "#33A578",
  slotFreeBg: "#33A578",
  slotFreeHover: "#2B8C66",
  slotFreeFaint: "#EBF4F0",
  slotPast: "#B8C0C8",
  slotPastBg: "#EAECEF",
  // Corrección 1 — slot "ocupado": más claro y vívido que el original de
  // Figma (#8C2121), evitando el rojo semáforo genérico.
  slotOccupiedBg: "#D1524B",
  slotOccupiedHover: "#BC443D",
  slotOccupiedBorder: "#8F332F",
  errorRed: "#B84040",
  errorRedFaint: "#FBF0EF",
  amber: "#B07020",
  amberFaint: "#FBF5EB",
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
  dentist_id?: number;
  dentist_full_name?: string;
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
  id_product: number | null;
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
  slotDate: string;
  startTime: string;
  endTime: string;
  dayOfWeek: string;
  dentistId: number;
  dentistFullName: string;
  productId: number | null;
  productName: string | null;
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

const parseTimeComponents = (timeStr: string): [number, number] | null => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return [h, m];
};

const safeDateFromString = (dateStr: string): Date | null => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const clean = dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const d = new Date(clean + "T00:00:00");
  return isValidDate(d) ? d : null;
};

const formatTimeRange = (start: string, end: string): string => {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
};

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
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          fontFamily: FONT_SANS,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: C.errorRedFaint,
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 6v5M10 13.5v.5"
              stroke={C.errorRed}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="10" cy="10" r="8.5" stroke={C.errorRed} strokeWidth="1.5" />
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
            background: C.blue,
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
                color: C.errorRed,
                background: C.errorRedFaint,
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
  subtitle,
  icon = "📋",
  onRetry,
  compact,
}: {
  text: string;
  subtitle?: string;
  icon?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        padding: compact ? "0 28px" : "48px 28px",
        textAlign: "center",
        fontFamily: FONT_SANS,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: C.cardSecondary,
          border: `1px solid ${C.border}`,
          margin: "0 auto 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 19,
        }}
      >
        {icon}
      </div>
      <p
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: C.textPrimary,
          marginBottom: subtitle ? 6 : onRetry ? 16 : 0,
          letterSpacing: "-0.01em",
        }}
      >
        {text}
      </p>
      {subtitle && (
        <p
          style={{
            fontSize: 12,
            color: C.textMuted,
            marginBottom: onRetry ? 18 : 0,
            maxWidth: 320,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 16,
            padding: "9px 22px",
            borderRadius: 7,
            border: `1.5px solid ${C.border}`,
            background: C.cardBg,
            color: C.blue,
            fontFamily: FONT_SANS,
            fontSize: 12.5,
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
    <div style={{ padding: "20px 18px", minHeight: 480 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "72px repeat(7, 1fr)",
          gap: 4,
          marginBottom: 10,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 34,
              borderRadius: 6,
              background: i === 0 ? "transparent" : C.border,
              animation: "dentify-pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.07}s`,
            }}
          />
        ))}
      </div>
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "72px repeat(7, 1fr)",
            gap: 4,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              height: 36,
              borderRadius: 4,
              background: i % 3 === 0 ? C.border : "transparent",
              opacity: 0.55,
            }}
          />
          {Array.from({ length: 7 }).map((_, j) => (
            <div
              key={j}
              style={{
                height: 36,
                borderRadius: 4,
                background: j < 5 ? C.slotFreeFaint : "transparent",
                opacity: 0.4 + i * 0.06,
                animation: "dentify-pulse 1.5s ease-in-out infinite",
                animationDelay: `${(i * 7 + j) * 0.04}s`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// WEEK SLOT BUTTON
// Estilos de Figma (colores, tipografía, estructura del botón) aplicados
// sobre la lógica booleana real (`slot.availability` + `slotIsPast`
// calculado en CustomWeekGrid). Las mismas ramas condicionales que ya
// existían se conservan tal cual, solo cambia cómo se presentan.
// ════════════════════════════════════════════════════════════════
interface WeekSlotButtonProps {
  slot: SlotResponse;
  slotIsPast: boolean;
  onClick: () => void;
}

function WeekSlotButton({ slot, slotIsPast, onClick }: WeekSlotButtonProps) {
  const [hov, setHov] = useState(false);

  const isPastFree = slot.availability && slotIsPast;
  const isFree = slot.availability && !slotIsPast;
  const isOccupied = !slot.availability;

  const timeLabel = formatTimeRange(slot.startTime, slot.endTime);
  const patientLabel = `${slot.appointment?.patient_surname ?? ""}, ${
    slot.appointment?.patient_name ?? ""
  }`.trim();

  const bg = isPastFree
    ? C.slotPastBg
    : isFree
    ? hov
      ? C.slotFreeHover
      : C.slotFreeBg
    : hov
    ? C.slotOccupiedHover
    : C.slotOccupiedBg;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={
        isPastFree
          ? `Horario pasado: ${timeLabel}`
          : isFree
          ? `Libre: ${timeLabel}`
          : `${patientLabel} — ${timeLabel}`
      }
      style={{
        width: "100%",
        height: 36,
        background: bg,
        border: isOccupied ? `1px solid ${C.slotOccupiedBorder}` : "none",
        borderLeft: isOccupied ? `3px solid ${C.slotOccupiedBorder}` : "none",
        borderRadius: 4,
        padding: "2px 7px",
        cursor: isPastFree ? "not-allowed" : "pointer",
        opacity: isPastFree ? 0.6 : 1,
        fontFamily: FONT_SANS,
        textAlign: "left",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 1,
        transition: "background 0.1s",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: isFree || isPastFree ? "uppercase" : "none",
          color: isPastFree ? C.textMuted : "#fff",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
          textDecoration: isPastFree ? "line-through" : "none",
        }}
      >
        {isPastFree ? "PASADO" : isFree ? "LIBRE" : patientLabel || "OCUPADO"}
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 500,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          color: isPastFree ? C.textTertiary : "rgba(255,255,255,0.8)",
        }}
      >
        {timeLabel}
      </span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// CUSTOM WEEK GRID
// ════════════════════════════════════════════════════════════════
interface WeekGridProps {
  data: WeekResponse;
  onSelectEvent: (event: RBCEvent) => void;
}

const CustomWeekGrid = React.memo(function CustomWeekGrid({
  data,
  onSelectEvent,
}: WeekGridProps) {
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

  const hourOf = (t: string): string => {
    const parts = t.split(":");
    return `${parts[0]}:00`;
  };

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
    return <EmptyState icon="📅" text="No hay slots disponibles en esta semana" />;
  }

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
        <colgroup>
          <col style={{ width: COL_HOUR }} />
          {days.map((d) => (
            <col key={d.date} />
          ))}
        </colgroup>

        <thead>
          <tr>
            <th
              style={{
                padding: "10px 0 10px 12px",
                textAlign: "left",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: C.textTertiary,
                borderBottom: `1px solid ${C.border}`,
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
                    padding: "8px 4px",
                    textAlign: "center",
                    borderBottom: `1px solid ${todayCol ? C.blue : C.border}`,
                    borderLeft: `1px solid ${C.border}`,
                    background: todayCol ? C.blueFaint : C.cardBg,
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      color: todayCol ? C.blue : C.textTertiary,
                      textTransform: "uppercase",
                    }}
                  >
                    {weekday}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: todayCol ? C.blue : C.textPrimary,
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
                    : `1px solid #F2F2F0`,
                }}
              >
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
                        fontSize: 10.5,
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

                {/* CAMBIO 5 — Celdas con detección de slots pasados */}
                {days.map((day) => {
                  const slot = slotMap.get(`${day.date}::${startTime}`);
                  const todayCol = day.date === todayStr;

                  // Detectar si el slot libre ya pasó
                  let slotIsPast = false;
                  if (slot?.availability && day.date) {
                    slotIsPast = day.date < todayStr;
                    if (!slotIsPast && day.date === todayStr) {
                      const p = parseTimeComponents(startTime);
                      if (p) {
                        const now = new Date();
                        slotIsPast =
                          p[0] < now.getHours() ||
                          (p[0] === now.getHours() && p[1] < now.getMinutes());
                      }
                    }
                  }

                  return (
                    <td
                      key={day.date}
                      style={{
                        padding: "2px 4px",
                        borderLeft: `1px solid ${C.border}`,
                        background: todayCol
                          ? "rgba(26,111,212,0.025)"
                          : undefined,
                        verticalAlign: "middle",
                        height: 38,
                      }}
                    >
                      {slot ? (
                        <WeekSlotButton
                          slot={slot}
                          slotIsPast={slotIsPast}
                          onClick={() => {
                            const ev = makeEvent(slot, day);
                            if (ev) onSelectEvent(ev);
                          }}
                        />
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
// CUSTOM MONTH GRID
// ════════════════════════════════════════════════════════════════
interface MonthGridProps {
  data: MonthResponse;
}

const WEEKDAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const CELL_MIN_HEIGHT = 80;
const CELL_PADDING = "10px 10px 8px";

const CustomMonthGrid = React.memo(function CustomMonthGrid({
  data,
}: MonthGridProps) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells = useMemo((): (DailySummaryResponse | null)[] => {
    if (!data?.days || !Array.isArray(data.days) || data.days.length === 0) return [];

    const firstReturnedDate = safeDateFromString(data.days[0].date);
    if (!firstReturnedDate) return [];

    const startWeekday = firstReturnedDate.getDay();
    const offsetToMonday = startWeekday === 0 ? 6 : startWeekday - 1;

    const grid: (DailySummaryResponse | null)[] = [
      ...Array(offsetToMonday).fill(null),
      ...data.days,
    ];

    while (grid.length % 7 !== 0) grid.push(null);

    return grid;
  }, [data]);

  if (!data?.days || data.days.length === 0) {
    return <EmptyState icon="📆" text="No hay datos para este mes" />;
  }

  const getBadgeStyle = (state: DailySummaryResponse["state"]): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "inline-block",
      borderRadius: 4,
      padding: "2px 7px",
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: "0.03em",
      color: "#fff",
      fontFamily: FONT_SANS,
      lineHeight: 1.5,
    };
    switch (state) {
      case "AVAILABLE":
        return { ...base, background: C.slotFree };
      case "LOW_AVAILABILITY":
        return { ...base, background: C.amber };
      case "FULL":
        return {
          ...base,
          background: C.errorRed,
          textTransform: "uppercase",
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
          background: C.cardSecondary,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          minHeight: CELL_MIN_HEIGHT,
          padding: CELL_PADDING,
        };
      case "FULL":
        return {
          background: C.errorRedFaint,
          border: "1px solid #EECECE",
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
        background: C.navy,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11.5,
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
        return { ...base, color: C.textTertiary, fontWeight: 500 };
      case "FULL":
        return { ...base, color: C.errorRed, fontWeight: 600 };
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 5,
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
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: C.textTertiary,
              fontFamily: FONT_SANS,
              textTransform: "uppercase",
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 5,
        }}
      >
        {cells.map((day, idx) => {
          if (!day) {
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
              <div style={getDayNumStyle(day, isToday)}>
                {day.number_day}
              </div>
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
// CALENDAR TOOLBAR
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

  const prevLabel = viewMode === "week" ? "Semana anterior" : "Mes anterior";
  const nextLabel = viewMode === "week" ? "Semana siguiente" : "Mes siguiente";

  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);

  const navBtnBase: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 6,
    border: `1.5px solid ${C.border}`,
    background: "transparent",
    color: C.textSecondary,
    fontFamily: FONT_SANS,
    fontSize: 12.5,
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.12s",
    flexShrink: 0,
  };

  const navBtnHovered: React.CSSProperties = {
    borderColor: C.borderPanel,
    background: C.cardBg,
    color: C.blue,
    boxShadow: "0 1px 4px rgba(10,22,40,0.07)",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 16,
        gap: 10,
      }}
    >
      <button
        style={{ ...navBtnBase, ...(prevHovered ? navBtnHovered : {}) }}
        onClick={onPrev}
        onMouseEnter={() => setPrevHovered(true)}
        onMouseLeave={() => setPrevHovered(false)}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 11 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 2L4 5.5 7 9" />
        </svg>
        {prevLabel}
      </button>

      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <span
          style={{
            fontFamily: FONT_SANS,
            fontSize: 12.5,
            fontWeight: 600,
            color: C.textPrimary,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>

      <button
        style={{ ...navBtnBase, ...(nextHovered ? navBtnHovered : {}) }}
        onClick={onNext}
        onMouseEnter={() => setNextHovered(true)}
        onMouseLeave={() => setNextHovered(false)}
      >
        {nextLabel}
        <svg
          width="11"
          height="11"
          viewBox="0 0 11 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 2l3 3.5-3 3.5" />
        </svg>
      </button>

      <div
        style={{
          display: "flex",
          border: `1.5px solid ${C.border}`,
          borderRadius: 6,
          overflow: "hidden",
          background: C.cardSecondary,
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
              background: viewMode === v ? C.navy : "transparent",
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
// AGENDA SELECTOR
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
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            width: 60,
            height: 10,
            borderRadius: 3,
            background: C.cardSecondary,
          }}
        />
        <div
          style={{
            width: 300,
            height: 42,
            borderRadius: 8,
            background: C.cardSecondary,
            border: `1px solid ${C.border}`,
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
          fontFamily: FONT_SANS,
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          color: C.textMuted,
        }}
      >
        Agenda
      </label>
      <div style={{ position: "relative", width: 300 }}>
        <select
          value={selectedId ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            padding: "10px 38px 10px 14px",
            border: `1.5px solid ${focused ? C.blue : C.borderPanel}`,
            borderRadius: 8,
            fontFamily: FONT_SANS,
            fontSize: 13,
            fontWeight: 500,
            color: selectedId ? C.textPrimary : C.textMuted,
            background: C.cardBg,
            appearance: "none",
            outline: "none",
            cursor: "pointer",
            transition: "border-color 0.15s, box-shadow 0.15s",
            boxShadow: focused
              ? `0 0 0 3px rgba(26,111,212,0.10)`
              : "0 1px 4px rgba(10,22,40,0.06)",
          }}
        >
          <option value="" disabled>
            Seleccioná una agenda…
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
            right: 13,
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
            strokeWidth="1.8"
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

// CAMBIO 2 — onNavigate es opcional (puede no pasarse cuando la vista
// se carga directamente como route de DentistLayout)
interface OtorgarTurnoViewProps {
  onNavigate?: (id: string) => void;
  userProfile: UserProfileShape | null;
  onSlotSelected?: (context: SelectedSlotContext) => void;
  onAppointmentSelected?: (appointmentId: number) => void;
}

// ════════════════════════════════════════════════════════════════
// MAIN VIEW — OtorgarTurnoView
// ════════════════════════════════════════════════════════════════
export function OtorgarTurnoView({
  onNavigate: onNavigateProp,
  userProfile,
  onSlotSelected,
  onAppointmentSelected,
}: OtorgarTurnoViewProps) {
  // CAMBIO 2 — fallback router para cuando se carga como route de DentistLayout
  const routerNav = useRouterNavigate();

  // Navega por prop (state-based, viejo Dashboard) o por URL (DentistLayout)
  const handleNavigate = useCallback(
    (section: string) => {
      if (onNavigateProp) {
        onNavigateProp(section);
        return;
      }
      const routeMap: Record<string, string> = {
        "crear-turno":  "/dentist/dashboard/turnos/crear",
        "turno-detail": "/dentist/dashboard/turnos/detalle",
        home:           "/dentist/dashboard",
      };
      const route = routeMap[section];
      if (route) routerNav(route);
    },
    [onNavigateProp, routerNav]
  );

  // CAMBIO 4 — Toast flotante (reemplaza alert())
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  }, []);

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

  // CAMBIO 3 — handleSlotClick actualizado: slots pasados + toast + handleNavigate
  const handleSlotClick = useCallback(
    (event: RBCEvent) => {
      const res = event.resource as SlotResource;

      // ── Slot LIBRE en el pasado → toast informativo, no navegar ─────────
      if (res.availability && res.dayDate && res.startTime) {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        let isPast = res.dayDate < todayStr;
        if (!isPast && res.dayDate === todayStr) {
          const parts = parseTimeComponents(res.startTime);
          if (parts) {
            const [sh, sm] = parts;
            isPast =
              sh < now.getHours() ||
              (sh === now.getHours() && sm < now.getMinutes());
          }
        }
        if (isPast) {
          showToast("Este horario ya pasó. Solo podés reservar turnos a partir de ahora.");
          return;
        }
      }

      // ── Slot OCUPADO → detalle del turno ─────────────────────────────────
      if (!res.availability) {
        const apptId = res.appointment?.id;
        if (apptId) {
          onAppointmentSelected?.(apptId);
          // Guardar en localStorage para el flujo de DentistLayout (router)
          localStorage.setItem("selectedAppointmentId", String(apptId));
          handleNavigate("turno-detail");
        }
        return;
      }

      // ── Slot LIBRE → validar y navegar a crear turno ──────────────────────
      if (!selectedAgenda?.dentist_id) {
        showToast("Error: no se encontró el profesional de la agenda. Contactá con soporte.");
        return;
      }

      const context: SelectedSlotContext = {
        agendaId:        selectedId!,
        agendaName:      selectedAgenda.agenda_name ?? "",
        slotDate:        res.dayDate ?? "",
        startTime:       res.startTime ?? "",
        endTime:         res.endTime ?? "",
        dayOfWeek:       "",
        dentistId:       selectedAgenda.dentist_id,
        dentistFullName: selectedAgenda.dentist_full_name ?? "",
        productId:       weekData?.id_product ?? null,
        productName:     weekData?.productName ?? null,
      };

      localStorage.setItem("selectedSlotContext", JSON.stringify(context));
      onSlotSelected?.(context);
      handleNavigate("crear-turno");
    },
    [selectedId, selectedAgenda, weekData, handleNavigate, onSlotSelected, onAppointmentSelected, showToast]
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
      style={{ padding: "36px 40px", background: C.bg, minHeight: "100%" }}
    >
      {/* CAMBIO 4 — Keyframes: pulse + toast-in */}
      <style>{`
        @keyframes dentify-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        @keyframes dentify-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* CAMBIO 4 — Toast flotante en lugar de alert(), estilo Figma */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: C.navy,
            color: "#F0F4F8",
            padding: "11px 22px",
            borderRadius: 10,
            fontSize: 13,
            fontFamily: FONT_SANS,
            fontWeight: 500,
            zIndex: 200,
            boxShadow: "0 4px 20px rgba(10,22,40,0.28)",
            maxWidth: 420,
            textAlign: "center",
            lineHeight: 1.45,
            animation: "dentify-toast-in 0.22s ease",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: `1px solid rgba(74,158,232,0.2)`,
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            style={{ flexShrink: 0 }}
          >
            <circle cx="7.5" cy="7.5" r="6.5" stroke={C.blueLight} strokeWidth="1.4" />
            <path d="M7.5 5v3.5M7.5 10.5v.5" stroke={C.blueLight} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {toastMsg}
        </div>
      )}

      {/* Header — eyebrow + título serif + subtítulo (jerarquía tomada de Figma) */}
      <div style={{ marginBottom: 30 }}>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: C.blue,
            marginBottom: 8,
          }}
        >
          Módulo Turnos
        </div>
        <h1
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 42,
            fontWeight: 600,
            color: C.navy,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Otorgar turno
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: C.textSecondary,
            fontWeight: 400,
            lineHeight: 1.4,
            fontFamily: FONT_SANS,
          }}
        >
          Seleccioná una agenda para ver la disponibilidad
          {selectedAgenda?.dentist_full_name && (
            <span style={{ color: C.textMuted }}>
              {" "}· {selectedAgenda.dentist_full_name}
            </span>
          )}
        </p>
      </div>

      {agendas.length === 0 && !agendaLoad ? (
        <div
          style={{
            background: C.cardBg,
            border: `1.5px dashed ${C.border}`,
            borderRadius: 12,
            maxWidth: 460,
            minHeight: 220,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <EmptyState icon="🗂" text="No hay agendas activas disponibles" compact />
        </div>
      ) : (
        <div style={{ marginBottom: 28 }}>
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
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 2px 20px rgba(10,22,40,0.06)",
              }}
            >
              <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                {loading && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 5,
                      background: "rgba(255,255,255,0.88)",
                      backdropFilter: "blur(3px)",
                    }}
                  >
                    <SkeletonLoader />
                  </div>
                )}

                {!loading && error === "out_of_range" && (
                  <EmptyState icon="📭" text={outOfRangeMessage} />
                )}

                {!loading && error === "empty" && (
                  <EmptyState icon="🗓" text="No hay disponibilidad para este período" />
                )}

                {!loading && error === "server" && (
                  <EmptyState
                    icon="⚠️"
                    text="Error al cargar los turnos. Intentá nuevamente."
                    onRetry={handleRetry}
                  />
                )}

                {!error && (
                  <div style={{ padding: "18px" }}>
                    {viewMode === "week" ? (
                      weekData ? (
                        <CustomWeekGrid
                          data={weekData}
                          onSelectEvent={handleSlotClick}
                        />
                      ) : !loading ? (
                        <EmptyState icon="📅" text="No hay datos para esta semana" />
                      ) : null
                    ) : monthData ? (
                      <CustomMonthGrid data={monthData} />
                    ) : !loading ? (
                      <EmptyState icon="📆" text="No hay datos para este mes" />
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </CalendarErrorBoundary>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 14,
              paddingLeft: 2,
            }}
          >
            {viewMode === "week" ? (
              <>
                <LegendDot color={C.slotFree} label="Turno libre" />
                <LegendDot color={C.slotPast} label="Horario pasado" />
                <LegendDot
                  color={C.slotOccupiedBg}
                  label="Turno ocupado"
                  borderColor={C.slotOccupiedBorder}
                />
              </>
            ) : (
              <>
                <LegendDot color={C.slotFree} label="Disponible" />
                <LegendDot color={C.amber} label="Baja disponibilidad" />
                <LegendDot color={C.errorRed} label="Sin disponibilidad" />
              </>
            )}
          </div>
        </>
      )}

      {/* Estado "ninguna agenda seleccionada" — centrado real en ambos ejes */}
      {!selectedId && !agendaLoad && agendas.length > 0 && (
        <div
          style={{
            background: C.cardBg,
            border: `1.5px dashed ${C.border}`,
            borderRadius: 12,
            maxWidth: 460,
            minHeight: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <EmptyState
            icon="🗓"
            text="Ninguna agenda seleccionada"
            subtitle="Elegí una agenda en el selector de arriba para consultar la disponibilidad semanal o mensual."
            compact
          />
        </div>
      )}
    </div>
  );
}

function LegendDot({
  color,
  label,
  borderColor,
}: {
  color: string;
  label: string;
  borderColor?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: color,
          borderLeft: borderColor ? `3px solid ${borderColor}` : undefined,
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
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// HELPERS — SelectedSlotContext persistente
// ════════════════════════════════════════════════════════════════
export const getSelectedSlotContext = (): SelectedSlotContext | null => {
  const raw = localStorage.getItem("selectedSlotContext");
  return raw ? JSON.parse(raw) : null;
};

export const clearSelectedSlotContext = (): void => {
  localStorage.removeItem("selectedSlotContext");
};