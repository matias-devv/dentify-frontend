import { useState, useEffect } from "react";
import apiClient from "../../api/apiClient";

// ════════════════════════════════════════════════════════════════
//  DESIGN TOKENS — única fuente de verdad de colores y tipografía
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
  sidebarBg:     "#FFFFFF",
  sidebarBorder: "#E4E6EC",
  activeItemBg:  "#EFF6FF",
  activeText:    "#2563EB",
  navText:       "#374151",
  navTextHover:  "#111827",
};

const FONT_SANS  = "'DM Sans', sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════
const formatCurrency = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const getSaludo = (h) =>
  h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";

/**
 * Extrae HH:mm de un string ISO LocalDateTime (ej: "2026-03-12T14:30:00").
 */
const extractTime = (isoString) =>
  new Date(isoString).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const buildInitials = (name, surname) => {
  const a = name?.[0]?.toUpperCase() ?? "";
  const b = surname?.[0]?.toUpperCase() ?? "";
  return a + b || "—";
};

// ════════════════════════════════════════════════════════════════
//  BADGE MAPS
// ════════════════════════════════════════════════════════════════
const APPOINTMENT_BADGE = {
  SCHEDULED:    { label: "Programado",  bg: "#F0F1F5", color: "#5A6070" },
  CONFIRMED:    { label: "Confirmado",  bg: "#F0F4FF", color: "#3B4FBA" },
  ADMITTED:     { label: "Admitido",    bg: "#1A2B4A", color: "#FFFFFF" },
  IN_ATTENTION: { label: "En atención", bg: "#2563EB", color: "#FFFFFF" },
  COMPLETED:    { label: "Completado",  bg: "#ECFDF5", color: "#065F46" },
  NO_SHOW:      { label: "Ausente",     bg: "#FEF2F2", color: "#991B1B" },
  CANCELLED:    { label: "Cancelado",   bg: "#F9FAFB", color: "#9CA3AF" },
};

const PAYMENT_BADGE = {
  PENDING:          { label: "Pendiente",       bg: "#FFFBEB", color: "#92400E" },
  AWAITING_PAYMENT: { label: "Aguardando pago", bg: "#FFF7ED", color: "#9A3412" },
  PARTIAL:          { label: "Pago parcial",    bg: "#EFF6FF", color: "#1D4ED8" },
  PAID:             { label: "Pagado",          bg: "#ECFDF5", color: "#065F46" },
  FAILED:           { label: "Fallido",         bg: "#FEF2F2", color: "#991B1B" },
  CANCELLED:        { label: "Cancelado",       bg: "#F9FAFB", color: "#9CA3AF" },
  EXPIRED:          { label: "Expirado",        bg: "#FEF2F2", color: "#991B1B" },
};

/**
 * Color del punto indicador por DashboardAlertType.
 * Backend emite: PAYMENT_PENDING | PARTIAL_PAYMENT | TREATMENT_ABANDONED | NO_SHOW_REGISTERED
 */
const ALERT_DOT_COLOR = {
  PAYMENT_PENDING:     "#F59E0B",
  PARTIAL_PAYMENT:     "#2563EB",
  TREATMENT_ABANDONED: "#EF4444",
  NO_SHOW_REGISTERED:  "#9CA3AF",
};

// ════════════════════════════════════════════════════════════════
//  ICONOS SVG
// ════════════════════════════════════════════════════════════════
const Icon = {
  home: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M7 18v-7h6v7"/>
    </svg>
  ),
  clinical: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="14" height="16" rx="1.5"/>
      <path d="M7 7h6M7 10.5h6M7 14h4"/>
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3.5" width="15" height="14" rx="1.5"/>
      <path d="M6.5 2v3M13.5 2v3M2.5 8h15"/>
    </svg>
  ),
  patient: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="6.5" r="3"/>
      <path d="M3 17.5c0-3.314 3.134-6 7-6s7 2.686 7 6"/>
    </svg>
  ),
  agenda: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5"/>
      <path d="M10 6v4l2.5 2.5"/>
    </svg>
  ),
  finance: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5"/>
      <path d="M2.5 8.5h15M7 12h.5M10 12h.5M13 12h.5"/>
    </svg>
  ),
  chevronDown: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5l3 3 3-3"/>
    </svg>
  ),
  chevronRight: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 3l3 3-3 3"/>
    </svg>
  ),
  help: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5"/>
      <path d="M7.5 7.5a2.5 2.5 0 015 .833c0 1.667-2.5 2.5-2.5 2.5M10 14v.5"/>
    </svg>
  ),
  menu: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M3 5h14M3 10h14M3 15h14"/>
    </svg>
  ),
};

// ════════════════════════════════════════════════════════════════
//  NAV CONFIG
// ════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { id: "home",     label: "Inicio",          icon: Icon.home,     section: "home" },
  {
    id: "clinical", label: "Historia Clínica", icon: Icon.clinical, section: "clinical",
    children: [
      { id: "clinical-list",   label: "Pacientes" },
      { id: "clinical-detail", label: "Historial" },
    ],
  },
  {
    id: "turnos",   label: "Turnos",           icon: Icon.calendar, section: "turnos",
    children: [
      { id: "turnos-otorgar",  label: "Otorgar turno" },
      { id: "turnos-admision", label: "Admisión"      },
    ],
  },
  { id: "pacientes", label: "Pacientes",       icon: Icon.patient,  section: "pacientes" },
  {
    id: "agendas",  label: "Agendas",          icon: Icon.agenda,   section: "agendas",
    children: [
      { id: "agendas-list",   label: "Mis agendas"  },
      { id: "agendas-create", label: "Nueva agenda" },
    ],
  },
  {
    id: "finanzas", label: "Finanzas",         icon: Icon.finance,  section: "finanzas",
    children: [
      { id: "finanzas-resumen",      label: "Resumen"      },
      { id: "finanzas-pagos",        label: "Pagos"        },
      { id: "finanzas-tratamientos", label: "Tratamientos" },
    ],
  },
];

// ════════════════════════════════════════════════════════════════
//  SHARED SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════
function Badge({ status, map }) {
  const cfg = map[status] || { label: status, bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.03em",
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

function MetricCard({ label, value, sub, accent = false }) {
  return (
    <div style={{
      background: accent ? C.navy : C.cardBg,
      border: `1px solid ${accent ? "transparent" : C.border}`,
      borderRadius: 10,
      padding: "22px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      flex: 1,
      minWidth: 0,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: accent ? "rgba(255,255,255,0.55)" : C.textMuted, fontFamily: FONT_SANS }}>
        {label}
      </span>
      <span style={{ fontSize: 26, fontWeight: 700, color: accent ? "#FFFFFF" : C.textPrimary, fontFamily: FONT_SANS, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 11, color: accent ? "rgba(255,255,255,0.4)" : C.textMuted, fontFamily: FONT_SANS }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function EmptyState({ text, positive = false }) {
  return (
    <div style={{ padding: "32px 0", textAlign: "center", color: positive ? "#065F46" : C.textMuted, fontSize: 13, fontFamily: FONT_SANS, letterSpacing: "0.01em" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: positive ? "#ECFDF5" : "#F4F5F7", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          {positive
            ? <path d="M3 8l3.5 3.5L13 4" stroke="#065F46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            : <path d="M8 5v4M8 11v.5" stroke={C.textMuted} strokeWidth="1.6" strokeLinecap="round"/>
          }
        </svg>
      </div>
      {text}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border }} />;
}

// ════════════════════════════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════════════════════════════
function Sidebar({ activeSection, onNavigate, collapsed, onToggleCollapse }) {
  const [openGroups, setOpenGroups] = useState({ turnos: true });

  const toggleGroup = (id) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const isActive = (item) =>
    activeSection === item.id ||
    (item.children && item.children.some((c) => c.id === activeSection));

  const SIDEBAR_W = collapsed ? 64 : 220;

  return (
    <div style={{
      width: SIDEBAR_W,
      minWidth: SIDEBAR_W,
      height: "100vh",
      background: C.sidebarBg,
      borderRight: `1px solid ${C.sidebarBorder}`,
      display: "flex",
      flexDirection: "column",
      position: "sticky",
      top: 0,
      transition: "width 0.2s ease",
      overflow: "hidden",
      zIndex: 10,
    }}>

      {/* ── Logo + toggle ── */}
      <div style={{
        height: 60,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        borderBottom: `1px solid ${C.sidebarBorder}`,
        gap: 12,
        justifyContent: collapsed ? "center" : "space-between",
      }}>
        {!collapsed && (
          <span style={{ fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 500, color: C.navy, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
            den<span style={{ color: C.electric }}>tify</span>
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.textSecondary, display: "flex", alignItems: "center", padding: 4, borderRadius: 4, transition: "color 0.15s" }}
          onMouseEnter={(e) => e.currentTarget.style.color = C.navy}
          onMouseLeave={(e) => e.currentTarget.style.color = C.textSecondary}
        >
          {Icon.menu}
        </button>
      </div>

      {/* ── Nav items ── */}
      <nav style={{ flex: 1, padding: collapsed ? "12px 8px" : "12px 12px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_ITEMS.map((item) => {
          const active      = isActive(item);
          const hasChildren = item.children && !collapsed;
          const isOpen      = openGroups[item.id];

          return (
            <div key={item.id} style={{ marginBottom: 2 }}>
              <button
                onClick={() => hasChildren ? toggleGroup(item.id) : onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: collapsed ? "9px" : "9px 10px",
                  borderRadius: 7,
                  background: active && !hasChildren ? C.activeItemBg : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: active ? C.activeText : C.navText,
                  fontFamily: FONT_SANS,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  textAlign: "left",
                  transition: "background 0.12s, color 0.12s",
                  justifyContent: collapsed ? "center" : "flex-start",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!active || hasChildren) {
                    e.currentTarget.style.background = "#F8F9FB";
                    e.currentTarget.style.color = C.navTextHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active || hasChildren) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = active ? C.activeText : C.navText;
                  }
                }}
              >
                {active && !hasChildren && (
                  <span style={{ position: "absolute", left: 0, top: "20%", height: "60%", width: 3, borderRadius: "0 2px 2px 0", background: C.electric }} />
                )}
                <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <>
                    <span style={{ flex: 1, whiteSpace: "nowrap" }}>{item.label}</span>
                    {hasChildren && (
                      <span style={{ color: C.textMuted, display: "flex", alignItems: "center" }}>
                        {isOpen ? Icon.chevronDown : Icon.chevronRight}
                      </span>
                    )}
                  </>
                )}
              </button>

              {hasChildren && isOpen && (
                <div style={{ marginTop: 2, paddingLeft: 14 }}>
                  {item.children.map((child) => {
                    const childActive = activeSection === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => onNavigate(child.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "7px 10px 7px 16px",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          background: childActive ? C.activeItemBg : "transparent",
                          color: childActive ? C.activeText : C.textSecondary,
                          fontFamily: FONT_SANS,
                          fontSize: 12.5,
                          fontWeight: childActive ? 600 : 400,
                          textAlign: "left",
                          transition: "background 0.12s, color 0.12s",
                          position: "relative",
                        }}
                        onMouseEnter={(e) => {
                          if (!childActive) {
                            e.currentTarget.style.background = "#F8F9FB";
                            e.currentTarget.style.color = C.navTextHover;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!childActive) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = C.textSecondary;
                          }
                        }}
                      >
                        {childActive && (
                          <span style={{ position: "absolute", left: 0, top: "20%", height: "60%", width: 2, borderRadius: "0 2px 2px 0", background: C.electric }} />
                        )}
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: childActive ? C.electric : C.textMuted, flexShrink: 0, marginLeft: 2 }} />
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Footer: Ayuda ── */}
      <div style={{ padding: collapsed ? "12px 8px" : "12px 12px", borderTop: `1px solid ${C.sidebarBorder}` }}>
        <button
          title={collapsed ? "Ayuda" : undefined}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: collapsed ? "9px" : "9px 10px",
            borderRadius: 7,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: C.textSecondary,
            fontFamily: FONT_SANS,
            fontSize: 12.5,
            fontWeight: 400,
            justifyContent: collapsed ? "center" : "flex-start",
            transition: "color 0.12s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = C.navy}
          onMouseLeave={(e) => e.currentTarget.style.color = C.textSecondary}
        >
          <span style={{ display: "flex", alignItems: "center" }}>{Icon.help}</span>
          {!collapsed && <span>Ayuda</span>}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  TOP BAR
// ════════════════════════════════════════════════════════════════
function TopBar({ activeSection, userProfile }) {
  const label = (() => {
    for (const item of NAV_ITEMS) {
      if (item.id === activeSection) return item.label;
      if (item.children) {
        const child = item.children.find((c) => c.id === activeSection);
        if (child) return child.label;
      }
    }
    return "Inicio";
  })();

  const displayName   = userProfile ? `Dr. ${userProfile.name} ${userProfile.surname}` : "—";
  const displayClinic = userProfile ? userProfile.clinicName : "";
  const initials      = userProfile ? buildInitials(userProfile.name, userProfile.surname) : null;

  return (
    <div style={{
      height: 60,
      background: C.cardBg,
      borderBottom: `1px solid ${C.sidebarBorder}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 32px",
      position: "sticky",
      top: 0,
      zIndex: 9,
    }}>
      <span style={{ fontFamily: FONT_SANS, fontSize: 13.5, fontWeight: 500, color: C.textSecondary }}>
        {label}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: FONT_SANS, fontSize: 12.5, fontWeight: 600, color: C.textPrimary, lineHeight: 1.2 }}>
            {displayName}
          </p>
          <p style={{ fontFamily: FONT_SANS, fontSize: 10.5, color: C.textMuted, marginTop: 1 }}>
            {displayClinic}
          </p>
        </div>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: initials ? C.electric : C.border,
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_SANS,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
          flexShrink: 0,
          transition: "background 0.2s",
        }}>
          {initials}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  DASHBOARD HOME
// ════════════════════════════════════════════════════════════════
function DashboardHome({ userProfile }) {
  const [now, setNow] = useState(new Date());

  // ── Estado por sección — errores independientes entre sí ──────
  const [summary,   setSummary]   = useState(null);
  const [proximos,  setProximos]  = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [alertas,   setAlerts]    = useState([]);

  const [phase1Loading, setPhase1Loading] = useState(true);
  const [summaryError,  setSummaryError]  = useState(false);
  const [appoError,     setAppoError]     = useState(false);
  const [paymentsError, setPaymentsError] = useState(false);
  // Las alertas no bloquean el render — tienen su propio flag silencioso
  const [alertsLoaded,  setAlertsLoaded]  = useState(false);

  // Reloj
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // ── FASE 1 — Crítica: bloquea el render del contenido ─────────
  //
  // GET /api/dashboard/summary   → DashboardSummary
  //     { dailyIncome, monthlyIncome, appointmentsToday, nextAppointment? }
  //     nextAppointment: { date (ISO LocalDateTime), patient_name, patient_surname }
  //
  // GET /api/appointments/today  → List<AppointmentTodayResponse>
  //     { id, hora, patient_name, patient_surname, patient_id,
  //       cobertura, estado (AppointmentStatus), attendanceConfirmed, serviceName }
  //
  // GET /api/payments/today      → List<PaymentTodayResponse>
  //     { id, patient_name, patient_surname, patient_id, hora,
  //       monto, medio_pago (PaymentMethod), pago_estado (PaymentStatus),
  //       serviceName, appointment_id, hasComprobante }
  useEffect(() => {
    Promise.allSettled([
      apiClient.get("/api/dashboard/summary"),
      apiClient.get("/api/appointments/today"),
      apiClient.get("/api/payments/today"),
    ]).then(([summaryRes, appoRes, paymentsRes]) => {
      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value.data);
      } else {
        setSummaryError(true);
      }

      if (appoRes.status === "fulfilled") {
        setProximos(appoRes.value.data);
      } else {
        setAppoError(true);
      }

      if (paymentsRes.status === "fulfilled") {
        setPayments(paymentsRes.value.data);
      } else {
        setPaymentsError(true);
      }
    }).finally(() => {
      setPhase1Loading(false);
    });
  }, []);

  // ── FASE 2 — Diferida: no bloquea, carga en background ────────
  //
  // GET /api/dashboard/alerts/today → List<DashboardAlert>
  //     { type (DashboardAlertType), reference_id, patient_name,
  //       patient_surname, time, message }
  //     DashboardAlertType: PAYMENT_PENDING | PARTIAL_PAYMENT |
  //                         TREATMENT_ABANDONED | NO_SHOW_REGISTERED
  //
  // Se ejecuta solo cuando Fase 1 terminó. Si falla, el dashboard
  // sigue siendo funcional — la sección de alertas simplemente
  // no muestra datos.
  useEffect(() => {
    if (phase1Loading) return;

    apiClient
      .get("/api/dashboard/alerts/today")
      .then((res) => setAlerts(res.data))
      .catch(() => {
        // Silencioso — las alertas son secundarias y no rompen la vista
      })
      .finally(() => setAlertsLoaded(true));
  }, [phase1Loading]);

  if (phase1Loading) {
    return (
      <div style={{ minHeight: "100%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textMuted }}>Cargando...</span>
      </div>
    );
  }

  // ── Derivados de summary ──
  const hayTurnosHoy = proximos.length > 0;

  // Compara horas directamente desde el string ISO — evita bugs de timezone
  // con LocalDateTime de Java (sin offset: "2026-04-08T09:00:00")
  const isApptStillAhead = (dateStr) => {
    if (!dateStr) return false;
    const timePart = dateStr.includes("T") ? dateStr.split("T")[1] : dateStr;
    const [apptH, apptM] = timePart.split(":").map(Number);
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    return apptH > nowH || (apptH === nowH && apptM > nowM);
  };

  const hayProximoVigente =
    !!summary?.nextAppointment &&
    isApptStillAhead(summary.nextAppointment.date);

  const horaProximo = hayProximoVigente
    ? extractTime(summary.nextAppointment.date)
    : hayTurnosHoy
      ? "—"
      : null;

  const subProximo = hayProximoVigente
    ? `${summary.nextAppointment.patient_name} ${summary.nextAppointment.patient_surname}`
    : hayTurnosHoy
      ? "Todos los turnos finalizaron"
      : "Sin turnos para hoy";

  // ── Derivados de userProfile ──
  const nombreDoctor = userProfile ? `Dr. ${userProfile.name} ${userProfile.surname}` : "—";
  const clinicaLabel = userProfile ? userProfile.clinicName.toUpperCase() : "";

  // ── Fecha / hora ──
  const hora            = now.getHours();
  const saludo          = getSaludo(hora);
  const fechaFormateada = now
    .toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());
  const horaFormateada  = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div style={{ minHeight: "100%", background: C.bg, padding: "32px 36px" }}>

      {/* 1. HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 28, fontWeight: 400, color: C.textPrimary, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            {saludo},{" "}
            <span style={{ fontWeight: 500 }}>{nombreDoctor}</span>
          </h1>
          <p style={{ marginTop: 6, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textMuted, fontFamily: FONT_SANS }}>
            {clinicaLabel}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {horaFormateada}
          </p>
          <p style={{ marginTop: 5, fontSize: 11.5, color: C.textSecondary, fontFamily: FONT_SANS, textTransform: "capitalize" }}>
            {fechaFormateada}
          </p>
        </div>
      </div>

      {/* 2. MÉTRICAS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <MetricCard
          label="Ingresos del día"
          value={summaryError ? "—" : formatCurrency(summary?.dailyIncome ?? 0)}
          sub="Pagos confirmados hoy"
        />
        <MetricCard
          label="Ingresos del mes"
          value={summaryError ? "—" : formatCurrency(summary?.monthlyIncome ?? 0)}
          sub={`${now.toLocaleDateString("es-AR", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())} ${now.getFullYear()}`}
        />
        <MetricCard
          label="Turnos hoy"
          value={summaryError ? "—" : (summary?.appointmentsToday ?? 0)}
          sub="Agendados para hoy"
        />
        <MetricCard
          label="Próximo turno"
          value={horaProximo ?? "—"}
          sub={subProximo}
          accent
        />
      </div>

      {/* 3. COLUMNAS */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* IZQUIERDA — Próximos turnos */}
        <div style={{ flex: "0 0 60%", background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px 14px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS }}>Próximos turnos</span>
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT_SANS }}>Siguientes atenciones del día</span>
            </div>
          </div>
          <Divider />
          <div style={{ display: "flex", gap: 16, padding: "8px 28px", background: "#FAFBFC" }}>
            {["Hora", "Paciente", "Estado", ""].map((h, i) => (
              <span
                key={i}
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: C.textMuted,
                  fontFamily: FONT_SANS,
                  flex: i === 1 ? 1 : i === 0 ? "0 0 52px" : "0 0 auto",
                  minWidth: i === 3 ? 64 : "auto",
                  textAlign: i === 3 ? "right" : "left",
                }}
              >
                {h}
              </span>
            ))}
          </div>
          <Divider />
          <div style={{ padding: "4px 20px 8px" }}>
            {appoError ? (
              <EmptyState text="Error al cargar los turnos" />
            ) : proximos.length === 0 ? (
              <EmptyState text="Sin turnos pendientes para hoy" />
            ) : (
              proximos.map((t, idx) => (
                <div key={t.id}>
                  <div className="turn-row">
                    <span style={{ flex: "0 0 52px", fontSize: 14, fontWeight: 600, color: C.electric, fontFamily: FONT_SANS, letterSpacing: "0.01em" }}>
                      {t.hora}
                    </span>
                    {/* patient_surname, patient_name — AppointmentTodayResponse */}
                    <span style={{ flex: 1, fontSize: 13.5, color: C.textPrimary, fontFamily: FONT_SANS, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.patient_surname}, {t.patient_name}
                    </span>
                    {/* estado → AppointmentStatus */}
                    <Badge status={t.estado} map={APPOINTMENT_BADGE} />
                    <button className="ver-btn">
                      Ver
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                  {idx < proximos.length - 1 && <div style={{ height: 1, background: "#F3F4F6" }} />}
                </div>
              ))
            )}
          </div>
          {!appoError && proximos.length > 0 && (
            <>
              <Divider />
              <div style={{ padding: "12px 24px" }}>
                <button className="ver-btn" style={{ marginLeft: 0, color: C.textSecondary }}>
                  Ver agenda completa →
                </button>
              </div>
            </>
          )}
        </div>

        {/* DERECHA — Alertas del día
            DashboardAlert: { type, reference_id, patient_name, patient_surname, time, message }
            type → PAYMENT_PENDING | PARTIAL_PAYMENT | TREATMENT_ABANDONED | NO_SHOW_REGISTERED
            NOTA: el campo del backend es "time", no "hora" */}
        <div style={{ flex: 1, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS }}>Alertas del día</span>
              {alertas.length > 0 && (
                <span style={{ background: "#FEE2E2", color: "#B91C1C", fontSize: 10.5, fontWeight: 700, borderRadius: 100, padding: "1px 8px", letterSpacing: "0.02em" }}>
                  {alertas.length}
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textMuted, fontFamily: FONT_SANS }}>
              Sin cobro confirmado
            </span>
          </div>
          <Divider />
          <div style={{ padding: "4px 16px 8px" }}>
            {!alertsLoaded ? (
              // Fase 2 aún cargando — no bloquea la columna entera
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <span style={{ fontSize: 12, color: C.textMuted, fontFamily: FONT_SANS }}>Cargando alertas...</span>
              </div>
            ) : alertas.length === 0 ? (
              <EmptyState text="Sin cobros pendientes hoy" positive />
            ) : (
              alertas.map((a, idx) => (
                // KEY: reference_id identifica el pago o turno referenciado
                <div key={`${a.type}-${a.reference_id}`}>
                  <div className="alerta-row">
                    {/* Punto coloreado por DashboardAlertType */}
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: ALERT_DOT_COLOR[a.type] ?? C.textMuted,
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, fontFamily: FONT_SANS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.patient_surname}, {a.patient_name}
                      </p>
                      {/* "time" es el campo del record DashboardAlert del backend */}
                      <p style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT_SANS, marginTop: 1 }}>
                        {a.time} · {a.message}
                      </p>
                    </div>
                  </div>
                  {idx < alertas.length - 1 && <div style={{ height: 1, background: "#F3F4F6" }} />}
                </div>
              ))
            )}
          </div>
          {alertsLoaded && alertas.length > 0 && (
            <>
              <Divider />
              <div style={{ padding: "12px 24px" }}>
                <button className="ver-btn" style={{ marginLeft: 0, color: C.textSecondary }}>
                  Ver en Finanzas → Pagos →
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  DASHBOARD LAYOUT
// ════════════════════════════════════════════════════════════════
function DashboardLayout({ children, activeSection, onNavigate, collapsed, onToggleCollapse, userProfile }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar
        activeSection={activeSection}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar activeSection={activeSection} userProfile={userProfile} />
        <main style={{ flex: 1, overflowY: "auto", background: C.bg }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("home");
  const [collapsed, setCollapsed]         = useState(false);
  const [userProfile, setUserProfile]     = useState(null);

  // GET /api/users/me → UserProfileResponse
  // { id, name, surname, clinicName, clinicId, dni, phone_number, roles }
  useEffect(() => {
    apiClient
      .get("/api/users/me")
      .then((res) => setUserProfile(res.data))
      .catch(() => {
        // No bloqueante — TopBar y header muestran "—"
      });
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { font-family: ${FONT_SANS}; -webkit-font-smoothing: antialiased; }
        nav::-webkit-scrollbar { width: 4px; }
        nav::-webkit-scrollbar-track { background: transparent; }
        nav::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }

        .turn-row {
          display: flex; align-items: center; gap: 16px;
          padding: 13px 4px; cursor: default;
          transition: background 0.15s; border-radius: 6px;
        }
        .turn-row:hover { background: #F8F9FB; }

        .alerta-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 4px; cursor: pointer;
          border-radius: 6px; transition: background 0.15s;
        }
        .alerta-row:hover { background: #FFF8F0; }

        .ver-btn {
          margin-left: auto; display: flex; align-items: center; gap: 4px;
          color: ${C.electric}; font-size: 11.5px; font-weight: 600;
          font-family: ${FONT_SANS}; letter-spacing: 0.02em;
          background: none; border: none; cursor: pointer;
          padding: 4px 8px; border-radius: 4px; transition: background 0.15s; white-space: nowrap;
        }
        .ver-btn:hover { background: #EFF6FF; }
      `}</style>

      <DashboardLayout
        activeSection={activeSection}
        onNavigate={setActiveSection}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        userProfile={userProfile}
      >
        {activeSection === "home" && (
          <DashboardHome userProfile={userProfile} />
        )}
        {activeSection !== "home" && (
          <div style={{ padding: "48px 36px", color: C.textMuted, fontFamily: FONT_SANS, fontSize: 13 }}>
            Vista <strong style={{ color: C.textPrimary }}>{activeSection}</strong> — pendiente de implementación.
          </div>
        )}
      </DashboardLayout>
    </>
  );
}