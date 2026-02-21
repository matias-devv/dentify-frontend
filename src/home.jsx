import { useState, useEffect } from "react";

export default function Home() {
  return (
    <div>
      <h1>Mi Home</h1>
    </div>
  );
}

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
  // sidebar específicos
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
//  MOCK DATA
// ════════════════════════════════════════════════════════════════
const MOCK_SUMMARY  = { ingresos_dia: 47500, ingresos_mes: 312800, turnos_hoy: 11, proximo_turno: "14:30" };
const MOCK_PROXIMOS = [
  { id: 1, hora: "14:30", apellido: "Rodríguez",  nombre: "Valentina", estado: "SCHEDULED"   },
  { id: 2, hora: "15:00", apellido: "Fernández",  nombre: "Carlos",    estado: "ADMITTED"    },
  { id: 3, hora: "15:30", apellido: "Gómez",      nombre: "Sofía",     estado: "SCHEDULED"   },
  { id: 4, hora: "16:00", apellido: "Martínez",   nombre: "Diego",     estado: "IN_ATTENTION"},
];
const MOCK_ALERTAS = [
  { id: 1, apellido: "Peralta", nombre: "Lucía",   hora: "10:00", pago_estado: "PENDING"          },
  { id: 2, apellido: "Torres",  nombre: "Esteban", hora: "11:30", pago_estado: "AWAITING_PAYMENT" },
  { id: 3, apellido: "Vidal",   nombre: "Romina",  hora: "13:00", pago_estado: "PARTIAL"          },
];
const MOCK_USER = { nombre: "Dr. Marcos González", clinica: "CLÍNICA NEXUP ODONTOLOGÍA", initials: "MG" };

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════
const formatCurrency = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const getSaludo = (h) => h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";

const APPOINTMENT_BADGE = {
  SCHEDULED:    { label: "Programado",  bg: "#F0F1F5", color: "#5A6070" },
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
  PAID:             { label: "Pagado",           bg: "#ECFDF5", color: "#065F46" },
  FAILED:           { label: "Fallido",          bg: "#FEF2F2", color: "#991B1B" },
  CANCELLED:        { label: "Cancelado",        bg: "#F9FAFB", color: "#9CA3AF" },
  EXPIRED:          { label: "Expirado",         bg: "#FEF2F2", color: "#991B1B" },
};

// ════════════════════════════════════════════════════════════════
//  ICONOS SVG — minimalistas lineales, sin relleno
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
  arrowRight: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6h7M6.5 3l3 3-3 3"/>
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
      { id: "clinical-list",   label: "Pacientes"   },
      { id: "clinical-detail", label: "Historial"   },
    ],
  },
  {
    id: "turnos",   label: "Turnos",           icon: Icon.calendar, section: "turnos",
    children: [
      { id: "turnos-otorgar", label: "Otorgar turno" },
      { id: "turnos-admision",label: "Admisión"      },
    ],
  },
  { id: "pacientes",label: "Pacientes",        icon: Icon.patient,  section: "pacientes" },
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
      { id: "finanzas-resumen",     label: "Resumen"     },
      { id: "finanzas-pagos",       label: "Pagos"       },
      { id: "finanzas-tratamientos",label: "Tratamientos"},
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

  const toggleGroup = (id) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
        padding: collapsed ? "0 20px" : "0 20px",
        borderBottom: `1px solid ${C.sidebarBorder}`,
        gap: 12,
        justifyContent: collapsed ? "center" : "space-between",
      }}>
        {!collapsed && (
          <span style={{
            fontFamily: FONT_SERIF,
            fontSize: 17,
            fontWeight: 500,
            color: C.navy,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}>
            nex<span style={{ color: C.electric }}>up</span>
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: C.textSecondary,
            display: "flex",
            alignItems: "center",
            padding: 4,
            borderRadius: 4,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = C.navy}
          onMouseLeave={(e) => e.currentTarget.style.color = C.textSecondary}
        >
          {Icon.menu}
        </button>
      </div>

      {/* ── Nav items ── */}
      <nav style={{ flex: 1, padding: collapsed ? "12px 8px" : "12px 12px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_ITEMS.map((item) => {
          const active    = isActive(item);
          const hasChildren = item.children && !collapsed;
          const isOpen    = openGroups[item.id];

          return (
            <div key={item.id} style={{ marginBottom: 2 }}>
              {/* Main nav item */}
              <button
                onClick={() => {
                  if (hasChildren) {
                    toggleGroup(item.id);
                  } else {
                    onNavigate(item.id);
                  }
                }}
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
                {/* Active indicator bar */}
                {active && !hasChildren && (
                  <span style={{
                    position: "absolute",
                    left: 0,
                    top: "20%",
                    height: "60%",
                    width: 3,
                    borderRadius: "0 2px 2px 0",
                    background: C.electric,
                  }} />
                )}

                <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  {item.icon}
                </span>

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

              {/* Sub-items */}
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
                          <span style={{
                            position: "absolute",
                            left: 0,
                            top: "20%",
                            height: "60%",
                            width: 2,
                            borderRadius: "0 2px 2px 0",
                            background: C.electric,
                          }} />
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
      <div style={{
        padding: collapsed ? "12px 8px" : "12px 12px",
        borderTop: `1px solid ${C.sidebarBorder}`,
      }}>
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
function TopBar({ activeSection }) {
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

      {/* User pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: FONT_SANS, fontSize: 12.5, fontWeight: 600, color: C.textPrimary, lineHeight: 1.2 }}>
            {MOCK_USER.nombre}
          </p>
          <p style={{ fontFamily: FONT_SANS, fontSize: 10.5, color: C.textMuted, marginTop: 1 }}>
            Demo Odontología
          </p>
        </div>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: C.electric,
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_SANS,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
          flexShrink: 0,
        }}>
          {MOCK_USER.initials}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  DASHBOARD HOME — intacto, sin modificaciones internas
// ════════════════════════════════════════════════════════════════
function DashboardHome() {
  const [now, setNow]         = useState(new Date());
  const [data]                = useState(MOCK_SUMMARY);
  const [proximos]            = useState(MOCK_PROXIMOS);
  const [alertas]             = useState(MOCK_ALERTAS);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const hora            = now.getHours();
  const saludo          = getSaludo(hora);
  const fechaFormateada = now.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" }).replace(/^\w/, (c) => c.toUpperCase());
  const horaFormateada  = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div style={{ minHeight: "100%", background: C.bg, padding: "32px 36px" }}>

      {/* 1. HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 28, fontWeight: 400, color: C.textPrimary, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            {saludo},{" "}
            <span style={{ fontWeight: 500 }}>{MOCK_USER.nombre}</span>
          </h1>
          <p style={{ marginTop: 6, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textMuted, fontFamily: FONT_SANS }}>
            {MOCK_USER.clinica}
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
        <MetricCard label="Ingresos del día"  value={formatCurrency(data.ingresos_dia)}  sub="Pagos confirmados hoy" />
        <MetricCard label="Ingresos del mes"  value={formatCurrency(data.ingresos_mes)}  sub={`${now.toLocaleDateString("es-AR", { month: "long" }).replace(/^\w/, c => c.toUpperCase())} ${now.getFullYear()}`} />
        <MetricCard label="Turnos hoy"        value={data.turnos_hoy}                    sub="Agendados para hoy" />
        <MetricCard label="Próximo turno"     value={data.proximo_turno ?? "—"}          sub={data.proximo_turno ? "Próxima atención" : "Sin turnos pendientes"} accent />
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
              <span key={i} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textMuted, fontFamily: FONT_SANS, flex: i === 1 ? 1 : i === 0 ? "0 0 52px" : "0 0 auto", minWidth: i === 3 ? 64 : "auto", textAlign: i === 3 ? "right" : "left" }}>
                {h}
              </span>
            ))}
          </div>
          <Divider />
          <div style={{ padding: "4px 20px 8px" }}>
            {proximos.length === 0 ? (
              <EmptyState text="Sin turnos pendientes para hoy" />
            ) : (
              proximos.map((t, idx) => (
                <div key={t.id}>
                  <div className="turn-row">
                    <span style={{ flex: "0 0 52px", fontSize: 14, fontWeight: 600, color: C.electric, fontFamily: FONT_SANS, letterSpacing: "0.01em" }}>
                      {t.hora}
                    </span>
                    <span style={{ flex: 1, fontSize: 13.5, color: C.textPrimary, fontFamily: FONT_SANS, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.apellido}, {t.nombre}
                    </span>
                    <Badge status={t.estado} map={APPOINTMENT_BADGE} />
                    <button className="ver-btn">
                      Ver
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                  {idx < proximos.length - 1 && <div style={{ height: 1, background: "#F3F4F6" }} />}
                </div>
              ))
            )}
          </div>
          {proximos.length > 0 && (
            <>
              <Divider />
              <div style={{ padding: "12px 24px" }}>
                <button className="ver-btn" style={{ marginLeft: 0, color: C.textSecondary }}>Ver agenda completa →</button>
              </div>
            </>
          )}
        </div>

        {/* DERECHA — Alertas */}
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
            {alertas.length === 0 ? (
              <EmptyState text="Sin cobros pendientes hoy" positive />
            ) : (
              alertas.map((a, idx) => (
                <div key={a.id}>
                  <div className="alerta-row">
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.pago_estado === "PARTIAL" ? C.electric : "#F59E0B", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, fontFamily: FONT_SANS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.apellido}, {a.nombre}
                      </p>
                      <p style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT_SANS, marginTop: 1 }}>Turno · {a.hora}</p>
                    </div>
                    <Badge status={a.pago_estado} map={PAYMENT_BADGE} />
                  </div>
                  {idx < alertas.length - 1 && <div style={{ height: 1, background: "#F3F4F6" }} />}
                </div>
              ))
            )}
          </div>
          {alertas.length > 0 && (
            <>
              <Divider />
              <div style={{ padding: "12px 24px" }}>
                <button className="ver-btn" style={{ marginLeft: 0, color: C.textSecondary }}>Ver en Finanzas → Pagos →</button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  DASHBOARD LAYOUT — orquesta Sidebar + TopBar + contenido
// ════════════════════════════════════════════════════════════════
function DashboardLayout({ children, activeSection, onNavigate, collapsed, onToggleCollapse }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar
        activeSection={activeSection}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar activeSection={activeSection} />
        <main style={{ flex: 1, overflowY: "auto", background: C.bg }}>
          {children}
        </main>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  APP ROOT
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [activeSection, setActiveSection] = useState("home");
  const [collapsed, setCollapsed]         = useState(false);

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
      >
        {/* Aquí se renderiza la vista activa según routing */}
        {activeSection === "home" && <DashboardHome />}
        {activeSection !== "home" && (
          <div style={{ padding: "48px 36px", color: C.textMuted, fontFamily: FONT_SANS, fontSize: 13 }}>
            Vista <strong style={{ color: C.textPrimary }}>{activeSection}</strong> — pendiente de implementación.
          </div>
        )}
      </DashboardLayout>
    </>
  );
}