import { useState, useEffect, useCallback, useRef } from "react";
import React from "react";
import apiClient from "../../api/apiClient";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS — mirror del sistema Dentify
// ════════════════════════════════════════════════════════════════
const C = {
  navy:          "#0F2244",
  navyMid:       "#1A2B4A",
  electric:      "#2563EB",
  electricLight: "#EFF6FF",
  bg:            "#F4F5F7",
  cardBg:        "#FFFFFF",
  border:        "#E4E6EC",
  textPrimary:   "#111827",
  textSecondary: "#6B7280",
  textMuted:     "#9CA3AF",
  success:       "#10B981",
  danger:        "#DC2626",
  dangerLight:   "#FEF2F2",
  dangerBorder:  "#FECACA",
  dangerText:    "#991B1B",
};
const FONT_SANS = "'DM Sans', sans-serif";

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════
interface SpecialityOption {
  id: number;
  nameSpeciality: string;
}

interface ProductFormData {
  nameProduct:  string;
  unitPrice:    string;
  idSpeciality: number | null;
  description:  string;
  active:       boolean;
}

interface FieldErrors {
  nameProduct?:  string;
  unitPrice?:    string;
  idSpeciality?: string;
}

interface BulkRowErrors {
  nameProduct?:  string;
  unitPrice?:    string;
  idSpeciality?: string;
}

type CreationMode = "single" | "bulk";

interface ProductCreateViewProps {
  onNavigate:   (section: string) => void;
  userProfile?: any;
  onClose?:     () => void;
  onSuccess?:   () => void;
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
const emptyRow = (): ProductFormData => ({
  nameProduct:  "",
  unitPrice:    "",
  idSpeciality: null,
  description:  "",
  active:       true,
});

const formatPrice = (val: string): string => {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
};

// ════════════════════════════════════════════════════════════════
// ICONS
// ════════════════════════════════════════════════════════════════
const IcPlus = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M7 2v10M2 7h10"/>
  </svg>
);
const IcTrash = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 4.5h11M6 4.5V3h4v1.5M5.5 4.5l.5 8h4l.5-8"/>
  </svg>
);
const IcAlert = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2L1.5 14h13L8 2z"/>
    <path d="M8 7v3M8 12v.5"/>
  </svg>
);
const IcCheck = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8l4 4 6-6"/>
  </svg>
);
const IcChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3L5 8l5 5"/>
  </svg>
);
const IcSpinner = () => (
  <span style={{
    display: "inline-block",
    width: 12, height: 12,
    border: "2px solid rgba(255,255,255,0.35)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "pcSpin 0.65s linear infinite",
    flexShrink: 0,
  }} />
);
const IcPackage = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4l-6-2-6 2v8l6 2 6-2V4z"/>
    <path d="M4 4l6 2 6-2M10 6v8"/>
  </svg>
);
const IcLayers = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 7l8-4 8 4-8 4-8-4z"/>
    <path d="M2 12l8 4 8-4M2 9.5l8 4 8-4"/>
  </svg>
);

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
      textTransform: "uppercase" as const,
      color: C.textMuted,
      marginBottom: 6,
    }}>
      {text}
      {required && <span style={{ color: C.electric, marginLeft: 2 }}>*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{
      fontFamily: FONT_SANS,
      fontSize: 11,
      color: C.danger,
      margin: "4px 0 0",
      display: "flex",
      alignItems: "center",
      gap: 4,
    }}>
      {msg}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: FONT_SANS,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: C.textMuted,
      margin: "0 0 20px",
    }}>
      {children}
    </h3>
  );
}

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}
function InputField({ error, style, onFocus, onBlur, ...rest }: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); onBlur?.(e); }}
      style={{
        width: "100%",
        padding: "10px 14px",
        border: `1.5px solid ${error ? "#FCA5A5" : focused ? C.electric : C.border}`,
        borderRadius: 8,
        fontFamily: FONT_SANS,
        fontSize: 13.5,
        color: C.textPrimary,
        background: "#FFFFFF",
        outline: "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxSizing: "border-box" as const,
        boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.07)" : "none",
        ...style,
      }}
    />
  );
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}
function SelectField({ error, style, onFocus, onBlur, ...rest }: SelectFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); onBlur?.(e); }}
      style={{
        width: "100%",
        padding: "10px 14px",
        border: `1.5px solid ${error ? "#FCA5A5" : focused ? C.electric : C.border}`,
        borderRadius: 8,
        fontFamily: FONT_SANS,
        fontSize: 13.5,
        color: rest.value ? C.textPrimary : C.textMuted,
        background: "#FFFFFF",
        outline: "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxSizing: "border-box" as const,
        boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.07)" : "none",
        cursor: "pointer",
        appearance: "none" as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%239CA3AF' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' fill='none'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: 36,
        ...style,
      }}
    />
  );
}

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}
function TextareaField({ error, style, onFocus, onBlur, ...rest }: TextareaFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); onBlur?.(e); }}
      style={{
        width: "100%",
        padding: "10px 14px",
        border: `1.5px solid ${error ? "#FCA5A5" : focused ? C.electric : C.border}`,
        borderRadius: 8,
        fontFamily: FONT_SANS,
        fontSize: 13.5,
        color: C.textPrimary,
        background: "#FFFFFF",
        outline: "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxSizing: "border-box" as const,
        boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.07)" : "none",
        resize: "vertical" as const,
        minHeight: 80,
        ...style,
      }}
    />
  );
}

// ════════════════════════════════════════════════════════════════
// SUCCESS TOAST
// ════════════════════════════════════════════════════════════════
function SuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed",
      bottom: 32,
      right: 32,
      background: C.navyMid,
      color: "#FFFFFF",
      fontFamily: FONT_SANS,
      fontSize: 13,
      fontWeight: 500,
      padding: "13px 20px",
      borderRadius: 9,
      display: "flex",
      alignItems: "center",
      gap: 10,
      boxShadow: "0 8px 24px rgba(15,34,68,0.22)",
      zIndex: 9999,
      animation: "pcToastIn 0.25s ease",
    }}>
      <span style={{
        width: 22, height: 22,
        borderRadius: "50%",
        background: C.success,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <IcCheck />
      </span>
      {message}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ACTIVE TOGGLE — inline botones Activo / Inactivo
// ════════════════════════════════════════════════════════════════
function ActiveToggle({
  value,
  onChange,
}: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {([{ v: true, label: "Activo" }, { v: false, label: "Inactivo" }] as const).map(({ v, label }) => {
        const selected = value === v;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(v)}
            style={{
              padding: "8px 18px",
              borderRadius: 7,
              border: `1.5px solid ${selected ? C.navyMid : C.border}`,
              background: selected ? C.navyMid : "#FFFFFF",
              color: selected ? "#FFFFFF" : C.textSecondary,
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.12s",
              whiteSpace: "nowrap" as const,
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
// SINGLE FORM FIELDS (reutilizado también dentro de bulk rows)
// ════════════════════════════════════════════════════════════════
interface SingleFormProps {
  data:          ProductFormData;
  errors:        FieldErrors;
  specialities:  SpecialityOption[];
  onChange:      (data: ProductFormData) => void;
}

function SingleForm({ data, errors, specialities, onChange }: SingleFormProps) {
  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <>
      {/* ── Fila 1: Nombre + Precio ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: 20,
        marginBottom: 20,
      }}>
        <div>
          <FieldLabel text="Nombre del producto" required />
          <InputField
            type="text"
            value={data.nameProduct}
            onChange={(e) => set("nameProduct", e.target.value)}
            placeholder="Ej: Consulta periodontal"
            maxLength={120}
            error={!!errors.nameProduct}
          />
          <FieldError msg={errors.nameProduct} />
        </div>
        <div>
          <FieldLabel text="Precio unitario (ARS)" required />
          <InputField
            type="number"
            value={data.unitPrice}
            onChange={(e) => set("unitPrice", e.target.value)}
            placeholder="0.00"
            min="0.1"
            step="0.01"
            error={!!errors.unitPrice}
            style={{ fontVariantNumeric: "tabular-nums" }}
          />
          <FieldError msg={errors.unitPrice} />
        </div>
      </div>

      {/* ── Fila 2: Especialidad ── */}
      <div style={{ marginBottom: 20 }}>
        <FieldLabel text="Especialidad" required />
        <SelectField
          value={data.idSpeciality ?? ""}
          onChange={(e) => set("idSpeciality", e.target.value ? Number(e.target.value) : null)}
          error={!!errors.idSpeciality}
        >
          <option value="">Seleccionar especialidad</option>
          {specialities.map((s) => (
            <option key={s.id} value={s.id}>{s.nameSpeciality}</option>
          ))}
        </SelectField>
        <FieldError msg={errors.idSpeciality} />
      </div>

      {/* ── Fila 3: Descripción ── */}
      <div style={{ marginBottom: 24 }}>
        <FieldLabel text="Descripción (opcional)" />
        <TextareaField
          value={data.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Descripción breve del producto o servicio..."
          maxLength={300}
          rows={3}
        />
        <p style={{
          fontFamily: FONT_SANS,
          fontSize: 10.5,
          color: C.textMuted,
          marginTop: 4,
          textAlign: "right" as const,
        }}>
          {data.description.length}/300
        </p>
      </div>

      {/* ── Fila 4: Estado ── */}
      <div>
        <FieldLabel text="Estado del producto" required />
        <ActiveToggle value={data.active} onChange={(v) => set("active", v)} />
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// BULK ROW — fila compacta para carga masiva
// ════════════════════════════════════════════════════════════════
interface BulkRowProps {
  index:        number;
  data:         ProductFormData;
  errors:       BulkRowErrors;
  specialities: SpecialityOption[];
  canDelete:    boolean;
  onChange:     (i: number, data: ProductFormData) => void;
  onDelete:     (i: number) => void;
}

function BulkRow({ index, data, errors, specialities, canDelete, onChange, onDelete }: BulkRowProps) {
  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) =>
    onChange(index, { ...data, [k]: v });

  const hasError = !!(errors.nameProduct || errors.unitPrice || errors.idSpeciality);

  return (
    <div style={{
      background: hasError ? "#FFFBFB" : "#FAFBFC",
      border: `1px solid ${hasError ? "#FECACA" : C.border}`,
      borderRadius: 8,
      padding: "16px 20px",
      marginBottom: 10,
      transition: "border-color 0.15s",
    }}>
      {/* Header de la fila */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
      }}>
        <span style={{
          fontFamily: FONT_SANS,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color: C.textMuted,
        }}>
          Producto {index + 1}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Active toggle compacto */}
          <div style={{ display: "flex", gap: 5 }}>
            {([{ v: true, label: "Activo" }, { v: false, label: "Inactivo" }] as const).map(({ v, label }) => {
              const sel = data.active === v;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => set("active", v)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 5,
                    border: `1.5px solid ${sel ? C.navyMid : C.border}`,
                    background: sel ? C.navyMid : "#FFFFFF",
                    color: sel ? "#FFFFFF" : C.textSecondary,
                    fontFamily: FONT_SANS,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(index)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "none",
                border: "none",
                color: C.textMuted,
                fontFamily: FONT_SANS,
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 4,
                transition: "color 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
            >
              <IcTrash /> Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Campos en grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 0.8fr 1fr 1.2fr",
        gap: 14,
      }}>
        {/* Nombre */}
        <div>
          <FieldLabel text="Nombre" required />
          <InputField
            type="text"
            value={data.nameProduct}
            onChange={(e) => set("nameProduct", e.target.value)}
            placeholder="Nombre del producto"
            maxLength={120}
            error={!!errors.nameProduct}
            style={{ fontSize: 12.5, padding: "8px 12px" }}
          />
          <FieldError msg={errors.nameProduct} />
        </div>
        {/* Precio */}
        <div>
          <FieldLabel text="Precio (ARS)" required />
          <InputField
            type="number"
            value={data.unitPrice}
            onChange={(e) => set("unitPrice", e.target.value)}
            placeholder="0.00"
            min="0.1"
            step="0.01"
            error={!!errors.unitPrice}
            style={{ fontSize: 12.5, padding: "8px 12px" }}
          />
          <FieldError msg={errors.unitPrice} />
        </div>
        {/* Especialidad */}
        <div>
          <FieldLabel text="Especialidad" required />
          <SelectField
            value={data.idSpeciality ?? ""}
            onChange={(e) => set("idSpeciality", e.target.value ? Number(e.target.value) : null)}
            error={!!errors.idSpeciality}
            style={{ fontSize: 12.5, padding: "8px 28px 8px 12px" }}
          >
            <option value="">Seleccionar</option>
            {specialities.map((s) => (
              <option key={s.id} value={s.id}>{s.nameSpeciality}</option>
            ))}
          </SelectField>
          <FieldError msg={errors.idSpeciality} />
        </div>
        {/* Descripción */}
        <div>
          <FieldLabel text="Descripción (opcional)" />
          <InputField
            type="text"
            value={data.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Descripción breve..."
            maxLength={300}
            style={{ fontSize: 12.5, padding: "8px 12px" }}
          />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// VALIDATION
// ════════════════════════════════════════════════════════════════
function validateSingle(data: ProductFormData): FieldErrors {
  const e: FieldErrors = {};
  if (!data.nameProduct.trim())
    e.nameProduct = "El nombre es requerido";
  else if (data.nameProduct.trim().length < 2)
    e.nameProduct = "Mínimo 2 caracteres";

  const price = parseFloat(data.unitPrice);
  if (!data.unitPrice || isNaN(price))
    e.unitPrice = "Ingresá un precio válido";
  else if (price <= 0)
    e.unitPrice = "El precio debe ser mayor a 0";

  if (!data.idSpeciality)
    e.idSpeciality = "Seleccioná una especialidad";

  return e;
}

function validateBulk(rows: ProductFormData[]): BulkRowErrors[] {
  return rows.map((r) => {
    const e: BulkRowErrors = {};
    if (!r.nameProduct.trim())
      e.nameProduct = "Requerido";
    else if (r.nameProduct.trim().length < 2)
      e.nameProduct = "Mín. 2 caracteres";

    const price = parseFloat(r.unitPrice);
    if (!r.unitPrice || isNaN(price))
      e.unitPrice = "Precio inválido";
    else if (price <= 0)
      e.unitPrice = "> 0";

    if (!r.idSpeciality)
      e.idSpeciality = "Requerido";

    return e;
  });
}

function hasErrors(errs: BulkRowErrors[]): boolean {
  return errs.some((e) => Object.values(e).some(Boolean));
}

// ════════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════════
export function ProductCreateView({ onNavigate, onClose, onSuccess }: ProductCreateViewProps) {
  const [mode,         setMode]         = useState<CreationMode>("single");
  const [specialities, setSpecialities] = useState<SpecialityOption[]>([]);
  const [loadingSpec,  setLoadingSpec]  = useState(true);
  const [specError,    setSpecError]    = useState(false);

  // ── Single ──
  const [singleData,   setSingleData]   = useState<ProductFormData>(emptyRow());
  const [singleErrors, setSingleErrors] = useState<FieldErrors>({});

  // ── Bulk ──
  const [bulkRows,     setBulkRows]     = useState<ProductFormData[]>([emptyRow(), emptyRow()]);
  const [bulkErrors,   setBulkErrors]   = useState<BulkRowErrors[]>([{}, {}]);

  // ── Submit states ──
  const [isLoading,    setIsLoading]    = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [successMsg,   setSuccessMsg]   = useState<string | null>(null);

  // ── Fetch specialities ──
  const fetchSpecialities = useCallback(async () => {
    setLoadingSpec(true);
    setSpecError(false);
    try {
      const res = await apiClient.get("/api/specialities/find-all");
      const raw = Array.isArray(res.data) ? res.data : [];
      setSpecialities(
        raw.map((s: any) => ({
          id:             s.id,
          nameSpeciality: s.name,
        }))
      );
    } catch {
      setSpecError(true);
    } finally {
      setLoadingSpec(false);
    }
  }, []);

  useEffect(() => { fetchSpecialities(); }, [fetchSpecialities]);

  // ── Bulk row handlers ──
  const handleBulkChange = (i: number, data: ProductFormData) => {
    setBulkRows((prev) => prev.map((r, idx) => idx === i ? data : r));
  };

  const handleBulkDelete = (i: number) => {
    setBulkRows((prev) => prev.filter((_, idx) => idx !== i));
    setBulkErrors((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleBulkAdd = () => {
    if (bulkRows.length >= 50) return;
    setBulkRows((prev) => [...prev, emptyRow()]);
    setBulkErrors((prev) => [...prev, {}]);
  };

  // ── Submit single ──
  const handleSingleSubmit = async () => {
    setSubmitError(null);
    const errs = validateSingle(singleData);
    setSingleErrors(errs);
    if (Object.keys(errs).length) return;

    setIsLoading(true);
    try {
      await apiClient.post("/api/products/save", {
        nameProduct:  singleData.nameProduct.trim(),
        unitPrice:    parseFloat(singleData.unitPrice),
        idSpeciality: singleData.idSpeciality,
        description:  singleData.description.trim() || null,
        active:       singleData.active,
      });
      setSuccessMsg("Producto creado correctamente");
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
        else onNavigate("productos");
      }, 2200);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Error al guardar el producto. Intentá nuevamente.";
      setSubmitError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Submit bulk ──
  const handleBulkSubmit = async () => {
    setSubmitError(null);
    const errs = validateBulk(bulkRows);
    setBulkErrors(errs);
    if (hasErrors(errs)) return;

    setIsLoading(true);
    try {
      const payload = bulkRows.map((r) => ({
        nameProduct:  r.nameProduct.trim(),
        unitPrice:    parseFloat(r.unitPrice),
        idSpeciality: r.idSpeciality,
        description:  r.description.trim() || null,
        active:       r.active,
      }));
      await apiClient.post("/api/products/save/all", payload);
      setSuccessMsg(`${bulkRows.length} producto${bulkRows.length !== 1 ? "s" : ""} creados correctamente`);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
        else onNavigate("productos");
      }, 2200);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Error al guardar los productos. Verificá los datos e intentá nuevamente.";
      setSubmitError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Preview calculado ──
  const singlePriceFormatted =
    singleData.unitPrice && !isNaN(parseFloat(singleData.unitPrice))
      ? formatPrice(singleData.unitPrice)
      : null;

  const bulkValid = bulkRows.filter(
    (r) => r.nameProduct.trim() && parseFloat(r.unitPrice) > 0 && r.idSpeciality
  ).length;

  return (
    <>
      <style>{`
        @keyframes pcSpin    { to { transform: rotate(360deg); } }
        @keyframes pcToastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── TOAST ── */}
      {successMsg && (
        <SuccessToast message={successMsg} onDone={() => setSuccessMsg(null)} />
      )}

      <div style={{ padding: "32px 40px 80px", background: C.bg, minHeight: "100%" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* ══ HEADER ══ */}
          <div style={{ marginBottom: 28 }}>
            <button
              onClick={() => onNavigate("productos")}
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
                padding: "0 0 12px",
                transition: "color 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
            >
              <IcChevronLeft />
              Volver a Productos
            </button>

            <h1 style={{
              fontFamily: FONT_SANS,
              fontSize: 22,
              fontWeight: 700,
              color: C.textPrimary,
              margin: "0 0 4px",
              letterSpacing: "-0.01em",
            }}>
              Nuevo producto
            </h1>
            <p style={{
              fontFamily: FONT_SANS,
              fontSize: 13,
              color: C.textSecondary,
              margin: 0,
            }}>
              Agregá uno o varios productos al catálogo de tu clínica.
            </p>
          </div>

          {/* ══ MODE SWITCHER ══ */}
          <div style={{
            display: "inline-flex",
            background: "#FFFFFF",
            border: `1px solid ${C.border}`,
            borderRadius: 9,
            padding: 4,
            gap: 4,
            marginBottom: 24,
          }}>
            {([
              { key: "single" as const, icon: <IcPackage />, label: "Un producto"       },
              { key: "bulk"   as const, icon: <IcLayers  />, label: "Carga masiva"       },
            ]).map(({ key, icon, label }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setMode(key); setSubmitError(null); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: "none",
                    background: active ? C.navyMid : "transparent",
                    color: active ? "#FFFFFF" : C.textSecondary,
                    fontFamily: FONT_SANS,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {icon}
                  {label}
                </button>
              );
            })}
          </div>

          {/* ══ SPECIALITY ERROR BANNER ══ */}
          {specError && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: C.dangerLight,
              border: `1px solid ${C.dangerBorder}`,
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
              fontFamily: FONT_SANS,
              fontSize: 12.5,
              color: C.dangerText,
            }}>
              <IcAlert />
              No se pudieron cargar las especialidades.{" "}
              <button
                onClick={fetchSpecialities}
                style={{
                  background: "none", border: "none",
                  color: C.electric, fontFamily: FONT_SANS,
                  fontSize: 12.5, fontWeight: 600,
                  cursor: "pointer", textDecoration: "underline", padding: 0,
                }}
              >
                Reintentar
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════
              MODO SINGLE
          ══════════════════════════════════════ */}
          {mode === "single" && (
            <>
              {/* Sección principal del formulario */}
              <div style={{
                background: C.cardBg,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "28px 32px",
                marginBottom: 20,
              }}>
                <SectionTitle>Datos del producto</SectionTitle>

                {loadingSpec ? (
                  <SpecialitySkeleton />
                ) : (
                  <SingleForm
                    data={singleData}
                    errors={singleErrors}
                    specialities={specialities}
                    onChange={setSingleData}
                  />
                )}
              </div>

              {/* Preview card si hay precio válido */}
              {singlePriceFormatted && singleData.nameProduct.trim() && (
                <div style={{
                  background: "#F0F4FF",
                  border: `1px solid #DBEAFE`,
                  borderRadius: 10,
                  padding: "16px 24px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div>
                    <p style={{
                      fontFamily: FONT_SANS,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase" as const,
                      color: "#3B4FBA",
                      margin: "0 0 3px",
                    }}>
                      Vista previa
                    </p>
                    <p style={{
                      fontFamily: FONT_SANS,
                      fontSize: 14,
                      fontWeight: 600,
                      color: C.textPrimary,
                      margin: 0,
                    }}>
                      {singleData.nameProduct.trim()}
                    </p>
                    {singleData.description && (
                      <p style={{
                        fontFamily: FONT_SANS,
                        fontSize: 11.5,
                        color: C.textSecondary,
                        margin: "2px 0 0",
                      }}>
                        {singleData.description}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                    <p style={{
                      fontFamily: FONT_SANS,
                      fontSize: 17,
                      fontWeight: 700,
                      color: C.navy,
                      margin: "0 0 2px",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {singlePriceFormatted}
                    </p>
                    <span style={{
                      display: "inline-block",
                      background: singleData.active ? "#D1FAE5" : "#FEE2E2",
                      color: singleData.active ? "#065F46" : "#991B1B",
                      fontFamily: FONT_SANS,
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 100,
                      padding: "2px 8px",
                      letterSpacing: "0.04em",
                    }}>
                      {singleData.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════
              MODO BULK
          ══════════════════════════════════════ */}
          {mode === "bulk" && (
            <div style={{
              background: C.cardBg,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "28px 32px",
              marginBottom: 20,
            }}>
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 20,
              }}>
                <div>
                  <SectionTitle>Carga masiva de productos</SectionTitle>
                  <p style={{
                    fontFamily: FONT_SANS,
                    fontSize: 12.5,
                    color: C.textSecondary,
                    marginTop: -12,
                    lineHeight: 1.5,
                  }}>
                    Agregá hasta <strong>50 productos</strong> en una sola operación.
                    {bulkRows.length > 0 && (
                      <span style={{ color: C.textMuted, marginLeft: 6 }}>
                        ({bulkRows.length}/{50} filas · {bulkValid} listos para guardar)
                      </span>
                    )}
                  </p>
                </div>
                <span style={{
                  background: "#F0F4FF",
                  color: "#3B4FBA",
                  fontFamily: FONT_SANS,
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 100,
                  padding: "4px 12px",
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  {bulkRows.length} fila{bulkRows.length !== 1 ? "s" : ""}
                </span>
              </div>

              {loadingSpec ? (
                <SpecialitySkeleton />
              ) : (
                <>
                  {bulkRows.map((row, i) => (
                    <BulkRow
                      key={i}
                      index={i}
                      data={row}
                      errors={bulkErrors[i] ?? {}}
                      specialities={specialities}
                      canDelete={bulkRows.length > 1}
                      onChange={handleBulkChange}
                      onDelete={handleBulkDelete}
                    />
                  ))}

                  {bulkRows.length < 50 && (
                    <button
                      type="button"
                      onClick={handleBulkAdd}
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
                        marginTop: 4,
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.electricLight)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
                    >
                      <IcPlus /> Agregar producto
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══ ERROR BANNER GLOBAL ══ */}
          {submitError && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: C.dangerLight,
                border: `1px solid ${C.dangerBorder}`,
                borderRadius: 8,
                padding: "13px 16px",
                marginBottom: 20,
                color: C.dangerText,
                fontFamily: FONT_SANS,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <span style={{ flexShrink: 0, display: "flex" }}><IcAlert /></span>
              {submitError}
            </div>
          )}

          {/* ══ ACTIONS ══ */}
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            paddingTop: 4,
          }}>
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                else onNavigate("productos");
              }}
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
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => !isLoading && (e.currentTarget.style.background = "#F9FAFB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={mode === "single" ? handleSingleSubmit : handleBulkSubmit}
              disabled={isLoading || loadingSpec}
              style={{
                padding: "11px 28px",
                borderRadius: 7,
                border: "none",
                background: isLoading ? "#93C5FD" : C.navyMid,
                color: "#FFFFFF",
                fontFamily: FONT_SANS,
                fontSize: 13,
                fontWeight: 600,
                cursor: isLoading || loadingSpec ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                opacity: isLoading || loadingSpec ? 0.75 : 1,
                transition: "opacity 0.15s, background 0.15s",
              }}
            >
              {isLoading ? (
                <><IcSpinner /> Guardando...</>
              ) : mode === "single" ? (
                <>Guardar producto →</>
              ) : (
                <>Guardar {bulkRows.length} producto{bulkRows.length !== 1 ? "s" : ""} →</>
              )}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// SKELETON mientras cargan especialidades
// ════════════════════════════════════════════════════════════════
function SpecialitySkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
      <style>{`
        @keyframes skPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .sk { animation: skPulse 1.6s ease-in-out infinite; background: #E9EBEE; border-radius: 6px; }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <div><div style={{ height: 10, width: 80, marginBottom: 8 }} className="sk" /><div style={{ height: 42 }} className="sk" /></div>
        <div><div style={{ height: 10, width: 80, marginBottom: 8 }} className="sk" /><div style={{ height: 42 }} className="sk" /></div>
      </div>
      <div><div style={{ height: 10, width: 80, marginBottom: 8 }} className="sk" /><div style={{ height: 42 }} className="sk" /></div>
      <div><div style={{ height: 10, width: 80, marginBottom: 8 }} className="sk" /><div style={{ height: 80 }} className="sk" /></div>
    </div>
  );
}