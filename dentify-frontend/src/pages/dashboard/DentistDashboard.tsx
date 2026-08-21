import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package2,
  Users,
  CalendarDays,
  CalendarCheck,
  CalendarPlus,
  Clock,
  ClipboardList,
  UserCheck,
  Landmark,
  BarChart3,
  CreditCard,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  LogOut,
  Activity,
} from "lucide-react";
import apiClient from "../../api/apiClient";

import { AgendaListView, AgendaCreateView } from "../agendas/AgendaViews";
import { OtorgarTurnoView, type SelectedSlotContext } from "../turnos/TurnosViews";
import { CrearTurnoView } from "../turnos/CrearTurnoView";
import { TurnoDetailView } from "../turnos/TurnoDetailView";
import { AdmisionView } from "../turnos/AdmisionView";
import { PacientesListView } from "../patients/PatientViews";
import { CreatePatientView } from "../patients/CreatePatientView";
import { ProductsView } from "../products/ProductView";

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
  navText: "#374151",
  navTextHover: "#111827",
};

const FONT_SANS  = "'DM Sans', sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";
const POLL_INTERVAL_MS = 45_000;

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════
interface PaymentTodayResponse {
  id: number;
  patient_name: string;
  patient_surname: string;
  patient_id: number;
  time: string;
  amount: number;
  payment_method: "CASH" | "MERCADO_PAGO";
  payment_status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
  service_name: string;
  appointment_id: number;
  has_receipt: boolean;
}

interface CancelledAppointment {
  id_appointment: number;
  time: string;
  patient_name: string;
  patient_surname: string;
  cancelled_by: string;
  reason_for_cancellation: string | null;
  service_name: string;
  appointmentStart: string;
}

interface ConfirmCashPanelProps {
  payment: PaymentTodayResponse;
  onConfirm: (id: number, montoRecibido: number) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error?: string | null;
}

interface ConfirmCashRequest {
  id_payment: number;
  amount_received: number;
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
const CANCELLED_BY_LABEL: Record<string, string> = {
  CANCELLED_BY_PATIENT:   "Cancelado por paciente",
  CANCELLED_BY_DENTIST:   "Cancelado por odontólogo",
  CANCELLED_BY_SECRETARY: "Cancelado por secretario",
  CANCELLED_BY_SYSTEM:    "Cancelado por sistema",
  CANCELLED:              "Cancelado",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const getSaludo = (h: number) =>
  h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";

const extractTime = (isoString: string) => {
  if (!isoString) return "—";
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(isoString)) {
    return isoString.slice(0, 5);
  }
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
};

const buildInitials = (name?: string, surname?: string) => {
  const a = name?.[0]?.toUpperCase() ?? "";
  const b = surname?.[0]?.toUpperCase() ?? "";
  return a + b || "—";
};

const sortPaymentsByTime = (payments: PaymentTodayResponse[]): PaymentTodayResponse[] =>
  [...payments].sort((a, b) => a.time.localeCompare(b.time));

// ════════════════════════════════════════════════════════════════
// BADGE MAPS
// ════════════════════════════════════════════════════════════════
const APPOINTMENT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  SCHEDULED:       { label: "Programado",  bg: "#F0F1F5", color: "#5A6070" },
  CONFIRMED:       { label: "Confirmado",  bg: "#F0F4FF", color: "#3B4FBA" },
  ADMITTED:        { label: "Admitido",    bg: "#1A2B4A", color: "#FFFFFF" },
  IN_ATTENTION:    { label: "En atención", bg: "#2563EB", color: "#FFFFFF" },
  COMPLETED:       { label: "Completado",  bg: "#ECFDF5", color: "#065F46" },
  NO_SHOW:         { label: "Ausente",     bg: "#FEF2F2", color: "#991B1B" },
  WALK_IN_PENDING: { label: "Sin turno",   bg: "#FEF9C3", color: "#854D0E" },
  CANCELLED:       { label: "Cancelado",   bg: "#F9FAFB", color: "#9CA3AF" },
};

const PAYMENT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:   { label: "Pendiente", bg: "#FEF3C7", color: "#B45309" },
  PARTIAL:   { label: "Parcial",   bg: "#DBEAFE", color: "#1E40AF" },
  PAID:      { label: "Pagado",    bg: "#ECFDF5", color: "#065F46" },
  CANCELLED: { label: "Cancelado", bg: "#F3F4F6", color: "#6B7280" },
};

const NON_ADMITTABLE = new Set([
  "ADMITTED", "IN_ATTENTION", "COMPLETED", "NO_SHOW",
  "CANCELLED", "CANCELLED_BY_SYSTEM", "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_DENTIST", "CANCELLED_BY_SECRETARY",
]);

// ════════════════════════════════════════════════════════════════
// ICONOS SVG (kept for existing components)
// ════════════════════════════════════════════════════════════════
const Icon = {
  cash: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="16" height="10" rx="1.5"/>
      <circle cx="10" cy="10" r="2.5"/>
      <path d="M5 10h.5M14.5 10h.5"/>
    </svg>
  ),
  link: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11a4 4 0 005.6.4l2-2a4 4 0 00-5.6-5.6l-1.1 1.1"/>
      <path d="M12 9a4 4 0 00-5.6-.4l-2 2a4 4 0 005.6 5.6l1.1-1.1"/>
    </svg>
  ),
  alertTriangle: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3L2 17h16L10 3z"/>
      <path d="M10 9v4M10 15v.5"/>
    </svg>
  ),
  close: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 3l10 10M13 3L3 13"/>
    </svg>
  ),
  arrowRight: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  checkSmall: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  home: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M7 18v-7h6v7"/>
    </svg>
  ),
  help: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5"/>
      <path d="M7.5 7.5a2.5 2.5 0 015 .833c0 1.667-2.5 2.5-2.5 2.5M10 14v.5"/>
    </svg>
  ),
};

// ════════════════════════════════════════════════════════════════
// DENTIFY SIDEBAR — NEW (controlled)
// ════════════════════════════════════════════════════════════════

// ID mapping: sidebar internal IDs → dashboard activeSection IDs
const SIDEBAR_TO_DASHBOARD: Record<string, string> = {
  inicio:          "home",
  productos:       "productos",
  pacientes:       "pacientes",
  "mis-agendas":   "agendas-list",
  "nueva-agenda":  "agendas-create",
  "otorgar-turno": "turnos-otorgar",
  admision:        "turnos-admision",
  resumen:         "finanzas-resumen",
  pagos:           "finanzas-pagos",
  tratamientos:    "finanzas-tratamientos",
};

// Reverse map: dashboard activeSection → sidebar item ID (for highlighting)
const DASHBOARD_TO_SIDEBAR: Record<string, string> = Object.fromEntries(
  Object.entries(SIDEBAR_TO_DASHBOARD).map(([k, v]) => [v, k])
);

// First-child fallback for parent-level clicks when collapsed
const PARENT_DEFAULT_CHILD: Record<string, string> = {
  agendas:  "mis-agendas",
  turnos:   "otorgar-turno",
  finanzas: "resumen",
};

type SidebarNavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: SidebarNavSubItem[];
};

type SidebarNavSubItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    id: "inicio",
    label: "Inicio",
    icon: <LayoutDashboard size={18} strokeWidth={1.5} />,
  },
  {
    id: "productos",
    label: "Productos y Servicios",
    icon: <Package2 size={18} strokeWidth={1.5} />,
  },
  {
    id: "pacientes",
    label: "Pacientes",
    icon: <Users size={18} strokeWidth={1.5} />,
  },
  {
    id: "agendas",
    label: "Agendas",
    icon: <CalendarDays size={18} strokeWidth={1.5} />,
    children: [
      { id: "mis-agendas",  label: "Mis agendas",  icon: <CalendarCheck size={14} strokeWidth={1.5} /> },
      { id: "nueva-agenda", label: "Nueva agenda", icon: <CalendarPlus  size={14} strokeWidth={1.5} /> },
    ],
  },
  {
    id: "turnos",
    label: "Turnos",
    icon: <Clock size={18} strokeWidth={1.5} />,
    children: [
      { id: "otorgar-turno", label: "Otorgar turno", icon: <ClipboardList size={14} strokeWidth={1.5} /> },
      { id: "admision",      label: "Admisión",       icon: <UserCheck    size={14} strokeWidth={1.5} /> },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    icon: <Landmark size={18} strokeWidth={1.5} />,
    children: [
      { id: "resumen",      label: "Resumen",        icon: <BarChart3    size={14} strokeWidth={1.5} /> },
      { id: "pagos",        label: "Pagos",           icon: <CreditCard   size={14} strokeWidth={1.5} /> },
      { id: "tratamientos", label: "Tratamientos",    icon: <Stethoscope  size={14} strokeWidth={1.5} /> },
    ],
  },
];

type SidebarTooltipProps = {
  label: string;
  children: React.ReactNode;
  visible: boolean;
};

function NavTooltip({ label, children, visible }: SidebarTooltipProps) {
  const [show, setShow] = useState(false);
  if (!visible) return <>{children}</>;
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              left: "100%",
              marginLeft: 12,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 50,
              pointerEvents: "none",
            }}
          >
            <div style={{
              background: "#1a2d45",
              border: "1px solid rgba(96,165,250,0.15)",
              color: "#c9d8ef",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
              padding: "5px 10px",
              borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
              fontFamily: FONT_SANS,
            }}>
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SidebarItemRowProps {
  item: SidebarNavItem;
  collapsed: boolean;
  active: boolean;
  parentActive: boolean;
  hasChildren?: boolean;
  isOpen?: boolean;
  onClick: () => void;
}

function SidebarItemRow({ item, collapsed, active, parentActive, hasChildren, isOpen, onClick }: SidebarItemRowProps) {
  const [hovered, setHovered] = useState(false);

  const getBg = () => {
    if (active) return "rgba(59,130,246,0.12)";
    if (hovered) return "rgba(255,255,255,0.04)";
    if (parentActive) return "rgba(59,130,246,0.06)";
    return "transparent";
  };

  const getIconColor = () => {
    if (active) return "#60a5fa";
    if (parentActive) return "#5580a6";
    if (hovered) return "#7ba4c8";
    return "#4a6485";
  };

  const getTextColor = () => {
    if (active) return "#e8edf5";
    if (parentActive) return "#8aadce";
    if (hovered) return "#b8cde4";
    return "#6b7e9a";
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "10px 0" : "9px 10px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 7,
        background: getBg(),
        border: "none",
        cursor: "pointer",
        transition: "background 0.15s ease",
        textAlign: "left",
      }}
    >
      {active && !collapsed && (
        <div style={{
          position: "absolute", left: 0, top: "50%",
          transform: "translateY(-50%)",
          width: 3, height: "60%",
          borderRadius: "0 3px 3px 0",
          background: "linear-gradient(180deg, #60a5fa, #3b82f6)",
          boxShadow: "0 0 8px rgba(96,165,250,0.4)",
        }} />
      )}
      <div style={{
        color: getIconColor(),
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "color 0.15s ease",
        ...(active && collapsed ? { filter: "drop-shadow(0 0 6px rgba(96,165,246,0.5))" } : {}),
      }}>
        {item.icon}
      </div>
      {!collapsed && (
        <>
          <span style={{
            flex: 1, fontSize: 13,
            fontWeight: active ? 500 : 400,
            letterSpacing: "0.005em",
            color: getTextColor(),
            transition: "color 0.15s ease",
            whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis",
            fontFamily: FONT_SANS,
          }}>
            {item.label}
          </span>
          {hasChildren && (
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ color: getIconColor(), display: "flex", flexShrink: 0 }}
            >
              <ChevronDown size={13} strokeWidth={1.75} />
            </motion.div>
          )}
        </>
      )}
      {active && collapsed && (
        <div style={{
          position: "absolute", right: 6, top: "50%",
          transform: "translateY(-50%)",
          width: 4, height: 4, borderRadius: "50%",
          background: "#60a5fa",
          boxShadow: "0 0 6px rgba(96,165,250,0.7)",
        }} />
      )}
    </button>
  );
}

interface SidebarSubItemRowProps {
  item: SidebarNavSubItem;
  active: boolean;
  onClick: () => void;
}

function SidebarSubItemRow({ item, active, onClick }: SidebarSubItemRowProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: "100%",
        display: "flex", alignItems: "center",
        gap: 8, padding: "7px 10px 7px 32px",
        borderRadius: 6,
        background: active ? "rgba(59,130,246,0.10)" : hovered ? "rgba(255,255,255,0.03)" : "transparent",
        border: "none", cursor: "pointer",
        textAlign: "left", transition: "background 0.15s ease",
      }}
    >
      {active && (
        <div style={{
          position: "absolute", left: 18, top: "50%",
          transform: "translateY(-50%)",
          width: 2, height: "50%",
          borderRadius: 2, background: "#3b82f6", opacity: 0.9,
        }} />
      )}
      <div style={{
        color: active ? "#60a5fa" : hovered ? "#6b90b3" : "#3f5570",
        display: "flex", alignItems: "center",
        transition: "color 0.15s ease",
      }}>
        {item.icon}
      </div>
      <span style={{
        fontSize: 12.5,
        fontWeight: active ? 500 : 400,
        color: active ? "#c9ddf5" : hovered ? "#8aadce" : "#4a6485",
        letterSpacing: "0.005em",
        transition: "color 0.15s ease",
        whiteSpace: "nowrap",
        fontFamily: FONT_SANS,
      }}>
        {item.label}
      </span>
    </button>
  );
}

interface SidebarFooterButtonProps {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  danger?: boolean;
  onClick?: () => void;
}

function SidebarFooterButton({ icon, label, collapsed, danger, onClick }: SidebarFooterButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center",
        gap: 10, padding: collapsed ? "9px 0" : "8px 10px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 7,
        background: hovered ? (danger ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)") : "transparent",
        border: "none", cursor: "pointer",
        transition: "background 0.15s ease",
      }}
    >
      <div style={{
        color: hovered ? (danger ? "#f87171" : "#7ba4c8") : (danger ? "#3f4f65" : "#3f5570"),
        display: "flex", alignItems: "center",
        transition: "color 0.15s ease",
      }}>
        {icon}
      </div>
      {!collapsed && (
        <span style={{
          fontSize: 13, fontWeight: 400,
          color: hovered ? (danger ? "#f87171" : "#8aadce") : (danger ? "#3f4f65" : "#4a6485"),
          transition: "color 0.15s ease",
          fontFamily: FONT_SANS,
        }}>
          {label}
        </span>
      )}
    </button>
  );
}

interface DentifySidebarProps {
  activeItem: string;         // dashboard's activeSection
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function DentifySidebar({ activeItem, onNavigate, collapsed, onToggleCollapse }: DentifySidebarProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["agendas"]));

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Convert dashboard activeSection → sidebar item ID for highlighting
  const activeSidebarId = DASHBOARD_TO_SIDEBAR[activeItem] ?? activeItem;

  const isActive = (id: string) => activeSidebarId === id;

  const isParentActive = (item: SidebarNavItem) =>
    item.children?.some((c) => c.id === activeSidebarId) || activeSidebarId === item.id;

  const handleItemClick = (sidebarId: string, hasChildren: boolean) => {
    if (hasChildren) {
      if (!collapsed) {
        toggleGroup(sidebarId);
      } else {
        // When collapsed, navigate to the first child
        const defaultChild = PARENT_DEFAULT_CHILD[sidebarId];
        if (defaultChild) {
          const dashId = SIDEBAR_TO_DASHBOARD[defaultChild] ?? defaultChild;
          onNavigate(dashId);
          setOpenGroups((prev) => new Set([...prev, sidebarId]));
        }
      }
    } else {
      const dashId = SIDEBAR_TO_DASHBOARD[sidebarId] ?? sidebarId;
      onNavigate(dashId);
    }
  };

  const sidebarWidth = collapsed ? 68 : 256;

  return (
    <motion.aside
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      style={{
        background: "linear-gradient(180deg, #0b1929 0%, #0d1f35 60%, #091624 100%)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "4px 0 24px rgba(0,0,0,0.45)",
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        overflow: "hidden", flexShrink: 0,
        position: "relative",
      }}
    >
      {/* ── Header ── */}
      <div style={{
        padding: "20px 0 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        paddingLeft: collapsed ? 0 : 20,
        paddingRight: collapsed ? 0 : 14,
      }}>
        <AnimatePresence initial={false} mode="wait">
          {!collapsed ? (
            <motion.div
              key="logo-full"
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
                <div style={{ color: "#e8edf5", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2, fontFamily: FONT_SANS }}>
                  Dentify
                </div>
                <div style={{ color: "#4a6485", fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1, fontFamily: FONT_SANS }}>
                  Clinical Suite
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="logo-icon"
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

        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              color: "#4a6485", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.15s ease", flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#8aadce"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#4a6485"; }}
          >
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}>
          <button
            onClick={onToggleCollapse}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              color: "#4a6485", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#8aadce"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#4a6485"; }}
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: collapsed ? "12px 0" : "12px 10px",
        scrollbarWidth: "none",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const hasChildren = !!(item.children && item.children.length > 0);
            const isOpen      = openGroups.has(item.id);
            const parentActive = isParentActive(item);
            const selfActive   = isActive(item.id);

            return (
              <div key={item.id}>
                <NavTooltip label={item.label} visible={collapsed}>
                  <SidebarItemRow
                    item={item}
                    collapsed={collapsed}
                    active={selfActive}
                    parentActive={parentActive && !selfActive}
                    hasChildren={hasChildren}
                    isOpen={isOpen}
                    onClick={() => handleItemClick(item.id, hasChildren)}
                  />
                </NavTooltip>

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
                            <SidebarSubItemRow
                              key={child.id}
                              item={child}
                              active={isActive(child.id)}
                              onClick={() => handleItemClick(child.id, false)}
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

      {/* Divider */}
      <div style={{ margin: collapsed ? "0 12px" : "0 10px", height: 1, background: "rgba(255,255,255,0.05)" }} />

      {/* ── Footer ── */}
      <div style={{ padding: collapsed ? "12px 0" : "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <NavTooltip label="Ajustes" visible={collapsed}>
          <SidebarFooterButton icon={<Settings size={18} strokeWidth={1.5} />} label="Ajustes" collapsed={collapsed} />
        </NavTooltip>
        <NavTooltip label="Cerrar sesión" visible={collapsed}>
          <SidebarFooterButton icon={<LogOut size={18} strokeWidth={1.5} />} label="Cerrar sesión" collapsed={collapsed} danger />
        </NavTooltip>
      </div>
    </motion.aside>
  );
}

// ════════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════
function Badge({ status, map }: {
  status: string;
  map: Record<string, { label: string; bg: string; color: string }>;
}) {
  const cfg = map[status] || { label: status, bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 100,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
      background: cfg.bg, color: cfg.color, whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

function MetricCard({ label, value, sub, accent = false }: {
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div style={{
      background: accent ? C.navy : C.cardBg,
      border: `1px solid ${accent ? "transparent" : C.border}`,
      borderRadius: 10, padding: "22px 24px",
      display: "flex", flexDirection: "column", gap: 6,
      flex: 1, minWidth: 0,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: accent ? "rgba(255,255,255,0.55)" : C.textMuted,
        fontFamily: FONT_SANS,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 26, fontWeight: 700,
        color: accent ? "#FFFFFF" : C.textPrimary,
        fontFamily: FONT_SANS, lineHeight: 1.1, letterSpacing: "-0.02em",
      }}>
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

function EmptyState({ text, positive = false }: { text: string; positive?: boolean }) {
  return (
    <div style={{
      padding: "32px 0", textAlign: "center",
      color: positive ? "#065F46" : C.textMuted,
      fontSize: 13, fontFamily: FONT_SANS, letterSpacing: "0.01em",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: positive ? "#ECFDF5" : "#F4F5F7",
        margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          {positive ? (
            <path d="M3 8l3.5 3.5L13 4" stroke="#065F46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          ) : (
            <path d="M8 5v4M8 11v.5" stroke={C.textMuted} strokeWidth="1.6" strokeLinecap="round"/>
          )}
        </svg>
      </div>
      {text}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border }} />;
}

function ColumnCard({ flex, children }: { flex: string; children: React.ReactNode }) {
  return (
    <div style={{
      flex, background: C.cardBg, border: `1px solid ${C.border}`,
      borderRadius: 10, display: "flex", flexDirection: "column",
      minWidth: 0, overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CONFIRM CASH PANEL
// ════════════════════════════════════════════════════════════════
function ConfirmCashPanel({ payment, onConfirm, onCancel, isLoading, error }: ConfirmCashPanelProps) {
  const [montoRecibido, setMontoRecibido] = useState<string>("");

  const montoNumerico  = parseFloat(montoRecibido.replace(/\./g, "").replace(",", ".")) || 0;
  const vuelto         = montoNumerico - payment.amount;
  const puedeConfirmar = montoNumerico >= payment.amount;

  const shortcuts = [
    payment.amount,
    ...[500, 1000, 2000, 5000, 10000].filter((b) => b > payment.amount),
  ].slice(0, 5);

  const handleShortcut = (val: number) => setMontoRecibido(val.toLocaleString("es-AR"));

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    if (raw === "") { setMontoRecibido(""); return; }
    setMontoRecibido(parseInt(raw, 10).toLocaleString("es-AR"));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.electric, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", display: "flex" }}>{Icon.cash}</span>
          </div>
          <div>
            <p style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
              Confirmar pago en efectivo
            </p>
            <p style={{ fontFamily: FONT_SANS, fontSize: 11.5, color: C.textSecondary, marginTop: 2 }}>
              {payment.patient_surname}, {payment.patient_name} · {payment.service_name}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textMuted }}>
            Monto a cobrar
          </p>
          <p style={{ fontFamily: FONT_SANS, fontSize: 22, fontWeight: 700, color: C.navy, letterSpacing: "-0.02em", marginTop: 2 }}>
            {formatCurrency(payment.amount)}
          </p>
        </div>
      </div>

      <div style={{ height: 1, background: C.border, marginBottom: 18 }} />

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontFamily: FONT_SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textMuted, marginBottom: 7 }}>
          Monto recibido
        </label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: FONT_SANS, fontSize: 15, fontWeight: 600, color: C.textSecondary, pointerEvents: "none" }}>
            $
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={montoRecibido}
            onChange={handleInput}
            placeholder="0"
            autoFocus
            aria-label="Monto recibido del paciente"
            style={{
              width: "100%", padding: "11px 14px 11px 30px",
              border: `1.5px solid ${puedeConfirmar && montoRecibido ? "#86EFAC" : C.border}`,
              borderRadius: 8, fontFamily: FONT_SANS, fontSize: 16, fontWeight: 600,
              color: C.textPrimary, background: "#FFFFFF", outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = C.electric)}
            onBlur={(e) => { e.currentTarget.style.borderColor = puedeConfirmar && montoRecibido ? "#86EFAC" : C.border; }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
        {shortcuts.map((val) => (
          <button
            key={val}
            onClick={() => handleShortcut(val)}
            aria-label={`Usar ${formatCurrency(val)}`}
            style={{
              padding: "6px 13px",
              border: `1.5px solid ${montoNumerico === val ? C.electric : C.border}`,
              borderRadius: 7,
              background: montoNumerico === val ? "#EFF6FF" : "#FFFFFF",
              color: montoNumerico === val ? C.electric : C.textSecondary,
              fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600,
              cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap",
            }}
          >
            {val === payment.amount ? `Exacto ${formatCurrency(val)}` : `+${formatCurrency(val)}`}
          </button>
        ))}
      </div>

      {montoRecibido !== "" && (
        <div
          aria-live="polite"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: puedeConfirmar ? "#F0FDF4" : "#FEF2F2",
            border: `1px solid ${puedeConfirmar ? "#86EFAC" : "#FECACA"}`,
            borderRadius: 8, padding: "10px 16px", marginBottom: 16,
          }}
        >
          <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600, color: puedeConfirmar ? "#065F46" : "#991B1B" }}>
            {puedeConfirmar ? "✓  Vuelto a entregar" : "Monto insuficiente"}
          </span>
          <span style={{ fontFamily: FONT_SANS, fontSize: 18, fontWeight: 700, color: puedeConfirmar ? "#065F46" : "#991B1B", letterSpacing: "-0.02em" }}>
            {puedeConfirmar ? formatCurrency(vuelto) : `Faltan ${formatCurrency(payment.amount - montoNumerico)}`}
          </span>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, padding: "8px 12px", marginBottom: 14, color: "#991B1B", fontFamily: FONT_SANS, fontSize: 12 }}>
          {Icon.alertTriangle}
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
        <button
          onClick={onCancel}
          disabled={isLoading}
          style={{ padding: "9px 20px", borderRadius: 7, border: `1px solid ${C.border}`, background: "#FFFFFF", color: C.textSecondary, fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, cursor: isLoading ? "default" : "pointer" }}
        >
          Cancelar
        </button>
        <button
          onClick={() => { if (puedeConfirmar) onConfirm(payment.id, montoNumerico); }}
          disabled={!puedeConfirmar || isLoading}
          style={{
            padding: "9px 22px", borderRadius: 7, border: "none",
            background: puedeConfirmar && !isLoading ? C.electric : "#93C5FD",
            color: "#FFFFFF", fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600,
            cursor: puedeConfirmar && !isLoading ? "pointer" : "default",
            display: "flex", alignItems: "center", gap: 7,
            opacity: !puedeConfirmar || isLoading ? 0.6 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {isLoading ? (
            <><span className="modal-spinner" />Confirmando...</>
          ) : (
            <>{Icon.checkSmall} Confirmar</>
          )}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CONFIRM CASH MODAL
// ════════════════════════════════════════════════════════════════
function ConfirmCashModal({ payment, onConfirm, onCancel, isLoading, error }: ConfirmCashPanelProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !isLoading) onCancel(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isLoading, onCancel]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(10, 20, 40, 0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "backdropFadeIn 0.18s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar pago en efectivo"
    >
      <div style={{
        background: "#FFFFFF", borderRadius: 14,
        boxShadow: "0 20px 60px rgba(10,20,40,0.18), 0 4px 16px rgba(10,20,40,0.08)",
        width: "100%", maxWidth: 480, margin: "0 24px", padding: "28px 28px 24px",
        position: "relative",
        animation: "modalScaleIn 0.2s cubic-bezier(0.34, 1.2, 0.64, 1)",
      }}>
        {!isLoading && (
          <button
            onClick={onCancel}
            aria-label="Cerrar modal"
            style={{
              position: "absolute", top: 16, right: 16,
              width: 28, height: 28, borderRadius: "50%",
              background: "#F3F4F6", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: C.textSecondary, transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#E5E7EB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#F3F4F6")}
          >
            {Icon.close}
          </button>
        )}
        <ConfirmCashPanel payment={payment} onConfirm={onConfirm} onCancel={onCancel} isLoading={isLoading} error={error} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PAYMENTS TODAY TABLE
// ════════════════════════════════════════════════════════════════
function PaymentsTodayTable({ payments, onPaymentConfirmed }: {
  payments: PaymentTodayResponse[];
  onPaymentConfirmed: (updated: PaymentTodayResponse) => void;
}) {
  const [modalPayment,  setModalPayment]  = useState<PaymentTodayResponse | null>(null);
  const [loadingId,     setLoadingId]     = useState<number | null>(null);
  const [confirmError,  setConfirmError]  = useState<string | null>(null);

  const handleOpenModal  = (p: PaymentTodayResponse) => { setModalPayment(p); setConfirmError(null); };
  const handleCloseModal = () => { if (loadingId !== null) return; setModalPayment(null); setConfirmError(null); };

  const handleConfirm = async (id: number, montoRecibido: number) => {
    setLoadingId(id);
    setConfirmError(null);
    try {
      const payload: ConfirmCashRequest = { id_payment: id, amount_received: montoRecibido };
      const res = await apiClient.patch("/api/payments/confirm-cash", payload);
      onPaymentConfirmed(res.data as PaymentTodayResponse);
      setModalPayment(null);
    } catch (err: any) {
      const backendMsg: string | undefined = err?.response?.data?.message ?? err?.response?.data?.error;
      setConfirmError(backendMsg ?? "Error al confirmar el pago. Intentá nuevamente.");
    } finally {
      setLoadingId(null);
    }
  };

  const needsAction = (p: PaymentTodayResponse) =>
    p.payment_method === "CASH" && (p.payment_status === "PENDING" || p.payment_status === "PARTIAL");

  const sortedPayments = sortPaymentsByTime(payments);

  if (sortedPayments.length === 0) return <EmptyState text="Sin pagos registrados para hoy" positive />;

  return (
    <>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#FAFBFC" }}>
            {[
              { label: "Hora",    align: "left"  as const, w: "72px"  },
              { label: "Paciente",align: "left"  as const, w: "auto"  },
              { label: "Monto",   align: "right" as const, w: "110px" },
              { label: "Estado",  align: "left"  as const, w: "96px"  },
              { label: "Medio",   align: "left"  as const, w: "110px" },
              { label: "",        align: "right" as const, w: "120px" },
            ].map(({ label, align, w }, i) => (
              <th key={i} style={{
                padding: i === 0 ? "8px 8px 8px 20px" : "8px 12px",
                textAlign: align, fontSize: 9.5, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: C.textMuted, fontFamily: FONT_SANS, whiteSpace: "nowrap", width: w,
              }}>
                {label}
              </th>
            ))}
          </tr>
          <tr><td colSpan={6} style={{ padding: 0, height: 1, background: C.border }} /></tr>
        </thead>
        <tbody>
          {sortedPayments.map((p, idx) => {
            const isConfirming = loadingId === p.id;
            const showAction   = needsAction(p);

            return (
              <React.Fragment key={p.id}>
                <tr
                  style={{ background: "transparent", transition: "background 0.12s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFBFC")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "11px 8px 11px 20px", whiteSpace: "nowrap" }}>
                    <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: C.electric }}>{p.time}</span>
                  </td>
                  <td style={{ padding: "11px 12px", minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.patient_surname}, {p.patient_name}
                    </span>
                    <span style={{ display: "block", fontFamily: FONT_SANS, fontSize: 11, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.service_name}
                    </span>
                  </td>
                  <td style={{ padding: "11px 12px", whiteSpace: "nowrap", textAlign: "right" }}>
                    <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{formatCurrency(p.amount)}</span>
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <Badge status={p.payment_status} map={PAYMENT_BADGE} />
                  </td>
                  <td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT_SANS, fontSize: 12, fontWeight: 500, color: p.payment_method === "CASH" ? "#166534" : "#1E40AF" }}>
                      {p.payment_method === "CASH" ? (
                        <><span style={{ display: "flex" }}>{Icon.cash}</span>Efectivo</>
                      ) : (
                        <><span style={{ display: "flex" }}>{Icon.link}</span>Mercado Pago</>
                      )}
                    </span>
                  </td>
                  <td style={{ padding: "11px 20px 11px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {showAction ? (
                      <button className="ver-btn" onClick={() => handleOpenModal(p)} disabled={isConfirming} style={{ marginLeft: 0, color: C.electric }}>
                        Confirmar pago
                      </button>
                    ) : p.has_receipt ? (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#065F46", fontFamily: FONT_SANS, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {Icon.checkSmall} Comprobante
                      </span>
                    ) : null}
                  </td>
                </tr>
                {idx < sortedPayments.length - 1 && (
                  <tr><td colSpan={6} style={{ padding: 0, height: 1, background: "#F3F4F6" }} /></tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {modalPayment && (
        <ConfirmCashModal
          payment={modalPayment}
          onConfirm={handleConfirm}
          onCancel={handleCloseModal}
          isLoading={loadingId === modalPayment.id}
          error={confirmError}
        />
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// CANCELLED APPOINTMENTS TODAY
// ════════════════════════════════════════════════════════════════
function CancelledAppointmentsToday({ preloadedCancelled }: { preloadedCancelled: CancelledAppointment[] }) {
  const [expanded, setExpanded] = useState(true);
  const [items,    setItems]    = useState<CancelledAppointment[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [fetched,  setFetched]  = useState(false);

  const handleToggle = async () => {
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && !fetched) {
      setLoading(true);
      try {
        const res = await apiClient.get("/api/dashboard/cancelled/today");
        const raw = res.data;
        setItems(Array.isArray(raw) ? raw : (raw.details ?? []));
      } catch {
        setItems(preloadedCancelled);
      } finally {
        setLoading(false);
        setFetched(true);
      }
    }
  };

  const displayItems = fetched ? items : preloadedCancelled;
  const count        = preloadedCancelled.length;

  return (
    <>
      <div style={{ padding: "18px 20px 14px" }}>
        <div onClick={handleToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS }}>Turnos cancelados hoy</span>
            <span style={{ background: count > 0 ? "#FEE2E2" : "#F3F4F6", color: count > 0 ? "#B91C1C" : C.textMuted, fontSize: 10.5, fontWeight: 700, borderRadius: 100, padding: "1px 8px", letterSpacing: "0.02em" }}>
              {count}
            </span>
          </div>
          <span style={{ color: C.textMuted, display: "flex", alignItems: "center", transition: "transform 0.2s", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5l3 3 3-3"/></svg>
          </span>
        </div>
      </div>

      <Divider />

      {expanded && (
        <div style={{ padding: "4px 12px 8px" }}>
          {loading ? (
            <div style={{ padding: "24px 0", textAlign: "center", fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Cargando...</div>
          ) : displayItems.length === 0 ? (
            <EmptyState text="No hubo cancelaciones hoy" positive />
          ) : (
            displayItems.map((a, idx) => {
              const motivoTexto = a.reason_for_cancellation?.trim() || CANCELLED_BY_LABEL[a.cancelled_by] || "Cancelado";
              return (
                <div key={a.id_appointment}>
                  <div className="alerta-row">
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#9CA3AF", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, fontFamily: FONT_SANS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.patient_surname}, {a.patient_name}
                      </p>
                      <p style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT_SANS, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.time} · {motivoTexto}
                      </p>
                    </div>
                  </div>
                  {idx < displayItems.length - 1 && <div style={{ height: 1, background: "#F3F4F6" }} />}
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// HOOK — useDashboardData
// ════════════════════════════════════════════════════════════════
function useDashboardData(intervalMs = POLL_INTERVAL_MS) {
  const [summary,   setSummary]   = useState<any>(null);
  const [proximos,  setProximos]  = useState<any[]>([]);
  const [payments,  setPayments]  = useState<PaymentTodayResponse[]>([]);
  const [cancelled, setCancelled] = useState<CancelledAppointment[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [summaryError,   setSummaryError]   = useState(false);
  const [appoError,      setAppoError]      = useState(false);

  const fetchAll = useCallback(async () => {
    const [summaryRes, appoRes, paymentsRes, cancelledRes] = await Promise.allSettled([
      apiClient.get("/api/dashboard/summary"),
      apiClient.get("/api/appointments/day"),
      apiClient.get("/api/payments/today"),
      apiClient.get("/api/dashboard/cancelled/today"),
    ]);
    if (summaryRes.status === "fulfilled")  { setSummary(summaryRes.value.data); setSummaryError(false); } else { setSummaryError(true); }
    if (appoRes.status === "fulfilled")     { setProximos(appoRes.value.data); setAppoError(false); }      else { setAppoError(true); }
    if (paymentsRes.status === "fulfilled") { setPayments(paymentsRes.value.data as PaymentTodayResponse[]); }
    if (cancelledRes.status === "fulfilled") {
      const raw = cancelledRes.value.data;
      setCancelled(Array.isArray(raw) ? raw : (raw.details ?? []));
    }
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, intervalMs);
    return () => clearInterval(timer);
  }, [fetchAll, intervalMs]);

  const updatePayment = useCallback((updated: PaymentTodayResponse) => {
    setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  return { summary, proximos, setProximos, payments, cancelled, initialLoading, summaryError, appoError, refetch: fetchAll, updatePayment };
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD HOME
// ════════════════════════════════════════════════════════════════
const TURN_GRID = "52px 1fr 106px 170px";
type ActionState = "loading" | "done" | "error";

function DashboardHome({ userProfile }: { userProfile: any }) {
  const [now, setNow] = useState(new Date());
  const [actionStates, setActionStates] = useState<Record<number, ActionState>>({});

  const { summary, proximos, setProximos, payments, cancelled, initialLoading, summaryError, appoError, refetch, updatePayment } = useDashboardData();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const handleAction = useCallback(async (appointmentId: number, endpoint: string, nextStatus: string) => {
    setActionStates((prev) => ({ ...prev, [appointmentId]: "loading" }));
    try {
      await apiClient.patch(`/api/appointments/${endpoint}/${appointmentId}`);
      setProximos((prev) => prev.map((t) => t.id === appointmentId ? { ...t, status: nextStatus } : t));
      setActionStates((prev) => ({ ...prev, [appointmentId]: "done" }));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        await refetch();
        setActionStates((prev) => { const n = { ...prev }; delete n[appointmentId]; return n; });
      } else {
        setActionStates((prev) => ({ ...prev, [appointmentId]: "error" }));
        setTimeout(() => {
          setActionStates((prev) => { const n = { ...prev }; delete n[appointmentId]; return n; });
        }, 3_000);
      }
    }
  }, [refetch, setProximos]);

  const handleAdmit          = useCallback((id: number) => handleAction(id, "admit",           "ADMITTED"),    [handleAction]);
  const handleStartAttention = useCallback((id: number) => handleAction(id, "start-attention", "IN_ATTENTION"), [handleAction]);
  const handleComplete       = useCallback((id: number) => handleAction(id, "complete",         "COMPLETED"),   [handleAction]);

  if (initialLoading) {
    return (
      <div style={{ minHeight: "100%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textMuted }}>Cargando...</span>
      </div>
    );
  }

  const isApptStillAhead = (dateStr: string) => {
    if (!dateStr) return false;
    const timePart = dateStr.includes("T") ? dateStr.split("T")[1] : dateStr;
    const [apptH, apptM] = timePart.split(":").map(Number);
    return apptH > now.getHours() || (apptH === now.getHours() && apptM > now.getMinutes());
  };

  const hayTurnosHoy      = proximos.length > 0;
  const hayProximoVigente = !!summary?.nextAppointment && isApptStillAhead(summary.nextAppointment.date);
  const horaProximo       = hayProximoVigente ? extractTime(summary.nextAppointment.date) : hayTurnosHoy ? "—" : null;
  const subProximo        = hayProximoVigente
    ? `${summary.nextAppointment.patient_name} ${summary.nextAppointment.patient_surname}`
    : hayTurnosHoy ? "Todos los turnos finalizaron" : "Sin turnos para hoy";

  const nombreDoctor    = userProfile ? `Dr. ${userProfile.name} ${userProfile.surname}` : "—";
  const clinicaLabel    = userProfile ? userProfile.clinicName.toUpperCase() : "";
  const saludo          = getSaludo(now.getHours());
  const fechaFormateada = now.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" }).replace(/^\w/, (c) => c.toUpperCase());
  const horaFormateada  = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const totalPendientes = payments.filter((p) => p.payment_status === "PENDING" || p.payment_status === "PARTIAL").length;

  return (
    <div style={{ minHeight: "100%", background: C.bg, padding: "32px 36px" }}>
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 28, fontWeight: 400, color: C.textPrimary, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            {saludo}, <span style={{ fontWeight: 500 }}>{nombreDoctor}</span>
          </h1>
          <p style={{ marginTop: 6, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textMuted, fontFamily: FONT_SANS }}>
            {clinicaLabel}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS, letterSpacing: "-0.02em", lineHeight: 1 }}>{horaFormateada}</p>
          <p style={{ marginTop: 5, fontSize: 11.5, color: C.textSecondary, fontFamily: FONT_SANS, textTransform: "capitalize" }}>{fechaFormateada}</p>
        </div>
      </div>

      {/* ── MÉTRICAS ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <MetricCard label="Ingresos del día"  value={summaryError ? "—" : formatCurrency(summary?.dailyIncome ?? 0)}   sub="Pagos confirmados hoy" />
        <MetricCard label="Ingresos del mes"  value={summaryError ? "—" : formatCurrency(summary?.monthlyIncome ?? 0)} sub={`${now.toLocaleDateString("es-AR", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())} ${now.getFullYear()}`} />
        <MetricCard label="Turnos hoy"        value={summaryError ? "—" : summary?.appointmentsToday ?? 0}             sub="Agendados para hoy" />
        <MetricCard label="Próximo turno"     value={horaProximo ?? "—"}                                               sub={subProximo} accent />
      </div>

      {/* ── TRES COLUMNAS ── */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ┌── COL 1: TURNOS DEL DÍA ── */}
        <ColumnCard flex="0 0 35%">
          <div style={{ padding: "18px 20px 14px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS }}>Turnos del día</span>
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT_SANS }}>Siguientes atenciones</span>
            </div>
          </div>
          <Divider />
          <div style={{ display: "grid", gridTemplateColumns: TURN_GRID, alignItems: "center", padding: "8px 20px", background: "#FAFBFC", gap: 0 }}>
            {[{ label: "Hora", justify: "flex-start" }, { label: "Paciente", justify: "flex-start" }, { label: "Estado", justify: "flex-start" }, { label: "", justify: "flex-end" }].map(({ label, justify }, i) => (
              <span key={i} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textMuted, fontFamily: FONT_SANS, display: "flex", justifyContent: justify, paddingRight: i === 2 ? 8 : 0 }}>
                {label}
              </span>
            ))}
          </div>
          <Divider />
          <div style={{ padding: "4px 16px 0" }}>
            {appoError ? (
              <EmptyState text="Error al cargar los turnos" />
            ) : proximos.length === 0 ? (
              <EmptyState text="Sin turnos pendientes para hoy" />
            ) : (
              proximos.map((t: any, idx: number) => {
                const estadoActual = t.status as string;
                const canAdmit    = !NON_ADMITTABLE.has(estadoActual);
                const apptId      = t.id as number;
                const actionState = actionStates[apptId];
                const isActing    = actionState === "loading";
                const hasError    = actionState === "error";
                const isDone      = actionState === "done";

                return (
                  <React.Fragment key={apptId}>
                    <div className="turn-row" style={{ display: "grid", gridTemplateColumns: TURN_GRID, alignItems: "center", gap: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.electric, fontFamily: FONT_SANS, whiteSpace: "nowrap" }}>
                        {extractTime(t.time)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, fontFamily: FONT_SANS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                        {t.patient_surname}, {t.patient_name}
                      </span>
                      <span style={{ paddingRight: 8 }}>
                        <Badge status={estadoActual} map={APPOINTMENT_BADGE} />
                      </span>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 25 }}>
                        {canAdmit && (
                          <button
                            className="btn-admitir"
                            disabled={isActing}
                            onClick={() => handleAdmit(apptId)}
                            style={{
                              opacity: isActing ? 0.65 : 1,
                              ...(hasError ? { background: "#FEF2F2", color: "#B91C1C", borderColor: "#FECACA" } :
                                  isDone   ? { background: "#ECFDF5", color: "#065F46", borderColor: "#86EFAC" } :
                                             { background: C.electric, color: "#FFFFFF", borderColor: C.electric }),
                            }}
                          >
                            {isActing ? <><span className="btn-spinner" />Admitiendo</> : hasError ? <>⚠ Reintentar</> : isDone ? <>{Icon.checkSmall} Admitido</> : <>Admitir</>}
                          </button>
                        )}
                        {estadoActual === "ADMITTED" && (
                          <button
                            className="btn-admitir"
                            disabled={isActing}
                            onClick={() => handleStartAttention(apptId)}
                            style={{ opacity: isActing ? 0.65 : 1, ...(hasError ? { background: "#FEF2F2", color: "#B91C1C", borderColor: "#FECACA" } : { background: C.electric, color: "#FFFFFF", borderColor: C.electric }) }}
                          >
                            {isActing ? <><span className="btn-spinner" />Iniciando</> : hasError ? <>⚠ Reintentar</> : <>En atención</>}
                          </button>
                        )}
                        {estadoActual === "IN_ATTENTION" && (
                          <button
                            className="btn-admitir"
                            disabled={isActing}
                            onClick={() => handleComplete(apptId)}
                            style={{ opacity: isActing ? 0.65 : 1, ...(hasError ? { background: "#FEF2F2", color: "#B91C1C", borderColor: "#FECACA" } : { background: "#059669", color: "#FFFFFF", borderColor: "#059669" }) }}
                          >
                            {isActing ? <><span className="btn-spinner" />Completando</> : hasError ? <>⚠ Reintentar</> : <>Completado</>}
                          </button>
                        )}
                        <button className="btn-ver">Ver {Icon.arrowRight}</button>
                      </div>
                    </div>
                    {idx < proximos.length - 1 && <div style={{ height: 1, background: "#F3F4F6" }} />}
                  </React.Fragment>
                );
              })
            )}
          </div>
          {!appoError && proximos.length > 0 && (
            <>
              <div style={{ height: 8 }} />
              <Divider />
              <div style={{ padding: "12px 20px" }}>
                <button className="btn-ver" style={{ color: C.textSecondary }}>Ver agenda completa →</button>
              </div>
            </>
          )}
        </ColumnCard>

        {/* ┌── COL 2: PAGOS DEL DÍA ── */}
        <ColumnCard flex="1">
          <div style={{ padding: "18px 24px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS }}>Pagos del día</span>
                <span style={{ background: payments.length > 0 ? "#EFF6FF" : "#F3F4F6", color: payments.length > 0 ? C.electric : C.textMuted, fontSize: 10.5, fontWeight: 700, borderRadius: 100, padding: "1px 8px" }}>
                  {payments.length}
                </span>
                {totalPendientes > 0 && (
                  <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10.5, fontWeight: 700, borderRadius: 100, padding: "1px 7px" }}>
                    {totalPendientes} pendiente{totalPendientes > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 10.5, color: C.textMuted, fontFamily: FONT_SANS, marginTop: 3 }}>Todos los pagos asociados a turnos de hoy</p>
            </div>
          </div>
          <Divider />
          <PaymentsTodayTable payments={payments} onPaymentConfirmed={updatePayment} />
          {payments.length > 0 && (
            <>
              <Divider />
              <div style={{ padding: "10px 24px" }}>
                <button className="btn-ver" style={{ color: C.textSecondary }}>Ver en Finanzas → Pagos →</button>
              </div>
            </>
          )}
        </ColumnCard>

        {/* ┌── COL 3: TURNOS CANCELADOS HOY ── */}
        <ColumnCard flex="0 0 20%">
          <CancelledAppointmentsToday preloadedCancelled={cancelled} />
        </ColumnCard>

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TOP BAR
// ════════════════════════════════════════════════════════════════
const ALL_NAV_LABELS: Record<string, string> = {
  home:                   "Inicio",
  productos:              "Productos y Servicios",
  pacientes:              "Pacientes",
  "agendas-list":         "Mis agendas",
  "agendas-create":       "Nueva agenda",
  "turnos-otorgar":       "Otorgar turno",
  "turnos-admision":      "Admisión",
  "finanzas-resumen":     "Resumen",
  "finanzas-pagos":       "Pagos",
  "finanzas-tratamientos":"Tratamientos",
  "crear-turno":          "Nuevo turno",
  "turno-detail":         "Detalle del turno",
  "pacientes-create":     "Nuevo paciente",
};

function TopBar({ activeSection, userProfile }: { activeSection: string; userProfile: any }) {
  const label        = ALL_NAV_LABELS[activeSection] ?? "Inicio";
  const displayName  = userProfile ? `Dr. ${userProfile.name} ${userProfile.surname}` : "—";
  const displayClinic = userProfile ? userProfile.clinicName : "";
  const initials     = userProfile ? buildInitials(userProfile.name, userProfile.surname) : null;

  return (
    <div style={{
      height: 60, background: C.cardBg, borderBottom: `1px solid ${C.sidebarBorder}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", position: "sticky", top: 0, zIndex: 9,
    }}>
      <span style={{ fontFamily: FONT_SANS, fontSize: 13.5, fontWeight: 500, color: C.textSecondary }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: FONT_SANS, fontSize: 12.5, fontWeight: 600, color: C.textPrimary, lineHeight: 1.2 }}>{displayName}</p>
          <p style={{ fontFamily: FONT_SANS, fontSize: 10.5, color: C.textMuted, marginTop: 1 }}>{displayClinic}</p>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: initials ? C.electric : C.border, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_SANS, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", flexShrink: 0 }}>
          {initials}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD LAYOUT — uses DentifySidebar
// ════════════════════════════════════════════════════════════════
function DashboardLayout({ children, activeSection, onNavigate, collapsed, onToggleCollapse, userProfile, hideTopBar }: {
  children: React.ReactNode;
  activeSection: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  userProfile: any;
  hideTopBar?: boolean;
}) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <DentifySidebar
        activeItem={activeSection}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {!hideTopBar && <TopBar activeSection={activeSection} userProfile={userProfile} />}
        <main style={{ flex: 1, overflowY: "auto", background: C.bg }}>
          {children}
        </main>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const navigate = useNavigate();
  const [activeSection,       setActiveSection]       = useState("home");
  const [collapsed,           setCollapsed]           = useState(false);
  const [slotContext,         setSlotContext]         = useState<SelectedSlotContext | null>(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState<number | null>(null);
  const [userProfile,         setUserProfile]         = useState<{ name: string; surname: string; clinicName: string; roles: string[] } | null>(null);

  useEffect(() => {
    apiClient.get("/api/users/me")
      .then((res) => setUserProfile(res.data))
      .catch(() => {});
  }, []);

  const handleSlotSelected = useCallback((context: SelectedSlotContext) => {
    setSlotContext(context);
    setActiveSection("crear-turno");
  }, []);

  const handleAppointmentSelected = useCallback((appointmentId: number) => {
    setActiveAppointmentId(appointmentId);
  }, []);

  const handleNavigate = useCallback((sectionId: string) => {
    if (sectionId === "finanzas-resumen" || sectionId === "finanzas") {
      navigate("/dentist/payments/resumen");
    } else if (sectionId === "finanzas-pagos") {
      navigate("/dentist/payments/pagos");
    } else {
      setActiveSection(sectionId);
    }
  }, [navigate]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { font-family: ${FONT_SANS}; -webkit-font-smoothing: antialiased; }

        nav::-webkit-scrollbar { width: 4px; }
        nav::-webkit-scrollbar-track { background: transparent; }
        nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        .turn-row { padding: 10px 4px; cursor: default; transition: background 0.15s; border-radius: 6px; }
        .turn-row:hover { background: #F8F9FB; }

        .alerta-row { display: flex; align-items: center; gap: 12px; padding: 12px 4px; cursor: default; border-radius: 6px; transition: background 0.15s; }
        .alerta-row:hover { background: #F8F9FB; }

        .btn-admitir {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 6px;
          border: 1.5px solid ${C.electric}; background: ${C.electric}; color: #FFFFFF;
          font-family: ${FONT_SANS}; font-size: 11.5px; font-weight: 600;
          letter-spacing: 0.02em; cursor: pointer; white-space: nowrap;
          transition: opacity 0.15s, background 0.15s, border-color 0.15s, box-shadow 0.15s;
          line-height: 1;
        }
        .btn-admitir:hover:not(:disabled) { opacity: 0.88; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .btn-admitir:disabled { cursor: default; }

        .btn-ver {
          display: inline-flex; align-items: center; gap: 4px; color: ${C.textMuted};
          font-size: 11.5px; font-weight: 500; font-family: ${FONT_SANS};
          letter-spacing: 0.01em; background: none; border: none;
          cursor: pointer; padding: 5px 6px; border-radius: 4px;
          transition: background 0.15s, color 0.15s; white-space: nowrap; line-height: 1;
        }
        .btn-ver:hover { background: #F3F4F6; color: ${C.textSecondary}; }

        .ver-btn {
          margin-left: auto; display: flex; align-items: center; gap: 4px; color: ${C.electric};
          font-size: 11.5px; font-weight: 600; font-family: ${FONT_SANS};
          letter-spacing: 0.02em; background: none; border: none;
          cursor: pointer; padding: 4px 8px; border-radius: 4px;
          transition: background 0.15s, color 0.15s; white-space: nowrap;
        }
        .ver-btn:hover:not(:disabled) { background: #EFF6FF; }
        .ver-btn:disabled { cursor: default; }

        @keyframes backdropFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalScaleIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }

        .modal-spinner, .btn-spinner {
          width: 11px; height: 11px;
          border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
          border-radius: 50%; animation: spin 0.65s linear infinite; flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <DashboardLayout
        activeSection={activeSection}
        onNavigate={handleNavigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        userProfile={userProfile}
        hideTopBar={activeSection === "agendas-list" || activeSection === "agendas-create"}
      >
        {activeSection === "turnos-otorgar" && (
          <OtorgarTurnoView onNavigate={setActiveSection} userProfile={userProfile} onSlotSelected={handleSlotSelected} onAppointmentSelected={handleAppointmentSelected} />
        )}
        {activeSection === "crear-turno" && (
          <CrearTurnoView onNavigate={setActiveSection} userProfile={userProfile} slotContext={slotContext} onAppointmentCreated={(resp) => { setActiveAppointmentId(resp.id_appointment); }} />
        )}
        {activeSection === "turno-detail" && activeAppointmentId !== null && (
          <TurnoDetailView onNavigate={setActiveSection} userProfile={userProfile} appointmentId={activeAppointmentId} />
        )}
        {activeSection === "turnos-admision" && (
          <AdmisionView onNavigate={setActiveSection} userProfile={userProfile} onAppointmentSelected={handleAppointmentSelected} />
        )}
        {activeSection === "home" && <DashboardHome userProfile={userProfile} />}
        {activeSection === "productos" && (
          <ProductsView onNavigate={setActiveSection} userProfile={userProfile} />
        )}
        {activeSection === "agendas-list" && (
          <div style={{ padding: "32px 36px", boxSizing: "border-box", width: "100%" }}>
            <AgendaListView onNavigate={setActiveSection} userProfile={userProfile} />
          </div>
        )}
        {activeSection === "agendas-create" && (
          <div style={{ padding: "32px 36px", boxSizing: "border-box", width: "100%" }}>
            <AgendaCreateView onNavigate={setActiveSection} userProfile={userProfile} />
          </div>
        )}
        {activeSection === "pacientes" && (
          <PacientesListView onNavigate={setActiveSection} userProfile={userProfile} />
        )}
        {activeSection === "pacientes-create" && (
          <CreatePatientView onNavigate={setActiveSection} />
        )}

        {activeSection !== "home" &&
          activeSection !== "productos" &&
          activeSection !== "productos-edit" &&
          activeSection !== "agendas-list" &&
          activeSection !== "agendas-create" &&
          activeSection !== "turnos-otorgar" &&
          activeSection !== "crear-turno" &&
          activeSection !== "turno-detail" &&
          activeSection !== "turnos-admision" &&
          activeSection !== "pacientes" &&
          activeSection !== "pacientes-create" && (
            <div style={{ padding: "48px 36px", color: C.textMuted, fontFamily: FONT_SANS, fontSize: 13 }}>
              Vista <strong style={{ color: C.textPrimary }}>{activeSection}</strong> — pendiente de implementación.
            </div>
          )}
      </DashboardLayout>
    </>
  );
}