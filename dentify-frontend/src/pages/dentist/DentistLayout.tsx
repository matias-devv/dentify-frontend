// src/pages/dentist/DentistLayout.tsx
//
// PERFORMANCE FIX: El motion.aside anterior animaba `width` (propiedad de layout),
// lo que forzaba reflow completo en cada frame → Recharts recalculaba todos los
// ResponsiveContainer durante los 280ms. Solución: el ancho snapea instantáneamente
// (1 solo reflow al hacer click) y las labels/submenús se animan con opacity/transform
// (GPU-composited, cero reflow).

import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Package2, Users, CalendarDays, CalendarCheck,
  CalendarPlus, Clock, ClipboardList, UserCheck, Landmark,
  BarChart3, CreditCard, Stethoscope, ChevronLeft, ChevronRight,
  ChevronDown, Settings, LogOut, Activity,
} from "lucide-react";
import apiClient from "../../api/apiClient";


// ── Design tokens ────────────────────────────────────────────────────────────
const FONT_SANS  = "'DM Sans', sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

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
};

const SIDEBAR_W_EXPANDED  = 256;
const SIDEBAR_W_COLLAPSED = 68;

// ── Sidebar route map ────────────────────────────────────────────────────────
export const SIDEBAR_ROUTES: Record<string, string> = {
  inicio:           "/dentist/dashboard",
  productos:        "/dentist/dashboard/productos",
  pacientes:        "/dentist/dashboard/pacientes",
  "mis-agendas":    "/dentist/dashboard/agendas",
  "nueva-agenda":   "/dentist/dashboard/agendas/nueva",
  "otorgar-turno":  "/dentist/dashboard/turnos/otorgar",
  admision:         "/dentist/dashboard/turnos/admision",
  resumen:          "/dentist/payments/resumen",
  pagos:            "/dentist/payments/pagos",
  tratamientos:     "/dentist/payments/tratamientos",
};

const ROUTE_TO_SIDEBAR: Record<string, string> = {
  "/dentist/dashboard":                   "inicio",
  "/dentist/dashboard/productos":         "productos",
  "/dentist/dashboard/pacientes":         "pacientes",
  "/dentist/dashboard/agendas":           "mis-agendas",
  "/dentist/dashboard/agendas/nueva":     "nueva-agenda",
  "/dentist/dashboard/turnos/otorgar":    "otorgar-turno",
  "/dentist/dashboard/turnos/admision":   "admision",
  "/dentist/payments/resumen":            "resumen",
  "/dentist/payments/pagos":              "pagos",
  "/dentist/payments/tratamientos":       "tratamientos",
};

const TOP_BAR_LABELS: Record<string, string> = {
  inicio:          "Inicio",
  productos:       "Productos y Servicios",
  pacientes:       "Pacientes",
  "mis-agendas":   "Mis agendas",
  "nueva-agenda":  "Nueva agenda",
  "otorgar-turno": "Otorgar turno",
  admision:        "Admisión",
  resumen:         "Resumen financiero",
  pagos:           "Pagos",
  tratamientos:    "Tratamientos",
};

const PARENT_DEFAULT: Record<string, string> = {
  agendas:  "mis-agendas",
  turnos:   "otorgar-turno",
  finanzas: "resumen",
};

// ── Nav item types ────────────────────────────────────────────────────────────
type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: NavSubItem[];
};

type NavSubItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { id: "inicio",    label: "Inicio",               icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
  { id: "productos", label: "Productos y Servicios", icon: <Package2        size={18} strokeWidth={1.5} /> },
  { id: "pacientes", label: "Pacientes",             icon: <Users           size={18} strokeWidth={1.5} /> },
  {
    id: "agendas", label: "Agendas", icon: <CalendarDays size={18} strokeWidth={1.5} />,
    children: [
      { id: "mis-agendas",   label: "Mis agendas",  icon: <CalendarCheck size={14} strokeWidth={1.5} /> },
      { id: "nueva-agenda",  label: "Nueva agenda", icon: <CalendarPlus  size={14} strokeWidth={1.5} /> },
    ],
  },
  {
    id: "turnos", label: "Turnos", icon: <Clock size={18} strokeWidth={1.5} />,
    children: [
      { id: "otorgar-turno", label: "Otorgar turno", icon: <ClipboardList size={14} strokeWidth={1.5} /> },
      { id: "admision",      label: "Admisión",       icon: <UserCheck    size={14} strokeWidth={1.5} /> },
    ],
  },
  {
    id: "finanzas", label: "Finanzas", icon: <Landmark size={18} strokeWidth={1.5} />,
    children: [
      { id: "resumen",      label: "Resumen",      icon: <BarChart3   size={14} strokeWidth={1.5} /> },
      { id: "pagos",        label: "Pagos",        icon: <CreditCard  size={14} strokeWidth={1.5} /> },
      { id: "tratamientos", label: "Tratamientos", icon: <Stethoscope size={14} strokeWidth={1.5} /> },
    ],
  },
];

// ── Helper ───────────────────────────────────────────────────────────────────
function resolveSidebarId(pathname: string): string {
  if (ROUTE_TO_SIDEBAR[pathname]) return ROUTE_TO_SIDEBAR[pathname];
  const match = Object.entries(ROUTE_TO_SIDEBAR)
    .filter(([route]) => pathname.startsWith(route))
    .sort(([a], [b]) => b.length - a.length)[0];
  return match ? match[1] : "inicio";
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
function NavTooltip({ label, children, visible }: { label: string; children: React.ReactNode; visible: boolean }) {
  const [show, setShow] = useState(false);
  if (!visible) return <>{children}</>;
  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", left: "100%", marginLeft: 12, top: "50%",
              transform: "translateY(-50%)", zIndex: 50, pointerEvents: "none",
            }}
          >
            <div style={{
              background: "#1a2d45", border: "1px solid rgba(96,165,250,0.15)",
              color: "#c9d8ef", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
              padding: "5px 10px", borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)", fontFamily: FONT_SANS,
            }}>
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Nav item row ─────────────────────────────────────────────────────────────
// FIX: el texto usa AnimatePresence/opacity en lugar de conditional render abrupto.
// Así el fade es suave (GPU opacity) sin ningún cambio de layout.
function NavItemRow({ item, collapsed, active, parentActive, hasChildren, isOpen, onClick }: {
  item: NavItem; collapsed: boolean; active: boolean; parentActive: boolean;
  hasChildren?: boolean; isOpen?: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const getBg    = () => active ? "rgba(59,130,246,0.12)" : hovered ? "rgba(255,255,255,0.04)" : parentActive ? "rgba(59,130,246,0.06)" : "transparent";
  const getIcon  = () => active ? "#60a5fa" : parentActive ? "#5580a6" : hovered ? "#7ba4c8" : "#4a6485";
  const getText  = () => active ? "#e8edf5" : parentActive ? "#8aadce" : hovered ? "#b8cde4" : "#6b7e9a";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", width: "100%", display: "flex", alignItems: "center",
        gap: 10, padding: collapsed ? "10px 0" : "9px 10px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 7, background: getBg(), border: "none", cursor: "pointer",
        transition: "background 0.15s ease", textAlign: "left",
        // Evita que el cambio de ancho del sidebar afecte el layout interno
        overflow: "hidden",
      }}
    >
      {/* Active indicator bar */}
      {active && !collapsed && (
        <div style={{
          position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
          width: 3, height: "60%", borderRadius: "0 3px 3px 0",
          background: "linear-gradient(180deg, #60a5fa, #3b82f6)",
          boxShadow: "0 0 8px rgba(96,165,250,0.4)",
        }} />
      )}

      {/* Icon */}
      <div style={{
        color: getIcon(), display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0, transition: "color 0.15s ease",
        ...(active && collapsed ? { filter: "drop-shadow(0 0 6px rgba(96,165,246,0.5))" } : {}),
      }}>
        {item.icon}
      </div>

      {/*
        FIX: AnimatePresence con opacity en lugar de `{!collapsed && <span>}`.
        La transición de opacity es GPU-composited → cero reflow.
      */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            style={{
              flex: 1, fontSize: 13, fontWeight: active ? 500 : 400,
              letterSpacing: "0.005em", color: getText(),
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              fontFamily: FONT_SANS, pointerEvents: "none",
            }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Chevron — solo visible si hay hijos y no está colapsado */}
      <AnimatePresence initial={false}>
        {!collapsed && hasChildren && (
          <motion.div
            key="chevron"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, rotate: isOpen ? 180 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            style={{ color: getIcon(), display: "flex", flexShrink: 0 }}
          >
            <ChevronDown size={13} strokeWidth={1.75} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed active dot */}
      {active && collapsed && (
        <div style={{
          position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
          width: 4, height: 4, borderRadius: "50%", background: "#60a5fa",
          boxShadow: "0 0 6px rgba(96,165,250,0.7)",
        }} />
      )}
    </button>
  );
}

// ── Sub item row ─────────────────────────────────────────────────────────────
function SubItemRow({ item, active, onClick }: { item: NavSubItem; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", width: "100%", display: "flex", alignItems: "center",
        gap: 8, padding: "7px 10px 7px 32px", borderRadius: 6,
        background: active ? "rgba(59,130,246,0.10)" : hovered ? "rgba(255,255,255,0.03)" : "transparent",
        border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.15s ease",
      }}
    >
      {active && (
        <div style={{
          position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)",
          width: 2, height: "50%", borderRadius: 2, background: "#3b82f6", opacity: 0.9,
        }} />
      )}
      <div style={{ color: active ? "#60a5fa" : hovered ? "#6b90b3" : "#3f5570", display: "flex", alignItems: "center", transition: "color 0.15s ease" }}>
        {item.icon}
      </div>
      <span style={{
        fontSize: 12.5, fontWeight: active ? 500 : 400,
        color: active ? "#c9ddf5" : hovered ? "#8aadce" : "#4a6485",
        letterSpacing: "0.005em", transition: "color 0.15s ease",
        whiteSpace: "nowrap", fontFamily: FONT_SANS,
      }}>
        {item.label}
      </span>
    </button>
  );
}

// ── Footer button ─────────────────────────────────────────────────────────────
function FooterBtn({ icon, label, collapsed, danger, onClick }: {
  icon: React.ReactNode; label: string; collapsed: boolean; danger?: boolean; onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: collapsed ? "9px 0" : "8px 10px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 7,
        background: hovered ? (danger ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)") : "transparent",
        border: "none", cursor: "pointer", transition: "background 0.15s ease",
        overflow: "hidden",
      }}
    >
      <div style={{
        color: hovered ? (danger ? "#f87171" : "#7ba4c8") : (danger ? "#3f4f65" : "#3f5570"),
        display: "flex", alignItems: "center", transition: "color 0.15s ease", flexShrink: 0,
      }}>
        {icon}
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="footer-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            style={{
              fontSize: 13, fontWeight: 400,
              color: hovered ? (danger ? "#f87171" : "#8aadce") : (danger ? "#3f4f65" : "#4a6485"),
              transition: "color 0.15s ease", fontFamily: FONT_SANS, whiteSpace: "nowrap",
            }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
// FIX: El aside ya NO usa motion.aside con animate={{ width }}.
// El ancho snapea instantáneamente (1 reflow al click, 0 durante animación).
// overflow: hidden + will-change: transform son los únicos hints de compositing.
function DentifySidebar({ activeSidebarId, collapsed, onToggle }: {
  activeSidebarId: string; collapsed: boolean; onToggle: () => void;
}) {
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["finanzas"]));

  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (item.children?.some((c) => c.id === activeSidebarId)) {
        setOpenGroups((prev) => new Set([...prev, item.id]));
      }
    });
  }, [activeSidebarId]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleClick = (sidebarId: string, hasChildren: boolean) => {
    if (hasChildren) {
      if (!collapsed) {
        toggleGroup(sidebarId);
      } else {
        const child = PARENT_DEFAULT[sidebarId];
        if (child) navigate(SIDEBAR_ROUTES[child]);
      }
    } else {
      navigate(SIDEBAR_ROUTES[sidebarId] ?? "/dentist/dashboard");
    }
  };

  const isActive       = (id: string) => activeSidebarId === id;
  const isParentActive = (item: NavItem) =>
    item.children?.some((c) => c.id === activeSidebarId) || activeSidebarId === item.id;

  const sidebarWidth = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED;

  return (
    // ┌─────────────────────────────────────────────────────────────────────┐
    // │  aside — width snapea sin transición CSS.                            │
    // │  Esto causa exactamente 1 reflow al hacer click, después nada.      │
    // │  will-change: transform → hint al browser para compositing layer.   │
    // └─────────────────────────────────────────────────────────────────────┘
    <aside
      style={{
        width: sidebarWidth,
        background: "linear-gradient(180deg, #0b1929 0%, #0d1f35 60%, #091624 100%)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "4px 0 24px rgba(0,0,0,0.45)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        // GPU compositing hint — el browser puede elevar el sidebar a su
        // propia capa de composición. No resuelve reflow, pero reduce paint
        // cost de los gradientes/sombras al cambiar width.
        willChange: "transform",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "20px 0 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        paddingLeft: collapsed ? 0 : 20, paddingRight: collapsed ? 0 : 14,
      }}>
        <AnimatePresence initial={false} mode="wait">
          {!collapsed ? (
            <motion.div
              key="full"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, boxShadow: "0 0 12px rgba(59,130,246,0.35)",
              }}>
                <Activity size={16} strokeWidth={2} color="#fff" />
              </div>
              <div>
                <div style={{ color: "#e8edf5", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2, fontFamily: FONT_SANS }}>Dentify</div>
                <div style={{ color: "#4a6485", fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1, fontFamily: FONT_SANS }}>Clinical Suite</div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="icon"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 12px rgba(59,130,246,0.35)",
              }}
            >
              <Activity size={16} strokeWidth={2} color="#fff" />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.button
              key="collapse-btn"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={onToggle}
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.03)", color: "#4a6485",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s ease", flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#8aadce"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#4a6485"; }}
            >
              <ChevronLeft size={14} strokeWidth={2} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Expand button when collapsed */}
      <AnimatePresence initial={false}>
        {collapsed && (
          <motion.div
            key="expand-area"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}
          >
            <button
              onClick={onToggle}
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.03)", color: "#4a6485",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#8aadce"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#4a6485"; }}
            >
              <ChevronRight size={14} strokeWidth={2} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: collapsed ? "12px 0" : "12px 10px", scrollbarWidth: "none",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.map((item) => {
            const hasChildren = !!(item.children?.length);
            const isOpen      = openGroups.has(item.id);
            const pActive     = isParentActive(item);
            const self        = isActive(item.id);
            return (
              <div key={item.id}>
                <NavTooltip label={item.label} visible={collapsed}>
                  <NavItemRow
                    item={item} collapsed={collapsed} active={self}
                    parentActive={pActive && !self} hasChildren={hasChildren}
                    isOpen={isOpen} onClick={() => handleClick(item.id, hasChildren)}
                  />
                </NavTooltip>

                {/* Submenu — solo si no está colapsado */}
                {hasChildren && !collapsed && (
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ paddingTop: 2, paddingBottom: 2 }}>
                          {item.children!.map((child) => (
                            <SubItemRow
                              key={child.id} item={child}
                              active={isActive(child.id)}
                              onClick={() => handleClick(child.id, false)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div style={{ margin: collapsed ? "0 12px" : "0 10px", height: 1, background: "rgba(255,255,255,0.05)" }} />

      <div style={{ padding: collapsed ? "12px 0" : "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <NavTooltip label="Ajustes" visible={collapsed}>
          <FooterBtn icon={<Settings size={18} strokeWidth={1.5} />} label="Ajustes" collapsed={collapsed} />
        </NavTooltip>
        <NavTooltip label="Cerrar sesión" visible={collapsed}>
          <FooterBtn icon={<LogOut size={18} strokeWidth={1.5} />} label="Cerrar sesión" collapsed={collapsed} danger />
        </NavTooltip>
      </div>
    </aside>
  );
}

// ── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({ sidebarId, userProfile }: { sidebarId: string; userProfile: unknown }) {
  const profile     = userProfile as { name?: string; surname?: string; clinicName?: string } | null;
  const label       = TOP_BAR_LABELS[sidebarId] ?? "Dashboard";
  const displayName = profile ? `Dr. ${profile.name} ${profile.surname}` : "—";
  const clinic      = profile?.clinicName ?? "";
  const initials    = profile
    ? `${profile.name?.[0] ?? ""}${profile.surname?.[0] ?? ""}`.toUpperCase()
    : null;

  return (
    <div style={{
      height: 60, background: C.cardBg, borderBottom: `1px solid ${C.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", position: "sticky", top: 0, zIndex: 9, flexShrink: 0,
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
            {clinic}
          </p>
        </div>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: initials ? C.electric : C.border, color: "#FFFFFF",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT_SANS, fontSize: 12, fontWeight: 700,
          letterSpacing: "0.04em", flexShrink: 0,
        }}>
          {initials}
        </div>
      </div>
    </div>
  );
}

// ── Layout root ───────────────────────────────────────────────────────────────
export default function DentistLayout() {
  const location                      = useLocation();
  const [collapsed, setCollapsed]     = useState(false);
  const [userProfile, setUserProfile] = useState<unknown>(null);

  const activeSidebarId = resolveSidebarId(location.pathname);
  const isAgendaPage = activeSidebarId === "mis-agendas" || activeSidebarId === "nueva-agenda";
  // Ocultar TopBar en vistas que ya tienen su propio encabezado interno
  const hideTopBar =
    isAgendaPage ||
    activeSidebarId === "productos" ||
    activeSidebarId === "pacientes" ||
    location.pathname.startsWith("/dentist/dashboard/turnos/");

  useEffect(() => {
    apiClient.get("/api/users/me").then((r) => setUserProfile(r.data)).catch(() => {});
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { font-family: ${FONT_SANS}; -webkit-font-smoothing: antialiased; background: ${C.bg}; }
        nav::-webkit-scrollbar { width: 4px; }
        nav::-webkit-scrollbar-track { background: transparent; }
        nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <DentifySidebar
          activeSidebarId={activeSidebarId}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
        {/*
          FIX: El área de contenido recibe su nuevo ancho en un único reflow
          (cuando `collapsed` cambia). No hay transición CSS aquí —
          cualquier transition en width/flex acá volvería a causar el mismo
          problema de reflow continuo.
        */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!hideTopBar && <TopBar sidebarId={activeSidebarId} userProfile={userProfile} />}
          <main style={{
            flex: 1,
            overflowY: "auto",
            background: C.bg,
            ...(isAgendaPage ? { padding: "32px 36px", boxSizing: "border-box" } : {}),
          }}>
            <Outlet context={{ userProfile }} />
          </main>
        </div>
      </div>
    </>
  );
}