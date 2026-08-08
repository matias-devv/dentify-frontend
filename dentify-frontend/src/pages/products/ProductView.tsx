import { useState, useEffect, useMemo, useCallback } from "react";
import React from "react";
import apiClient from "../../api/apiClient";
import { ProductCreateView } from "./ProductCreateView";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS (from Figma)
// ════════════════════════════════════════════════════════════════
const T = {
  bgPrimary:      "#F4F3F0",
  bgWhite:        "#FFFFFF",
  bgLight:        "#F8F8F6",
  bgDark:         "#0A1628",
  accentPrimary:  "#1A6FD4",
  accentBright:   "#4A9EE8",
  navyMid:        "#1A2B4A",
  textPrimary:    "#0A1628",
  textSecondary:  "#5A6A7A",
  textMuted:      "#6A7A8A",
  borderLight:    "#EAEAE6",
  borderPanel:    "#E8EFF6",
};

const SERIF = "'Playfair Display', serif";
const SANS = "'DM Sans', sans-serif";

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════
interface ProductResponse {
  id_product: number;
  name_product: string;
  unit_price: number | null;
  description: string | null;
  name_speciality: string;
  active?: boolean;
}

interface UserProfile {
  id?: number;
  name: string;
  surname: string;
  clinicName: string;
  clinicId?: number;
  roles: string[];
}

type StatusFilter = "all" | "active" | "inactive";

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

function getInitials(name?: string, surname?: string): string {
  const n = (name?.trim()?.[0] ?? "").toUpperCase();
  const s = (surname?.trim()?.[0] ?? "").toUpperCase();
  return `${n}${s}` || "—";
}

// ════════════════════════════════════════════════════════════════
// ICONS (inline SVG — stroke currentColor, strokeWidth 1.6)
// ════════════════════════════════════════════════════════════════
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="M15 15l-3-3" />
  </svg>
);

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13V4M6 8l4-4 4 4" />
    <path d="M3 15h14" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 4v9M6 10l4 4 4-4" />
    <path d="M3 15h14" />
  </svg>
);

const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 3.5a2.121 2.121 0 013 3L6 18H3v-3L14.5 3.5z" />
  </svg>
);

// ════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ════════════════════════════════════════════════════════════════
function SkeletonRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 160px 180px 52px", alignItems: "center", padding: "16px 28px", gap: 0 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.38}}.sk{animation:pulse 1.6s ease-in-out infinite;background:#EAEAE6;border-radius:4px}`}</style>
      <div style={{ paddingRight: 16 }}>
        <div className="sk" style={{ height: 12, width: "52%", marginBottom: 7 }} />
        <div className="sk" style={{ height: 10, width: "35%" }} />
      </div>
      <div><div className="sk" style={{ height: 22, width: 90, borderRadius: 4 }} /></div>
      <div style={{ display: "flex", justifyContent: "flex-start", paddingLeft: 24 }}>
        <div className="sk" style={{ height: 12, width: 68 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-start", paddingLeft: 24 }}>
        <div className="sk" style={{ height: 22, width: 68, borderRadius: 4 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div className="sk" style={{ height: 26, width: 26, borderRadius: 5 }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SPECIALTY BADGE
// ════════════════════════════════════════════════════════════════
function SpecialtyBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: "inline-block",
      background: "rgba(26,111,212,0.10)",
      border: "1px solid rgba(74,158,232,0.28)",
      color: T.accentBright,
      fontSize: 10.5,
      fontWeight: 600,
      borderRadius: 4,
      padding: "3px 8px",
      fontFamily: SANS,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      maxWidth: 160,
      overflow: "hidden",
      textOverflow: "ellipsis",
    }}>
      {label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// STATUS BADGE
// ════════════════════════════════════════════════════════════════
function StatusBadge({ active }: { active?: boolean }) {
  if (active === true) return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "rgba(16,185,129,0.08)",
      border: "1px solid rgba(16,185,129,0.22)",
      color: "#0D9B6B",
      fontSize: 10.5, fontWeight: 600,
      borderRadius: 4, padding: "3px 8px",
      fontFamily: SANS, letterSpacing: "0.06em", textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
      Activo
    </span>
  );
  if (active === false) return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "rgba(239,68,68,0.07)",
      border: "1px solid rgba(239,68,68,0.2)",
      color: "#C0392B",
      fontSize: 10.5, fontWeight: 600,
      borderRadius: 4, padding: "3px 8px",
      fontFamily: SANS, letterSpacing: "0.06em", textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EF4444", display: "inline-block" }} />
      Inactivo
    </span>
  );
  return (
    <span style={{
      display: "inline-block",
      background: T.bgLight, border: `1px solid ${T.borderLight}`,
      color: T.textMuted, fontSize: 10.5, fontWeight: 600,
      borderRadius: 4, padding: "3px 8px",
      fontFamily: SANS, letterSpacing: "0.06em", textTransform: "uppercase",
    }}>
      —
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// EMPTY STATE
// ════════════════════════════════════════════════════════════════
function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: "64px 0", textAlign: "center", fontFamily: SANS }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: T.bgLight,
        border: `1px solid ${T.borderLight}`,
        margin: "0 auto 16px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 6v4M10 13v.5" /><circle cx="10" cy="10" r="7.5" />
        </svg>
      </div>
      <p style={{ fontSize: 13, fontWeight: 300, color: T.textMuted, margin: 0 }}>{text}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PAGE HEADER (Figma) — eyebrow + título serif + subtítulo
// ════════════════════════════════════════════════════════════════
function PageHeader({
  eyebrow, title, subtitle,
}: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div>
      <div style={{
        fontFamily: SANS,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: T.accentPrimary,
        marginBottom: 6,
      }}>
        {eyebrow}
      </div>
      <h1 style={{
        fontFamily: SERIF,
        fontSize: 26,
        fontWeight: 600,
        color: T.textPrimary,
        margin: 0,
        lineHeight: 1.2,
      }}>
        {title}
      </h1>
      {subtitle && (
        <div style={{
          fontFamily: SANS,
          fontSize: 12.5,
          fontWeight: 300,
          color: T.textSecondary,
          marginTop: 5,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// USER INFO BLOCK
// ════════════════════════════════════════════════════════════════
function UserInfoBlock({ userProfile }: { userProfile?: UserProfile | null }) {
  const fullName = userProfile
    ? `${userProfile.name} ${userProfile.surname}`.trim()
    : "";
  const clinicName = userProfile?.clinicName ?? "";
  const initials = getInitials(userProfile?.name, userProfile?.surname);

  if (!userProfile) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: T.textPrimary }}>
          {fullName}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 300, color: T.textMuted }}>
          {clinicName}
        </div>
      </div>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: T.accentPrimary, color: "#FFFFFF",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: SANS, fontSize: 13, fontWeight: 700,
        flexShrink: 0,
      }}>
        {initials}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// VIEW HEADER ROW
// ════════════════════════════════════════════════════════════════
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
// PILL TOGGLE
// ════════════════════════════════════════════════════════════════
function PillToggle({ value, onChange }: { value: StatusFilter; onChange: (v: StatusFilter) => void }) {
  const opts: { v: StatusFilter; label: string }[] = [
    { v: "all",      label: "Todos" },
    { v: "active",   label: "Activos" },
    { v: "inactive", label: "Inactivos" },
  ];
  return (
    <div style={{
      display: "inline-flex",
      background: T.bgLight,
      border: `1px solid ${T.borderLight}`,
      borderRadius: 7,
      padding: 3,
      gap: 2,
    }}>
      {opts.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            fontFamily: SANS, fontSize: 12.5, fontWeight: value === o.v ? 600 : 400,
            padding: "6px 14px",
            borderRadius: 5,
            border: "none",
            background: value === o.v ? T.navyMid : "transparent",
            color: value === o.v ? "#FFFFFF" : T.textMuted,
            boxShadow: value === o.v ? "0 1px 3px rgba(10,22,40,0.08)" : "none",
            cursor: "pointer",
            transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PRODUCT ROW
// ════════════════════════════════════════════════════════════════
function ProductRow({
  product,
  onNavigate,
}: {
  product: ProductResponse;
  onNavigate: (section: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editHov, setEditHov] = useState(false);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 200px 160px 180px 52px",
        alignItems: "center",
        padding: "15px 28px",
        background: hovered ? T.bgLight : "transparent",
        transition: "background 0.12s",
        cursor: "default",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* NAME + DESC */}
      <div style={{ minWidth: 0, paddingRight: 20 }}>
        <p style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: T.textPrimary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {product.name_product}
        </p>
        {product.description && (
          <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 300, color: T.textMuted, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {product.description}
          </p>
        )}
      </div>

      {/* SPECIALTY */}
      <div>
        <SpecialtyBadge label={product.name_speciality} />
      </div>

      {/* PRICE — alineado a la izquierda, en línea con el header de la columna */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: 24,
          minWidth: 0,
        }}
      >
        <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
          {product.unit_price !== null && product.unit_price !== undefined
            ? formatCurrency(Number(product.unit_price))
            : "—"}
        </span>
      </div>

      {/* STATUS */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: 24,
          minWidth: 0,
        }}
      >
        <StatusBadge active={product.active} />
      </div>

      {/* EDIT */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button
          onClick={() => onNavigate("productos-edit")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30,
            borderRadius: 6,
            border: editHov ? `1px solid ${T.borderPanel}` : "1px solid transparent",
            background: editHov ? T.bgWhite : "transparent",
            color: editHov ? T.accentPrimary : T.textSecondary,
            cursor: "pointer",
            transition: "all 0.12s",
          }}
          onMouseEnter={() => setEditHov(true)}
          onMouseLeave={() => setEditHov(false)}
          title="Editar producto"
        >
          <PencilIcon />
        </button>
      </div>
    </div>
  );
}

export function ProductsView({
  onNavigate,
  userProfile,
}: {
  onNavigate: (section: string) => void;
  userProfile?: UserProfile | null;
}) {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // ── FETCH ──
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiClient.get("/api/products/find-all");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── FILTRADO CLIENT-SIDE ──
  const filteredProducts = useMemo(() =>
    products
      .filter((p) =>
        statusFilter === "all" ? true :
        statusFilter === "active" ? p.active === true :
        p.active === false
      )
      .filter((p) =>
        searchTerm.length === 0
          ? true
          : p.name_product.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [products, searchTerm, statusFilter]
  );

  // ── CONTEOS ──
  const activeCount = products.filter(p => p.active === true).length;
  const inactiveCount = products.filter(p => p.active === false).length;

  // ── RENDER: ERROR ──
  if (error) {
    return (
      <div style={{ flex: 1, minHeight: "100vh", background: T.bgPrimary, display: "flex", flexDirection: "column", padding: "32px 40px" }}>
        <div style={{
          background: T.bgWhite, border: `1px solid ${T.borderPanel}`,
          borderRadius: 10, padding: "48px 0", textAlign: "center",
        }}>
          <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 16, fontFamily: SANS }}>
            No se pudieron cargar los productos.
          </p>
          <button
            onClick={fetchProducts}
            style={{
              padding: "8px 20px", borderRadius: 7,
              border: `1px solid ${T.borderPanel}`,
              background: T.bgWhite, color: T.textSecondary,
              fontFamily: SANS, fontSize: 12.5, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const TABLE_COLS = "1fr 200px 160px 180px 52px";
  // ── HEADER_COLS: "align" y "paddingLeft" deben calzar EXACTO con la celda de datos
  //    correspondiente en ProductRow. Precio y Estado usan alineación a la izquierda
  //    con paddingLeft:24 en la data, así que el header replica lo mismo.
  const HEADER_COLS = [
    { label: "NOMBRE",          align: "left" as const, paddingLeft: 0  },
    { label: "ESPECIALIDAD",    align: "left" as const, paddingLeft: 0  },
    { label: "PRECIO UNITARIO", align: "left" as const, paddingLeft: 24 },
    { label: "ESTADO",          align: "left" as const, paddingLeft: 24 },
    { label: "",                align: "center" as const, paddingLeft: 0 },
  ];

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: T.bgPrimary, display: "flex", flexDirection: "column" }}>

      {/* ── CONTENIDO ── */}
      <div style={{ flex: 1, padding: "32px 40px" }}>

        {/* ── HEADER sin topbar ── */}
        <ViewHeaderRow
          eyebrow="Catálogo Comercial"
          title="Productos y Servicios"
          subtitle={`Catálogo de prestaciones · ${activeCount} activos · ${inactiveCount} inactivos`}
          userProfile={userProfile}
        />

        {/* ── TOOLBAR ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>

          {/* Botón + Producto (con color navyMid) */}
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 18px",
              borderRadius: 6, border: "none",
              background: T.navyMid, color: "#FFFFFF",
              fontFamily: SANS, fontSize: 13, fontWeight: 500,
              letterSpacing: "0.01em",
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Producto
          </button>

          {/* Search */}
          <div style={{ position: "relative", flex: 1, maxWidth: 340, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none", display: "flex" }}>
              <SearchIcon />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar producto..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: "100%",
                padding: "9px 14px 9px 34px",
                border: `1.5px solid ${searchFocused ? T.accentPrimary : T.borderPanel}`,
                borderRadius: 6,
                fontFamily: SANS, fontSize: 13, color: T.textPrimary,
                background: T.bgWhite,
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
                boxShadow: searchFocused ? "0 0 0 3px rgba(26,111,212,0.08)" : "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Status pill toggle */}
          <PillToggle value={statusFilter} onChange={setStatusFilter} />

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Secondary: Import / Export */}
          {[
            { icon: <UploadIcon />, label: "Importar" },
            { icon: <DownloadIcon />, label: "Exportar" },
          ].map(({ icon, label }) => (
            <button
              key={label}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 14px",
                borderRadius: 6,
                border: `1.5px solid ${T.borderPanel}`,
                background: T.bgWhite,
                color: T.textSecondary,
                fontFamily: SANS, fontSize: 12.5, fontWeight: 400,
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                transition: "background 0.12s, border-color 0.12s",
              }}
              onClick={() => console.log(`${label} — endpoint no implementado`)}
              onMouseEnter={e => { e.currentTarget.style.background = T.bgLight; e.currentTarget.style.borderColor = "#D4DDE8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.bgWhite; e.currentTarget.style.borderColor = T.borderPanel; }}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{
          background: T.bgWhite,
          border: `1px solid ${T.borderPanel}`,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 2px 20px rgba(10,22,40,0.06)",
        }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: TABLE_COLS,
            alignItems: "center",
            background: T.bgLight,
            padding: "0 28px",
            borderBottom: `1px solid ${T.borderLight}`,
          }}>
            {HEADER_COLS.map(({ label, align, paddingLeft }, i) => (
              <div
                key={i}
                style={{
                  padding: "11px 0",
                  paddingLeft,
                  paddingRight: i < 2 ? 20 : 0,
                  textAlign: align,
                  fontFamily: SANS,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: T.textMuted,
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Loading */}
          {loading && [...Array(5)].map((_, i) => (
            <div key={i}>
              <SkeletonRow />
              {i < 4 && <div style={{ height: 1, background: T.borderLight, margin: "0 28px" }} />}
            </div>
          ))}

          {/* Empty states */}
          {!loading && products.length === 0 && <EmptyState text="No hay productos registrados aún." />}
          {!loading && products.length > 0 && filteredProducts.length === 0 && <EmptyState text="Sin productos que coincidan con la búsqueda." />}

          {/* Rows */}
          {!loading && filteredProducts.map((product, idx) => (
            <div key={product.id_product}>
              <ProductRow product={product} onNavigate={onNavigate} />
              {idx < filteredProducts.length - 1 && (
                <div style={{ height: 1, background: T.borderLight, margin: "0 28px" }} />
              )}
            </div>
          ))}
        </div>

        {/* Footer count */}
        {!loading && filteredProducts.length > 0 && (
          <p style={{
            fontFamily: SANS, fontSize: 11.5, fontWeight: 300,
            color: T.textMuted, margin: "12px 0 0 2px",
          }}>
            {filteredProducts.length} producto{filteredProducts.length !== 1 ? "s" : ""}
            {searchTerm || statusFilter !== "all" ? " encontrados" : " en total"}
          </p>
        )}
      </div>

      {/* ── MODAL ProductCreateView ── */}
      {showCreateForm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.4)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          zIndex: 1000,
          overflow: "auto",
          paddingTop: 20,
          paddingBottom: 20,
        }}>
          <div style={{
            background: T.bgPrimary,
            borderRadius: 10,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            maxWidth: 1000,
            width: "90%",
            maxHeight: "90vh",
            overflow: "auto",
          }}>
            <ProductCreateView
              onNavigate={onNavigate}
              userProfile={userProfile}
              onClose={() => setShowCreateForm(false)}
              onSuccess={() => {
                setShowCreateForm(false);
                fetchProducts();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}