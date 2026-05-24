import { useState } from "react";
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
      {
        id: "mis-agendas",
        label: "Mis agendas",
        icon: <CalendarCheck size={14} strokeWidth={1.5} />,
      },
      {
        id: "nueva-agenda",
        label: "Nueva agenda",
        icon: <CalendarPlus size={14} strokeWidth={1.5} />,
      },
    ],
  },
  {
    id: "turnos",
    label: "Turnos",
    icon: <Clock size={18} strokeWidth={1.5} />,
    children: [
      {
        id: "otorgar-turno",
        label: "Otorgar turno",
        icon: <ClipboardList size={14} strokeWidth={1.5} />,
      },
      {
        id: "admision",
        label: "Admisión",
        icon: <UserCheck size={14} strokeWidth={1.5} />,
      },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    icon: <Landmark size={18} strokeWidth={1.5} />,
    children: [
      {
        id: "resumen",
        label: "Resumen",
        icon: <BarChart3 size={14} strokeWidth={1.5} />,
      },
      {
        id: "pagos",
        label: "Pagos",
        icon: <CreditCard size={14} strokeWidth={1.5} />,
      },
      {
        id: "tratamientos",
        label: "Tratamientos",
        icon: <Stethoscope size={14} strokeWidth={1.5} />,
      },
    ],
  },
];

type TooltipProps = {
  label: string;
  children: React.ReactNode;
  visible: boolean;
};

function NavTooltip({ label, children, visible }: TooltipProps) {
  const [show, setShow] = useState(false);
  if (!visible) return <>{children}</>;
  return (
    <div
      className="relative"
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
            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <div
              style={{
                background: "#1a2d45",
                border: "1px solid rgba(96,165,250,0.15)",
                color: "#c9d8ef",
                fontSize: "12px",
                fontWeight: 500,
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
                padding: "5px 10px",
                borderRadius: "6px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
              }}
            >
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DentifySidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState("inicio");
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(["agendas"])
  );

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (id: string, parentId?: string) => {
    setActiveItem(id);
    if (parentId && collapsed) {
      setOpenGroups((prev) => new Set([...prev, parentId]));
      setCollapsed(false);
    }
  };

  const isActive = (id: string) => activeItem === id;
  const isParentActive = (item: NavItem) =>
    item.children?.some((c) => c.id === activeItem) || activeItem === item.id;

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
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 0 16px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          paddingLeft: collapsed ? 0 : "20px",
          paddingRight: collapsed ? 0 : "14px",
        }}
      >
        <AnimatePresence initial={false} mode="wait">
          {!collapsed ? (
            <motion.div
              key="logo-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex", alignItems: "center", gap: "10px" }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 0 12px rgba(59,130,246,0.35)",
                }}
              >
                <Activity size={16} strokeWidth={2} color="#fff" />
              </div>
              <div>
                <div
                  style={{
                    color: "#e8edf5",
                    fontSize: "16px",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                  }}
                >
                  Dentify
                </div>
                <div
                  style={{
                    color: "#4a6485",
                    fontSize: "10px",
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    lineHeight: 1,
                  }}
                >
                  Clinical Suite
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="logo-icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 12px rgba(59,130,246,0.35)",
              }}
            >
              <Activity size={16} strokeWidth={2} color="#fff" />
            </motion.div>
          )}
        </AnimatePresence>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            style={{
              width: 28,
              height: 28,
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              color: "#4a6485",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.07)";
              (e.currentTarget as HTMLButtonElement).style.color = "#8aadce";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.03)";
              (e.currentTarget as HTMLButtonElement).style.color = "#4a6485";
            }}
          >
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}>
          <button
            onClick={() => setCollapsed(false)}
            style={{
              width: 28,
              height: 28,
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              color: "#4a6485",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.07)";
              (e.currentTarget as HTMLButtonElement).style.color = "#8aadce";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.03)";
              (e.currentTarget as HTMLButtonElement).style.color = "#4a6485";
            }}
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: collapsed ? "12px 0" : "12px 10px",
          scrollbarWidth: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {NAV_ITEMS.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openGroups.has(item.id);
            const parentActive = isParentActive(item);
            const selfActive = isActive(item.id);

            return (
              <div key={item.id}>
                <NavTooltip
                  label={item.label}
                  visible={collapsed}
                >
                  <NavItemRow
                    item={item}
                    collapsed={collapsed}
                    active={selfActive}
                    parentActive={parentActive && !selfActive}
                    hasChildren={hasChildren}
                    isOpen={isOpen}
                    onClick={() => {
                      if (hasChildren) {
                        if (!collapsed) toggleGroup(item.id);
                        else handleSelect(item.id, item.id);
                      } else {
                        handleSelect(item.id);
                      }
                    }}
                  />
                </NavTooltip>

                {/* Submenu */}
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
                        <div style={{ paddingTop: "2px", paddingBottom: "2px" }}>
                          {item.children!.map((child) => (
                            <SubItemRow
                              key={child.id}
                              item={child}
                              active={isActive(child.id)}
                              onClick={() => handleSelect(child.id)}
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
      <div
        style={{
          margin: collapsed ? "0 12px" : "0 10px",
          height: "1px",
          background: "rgba(255,255,255,0.05)",
        }}
      />

      {/* Footer actions */}
      <div
        style={{
          padding: collapsed ? "12px 0" : "12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        <NavTooltip label="Ajustes" visible={collapsed}>
          <FooterButton
            icon={<Settings size={18} strokeWidth={1.5} />}
            label="Ajustes"
            collapsed={collapsed}
          />
        </NavTooltip>
        <NavTooltip label="Cerrar sesión" visible={collapsed}>
          <FooterButton
            icon={<LogOut size={18} strokeWidth={1.5} />}
            label="Cerrar sesión"
            collapsed={collapsed}
            danger
          />
        </NavTooltip>
      </div>
    </motion.aside>
  );
}

type NavItemRowProps = {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  parentActive: boolean;
  hasChildren?: boolean;
  isOpen?: boolean;
  onClick: () => void;
};

function NavItemRow({
  item,
  collapsed,
  active,
  parentActive,
  hasChildren,
  isOpen,
  onClick,
}: NavItemRowProps) {
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
        gap: "10px",
        padding: collapsed ? "10px 0" : "9px 10px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: "7px",
        background: getBg(),
        border: "none",
        cursor: "pointer",
        transition: "background 0.15s ease",
        textAlign: "left",
      }}
    >
      {/* Active indicator bar */}
      {active && !collapsed && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: "3px",
            height: "60%",
            borderRadius: "0 3px 3px 0",
            background: "linear-gradient(180deg, #60a5fa, #3b82f6)",
            boxShadow: "0 0 8px rgba(96,165,250,0.4)",
          }}
        />
      )}

      {/* Icon with glow for active collapsed */}
      <div
        style={{
          color: getIconColor(),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "color 0.15s ease",
          ...(active && collapsed
            ? {
                filter: "drop-shadow(0 0 6px rgba(96,165,246,0.5))",
              }
            : {}),
        }}
      >
        {item.icon}
      </div>

      {/* Label & chevron */}
      {!collapsed && (
        <>
          <span
            style={{
              flex: 1,
              fontSize: "13px",
              fontWeight: active ? 500 : 400,
              letterSpacing: "0.005em",
              color: getTextColor(),
              transition: "color 0.15s ease",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
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

      {/* Collapsed active dot */}
      {active && collapsed && (
        <div
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: "#60a5fa",
            boxShadow: "0 0 6px rgba(96,165,250,0.7)",
          }}
        />
      )}
    </button>
  );
}

type SubItemRowProps = {
  item: NavSubItem;
  active: boolean;
  onClick: () => void;
};

function SubItemRow({ item, active, onClick }: SubItemRowProps) {
  const [hovered, setHovered] = useState(false);

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
        gap: "8px",
        padding: "7px 10px 7px 32px",
        borderRadius: "6px",
        background: active
          ? "rgba(59,130,246,0.10)"
          : hovered
          ? "rgba(255,255,255,0.03)"
          : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.15s ease",
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            left: 18,
            top: "50%",
            transform: "translateY(-50%)",
            width: "2px",
            height: "50%",
            borderRadius: "2px",
            background: "#3b82f6",
            opacity: 0.9,
          }}
        />
      )}
      <div
        style={{
          color: active ? "#60a5fa" : hovered ? "#6b90b3" : "#3f5570",
          display: "flex",
          alignItems: "center",
          transition: "color 0.15s ease",
        }}
      >
        {item.icon}
      </div>
      <span
        style={{
          fontSize: "12.5px",
          fontWeight: active ? 500 : 400,
          color: active ? "#c9ddf5" : hovered ? "#8aadce" : "#4a6485",
          letterSpacing: "0.005em",
          transition: "color 0.15s ease",
          whiteSpace: "nowrap",
        }}
      >
        {item.label}
      </span>
    </button>
  );
}

type FooterButtonProps = {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  danger?: boolean;
};

function FooterButton({ icon, label, collapsed, danger }: FooterButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: collapsed ? "9px 0" : "8px 10px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: "7px",
        background: hovered
          ? danger
            ? "rgba(239,68,68,0.08)"
            : "rgba(255,255,255,0.04)"
          : "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
    >
      <div
        style={{
          color: hovered
            ? danger
              ? "#f87171"
              : "#7ba4c8"
            : danger
            ? "#3f4f65"
            : "#3f5570",
          display: "flex",
          alignItems: "center",
          transition: "color 0.15s ease",
        }}
      >
        {icon}
      </div>
      {!collapsed && (
        <span
          style={{
            fontSize: "13px",
            fontWeight: 400,
            color: hovered
              ? danger
                ? "#f87171"
                : "#8aadce"
              : danger
              ? "#3f4f65"
              : "#4a6485",
            transition: "color 0.15s ease",
          }}
        >
          {label}
        </span>
      )}
    </button>
  );
}
