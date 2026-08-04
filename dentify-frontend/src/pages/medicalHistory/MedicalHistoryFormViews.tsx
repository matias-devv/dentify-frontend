// ════════════════════════════════════════════════════════════════════════════
// MedicalHistoryFormViews.tsx — "Historia Clínica General" — Dentify
//
// Contiene, en un único archivo (pedido explícito del Requirements.md §Anexo):
//   1) MedicalHistoryCreateView   — formulario de creación (§4 del doc)
//   2) MedicalHistoryDetailView   — vista de detalle post-guardado (§4.11)
//   3) Componentes auxiliares: Odontograma, modal "Cargar prestación",
//      modal "Cargar archivo", listado de "Registros".
//
// Decisiones tomadas explícitamente por la persona en Requirements.md §8,
// implementadas tal cual (no son inferencias propias):
//   #1  Odontograma Infantil/Mixto: se implementan las 3 grillas.
//   #2  Toggle "Tipo de prestación" del header: NO se renderiza (se quitó).
//   #3  "+ PRESTACIÓN" abre el modal vacío (sin pieza pre-seleccionada);
//       click en un diente abre el mismo modal con la pieza pre-cargada.
//   #8  Lápiz/tacho de "Registros" del formulario: edición/borrado 100% local,
//       no llaman a ningún endpoint.
//   #9  Modal "Cargar archivo": valida pdf/jpeg/png y ≤15MB; el archivo se
//       retiene en memoria y se sube recién tras el POST principal.
//   #10 Exámenes complementarios y Medicación diaria SÍ se muestran en el
//       detalle (si tienen datos); se omiten solo si están vacíos.
//   #11 Falla parcial de examen tras crear la historia: se redirige igual al
//       detalle, con un cartel rojo arriba a la derecha con el motivo exacto.
//   #12 "Editado por": si `editedBy` es null, no se muestra (ni el dato ni la
//       fila), incluso si el video del competidor lo mostraba siempre.
//   #15 Al marcar "No refiere alergias" el combo "Añadir alergias" desaparece
//       directamente (no queda visible-pero-ignorado).
//   #16 La creación de una nueva Historia Clínica General se oculta para
//       ROLE_SECRETARY.
//   #17 Se mantiene el copy ya implementado ("Paciente sin/con alergias
//       registradas"), no el del video de referencia.
//   #18 "Cancelar" descarta los datos y redirige al listado de historiales
//       de ese paciente.
//
// Lo explícitamente fuera de alcance (documento §1.3 / §8) NO se implementa:
//   - "Crear nuevo" diagnóstico personalizado (endpoint no-mvp).
//   - Edición de una MedicalHistory ya persistida (lápiz del detalle).
//   - Impresión.
// ════════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import apiClient from "../../api/apiClient";

// ════════════════════════════════════════════════════════════════
// DESIGN TOKENS — idénticos a HistorialClinicoView.tsx / PatientViews.tsx
// ════════════════════════════════════════════════════════════════
const C = {
  navy: "#0F2244",
  electric: "#2563EB",
  bg: "#F4F5F7",
  cardBg: "#FFFFFF",
  border: "#E4E6EC",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  activeItemBg: "#EFF6FF",
  errorBg: "#FEF2F2",
  errorBorder: "#FECACA",
  errorText: "#991B1B",
  errorIcon: "#EF4444",
  successBg: "#F0FDF4",
  successBorder: "#BBF7D0",
  successText: "#166534",
  warnBg: "#FFFBEB",
  warnBorder: "#FDE68A",
  warnText: "#92400E",
  warnIcon: "#D97706",
  infoBg: "#F9FAFB",
  infoBorder: "#E5E7EB",
  infoText: "#374151",
  preExisting: "#DC2626",
  required: "#2563EB",
} as const;

const FONT_SANS = "'DM Sans', sans-serif";

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════

export type OdontogramType = "ADULT" | "PEDIATRIC" | "MIX";
export type RecordType = "PRE_EXISTING" | "REQUIRED";
export type ToothFace =
  | "VESTIBULAR"
  | "PALATAL"
  | "DISTAL"
  | "MESIAL"
  | "INCISAL"
  | "WHOLE_TOOTH";

export type DiagnosisSymbol =
  | "ROOT_CANAL_TREATMENT"
  | "INCURABLE_TOOTH_DECAY"
  | "MISSING_TOOTH"
  | "SILICATE_FILLING"
  | "PARADENTOSIS"
  | "PERNO"
  | "BRIDGE"
  | "ORTHODONTICS"
  | "TREATABLE_DECAY"
  | "EXTRACTION"
  | "AMALGAM_FILLING"
  | "ACRYLIC_FILLING"
  | "CROWN"
  | "INLAY_ONLAY"
  | "REMOVABLE_PROSTHESIS"
  | "IMPLANT"
  | "CUSTOM";

export interface DiagnosisTypeCatalogResponse {
  id: number;
  name: string;
  symbol: DiagnosisSymbol;
  isGlobal: boolean;
  active: boolean;
}

export interface AllergyCatalogOption {
  id: number;
  name: string;
}

/** Ítem local del modal "Cargar prestación" — antes de persistir. */
export interface LocalToothRecordItem {
  tempId: string;
  pieceNumbers: number[];
  recordType: RecordType;
  face: ToothFace;
  diagnosisId: number;
  diagnosisName: string;
  diagnosisSymbol: DiagnosisSymbol;
  observations: string | null;
}

export interface PendingExamFile {
  tempId: string;
  file: File;
}

interface UserProfileShape {
  name: string;
  surname: string;
  clinicName: string;
  roles: string[];
}

// ── Response shapes (backend, camelCase ya deserializado por axios/jackson) ──
interface ToothRecordResponse {
  id: number;
  pieceNumber: number;
  recordType: string;
  face: string;
  observations: string | null;
  createdAt: string;
  diagnosisType: DiagnosisTypeCatalogResponse | null;
}

interface PatientAllergyDetailResponse {
  id: number;
  notes: string | null;
  allergyId: number;
  allergyName: string;
  isAllergyActive: boolean;
}

interface ComplementaryExamResponse {
  id: number;
  fileUrl: string;
  filename: string;
  fileType: string;
  uploadDate: string;
  uploadBy: { id: number; name: string; lastName: string } | null;
}

interface SimplePersonRef {
  id: number;
  fullName?: string;
  name?: string;
  surname?: string;
}

export interface MedicalHistoryDetailResponse {
  id: number;
  startDate: string;
  odontogramType: OdontogramType;
  pastMedicalHistory: string | null;
  observations: string | null;
  hasAllergies: boolean;
  dailyMedication: string | null;
  allergies: PatientAllergyDetailResponse[];
  toothRecords: ToothRecordResponse[];
  exams: ComplementaryExamResponse[];
  dentist: SimplePersonRef;
  editedBy: SimplePersonRef | null;
  createdAt: string;
  updatedAt: string;
}

// ════════════════════════════════════════════════════════════════
// GLYPHS — mapeo símbolo → glifo, tomado literalmente del Javadoc de
// DiagnosisSymbol (fuente de verdad de código real, no inferido) y
// confirmado visualmente en Imagen 2 ("REFERENCIAS ODONTOGRAMA").
// ════════════════════════════════════════════════════════════════
const SYMBOL_GLYPHS: Record<DiagnosisSymbol, string> = {
  ROOT_CANAL_TREATMENT: "TC",
  INCURABLE_TOOTH_DECAY: "■",
  MISSING_TOOTH: "X",
  SILICATE_FILLING: "/S",
  PARADENTOSIS: "Pd",
  PERNO: "P",
  BRIDGE: "⊓",
  ORTHODONTICS: "〰",
  TREATABLE_DECAY: "●",
  EXTRACTION: "=",
  AMALGAM_FILLING: "/A",
  ACRYLIC_FILLING: "/Ac",
  CROWN: "○",
  INLAY_ONLAY: "|",
  REMOVABLE_PROSTHESIS: "☐",
  IMPLANT: "IM",
  CUSTOM: "◆",
};

const RECORD_TYPE_LABEL: Record<RecordType, string> = {
  PRE_EXISTING: "Prestación Preexistente",
  REQUIRED: "Prestación Requerida",
};

const FACE_LABEL: Record<ToothFace, string> = {
  VESTIBULAR: "Vestibular",
  PALATAL: "Palatino",
  DISTAL: "Distal",
  MESIAL: "Mesial",
  INCISAL: "Incisal",
  WHOLE_TOOTH: "Todo el diente",
};

const FACE_COLOR: Record<ToothFace, string> = {
  VESTIBULAR: "#7DD3FC",
  PALATAL: "#F9A8D4",
  DISTAL: "#FCA5A5",
  MESIAL: "#6EE7B7",
  INCISAL: "#C4B5FD",
  WHOLE_TOOTH: "#FDE68A",
};

// ════════════════════════════════════════════════════════════════
// ODONTOGRAMA — rangos FDI, idénticos a ToothRecordService (backend)
// §2.2 del Requirements.md / #1 de §8 (resuelto: se implementan las 3 grillas)
// ════════════════════════════════════════════════════════════════
const ADULT_TOP_LEFT = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_TOP_RIGHT = [21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_BOTTOM_LEFT = [48, 47, 46, 45, 44, 43, 42, 41];
const ADULT_BOTTOM_RIGHT = [31, 32, 33, 34, 35, 36, 37, 38];

const PED_TOP_LEFT = [55, 54, 53, 52, 51];
const PED_TOP_RIGHT = [61, 62, 63, 64, 65];
const PED_BOTTOM_LEFT = [85, 84, 83, 82, 81];
const PED_BOTTOM_RIGHT = [71, 72, 73, 74, 75];

interface OdontogramGrid {
  key: string;
  label: string;
  topLeft: number[];
  topRight: number[];
  bottomLeft: number[];
  bottomRight: number[];
}

function buildGrids(type: OdontogramType): OdontogramGrid[] {
  const adult: OdontogramGrid = {
    key: "adult",
    label: "Adulto",
    topLeft: ADULT_TOP_LEFT,
    topRight: ADULT_TOP_RIGHT,
    bottomLeft: ADULT_BOTTOM_LEFT,
    bottomRight: ADULT_BOTTOM_RIGHT,
  };
  const pediatric: OdontogramGrid = {
    key: "pediatric",
    label: "Infantil",
    topLeft: PED_TOP_LEFT,
    topRight: PED_TOP_RIGHT,
    bottomLeft: PED_BOTTOM_LEFT,
    bottomRight: PED_BOTTOM_RIGHT,
  };
  if (type === "ADULT") return [adult];
  if (type === "PEDIATRIC") return [pediatric];
  return [adult, pediatric]; // MIX
}

function validPieceNumbersFor(type: OdontogramType): Set<number> {
  const set = new Set<number>();
  const grids =
    type === "ADULT" ? [buildGrids("ADULT")[0]] : type === "PEDIATRIC" ? [buildGrids("PEDIATRIC")[0]] : buildGrids("MIX");
  grids.forEach((g) => {
    [...g.topLeft, ...g.topRight, ...g.bottomLeft, ...g.bottomRight].forEach((p) => set.add(p));
  });
  return set;
}

const formatPiece = (n: number): string => `${Math.floor(n / 10)}.${n % 10}`;

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
const todayISO = (): string => new Date().toISOString().slice(0, 10);

const formatDateDisplay = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const genTempId = (): string => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const fullNameOf = (p: SimplePersonRef | null | undefined): string => {
  if (!p) return "";
  if (p.fullName) return p.fullName;
  return [p.name, p.surname].filter(Boolean).join(" ");
};

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// ════════════════════════════════════════════════════════════════
// MINI-COMPONENTS — inputs reutilizables
// ════════════════════════════════════════════════════════════════
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      style={{
        display: "block",
        fontFamily: FONT_SANS,
        fontSize: 12.5,
        fontWeight: 600,
        color: C.textSecondary,
        marginBottom: 6,
      }}
    >
      {children}
      {required && <span style={{ color: C.errorIcon }}> *</span>}
    </label>
  );
}

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: `1.5px solid ${C.border}`,
  borderRadius: 8,
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.textPrimary,
  background: C.cardBg,
  outline: "none",
  boxSizing: "border-box",
};

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      style={{ ...inputBaseStyle, resize: "vertical", fontFamily: FONT_SANS }}
    />
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [hovered, setHovered] = useState(false);
  const bg =
    variant === "primary"
      ? disabled
        ? "#93B4F8"
        : hovered
        ? "#1d4ed8"
        : C.electric
      : variant === "danger"
      ? hovered
        ? "#B91C1C"
        : C.errorIcon
      : hovered
      ? C.activeItemBg
      : C.cardBg;
  const color = variant === "secondary" ? C.textSecondary : "#fff";
  const border = variant === "secondary" ? `1.5px solid ${C.border}` : "none";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "9px 20px",
        borderRadius: 7,
        border,
        background: bg,
        color,
        fontFamily: FONT_SANS,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// MODAL — Referencias Odontograma (Imagen 2) — solo lectura
// ════════════════════════════════════════════════════════════════
const REFERENCE_ROWS: Array<{ glyph: string; label: string }> = [
  { glyph: "TC", label: "Tratamiento de Conducto" },
  { glyph: "●", label: "Caries Curable" },
  { glyph: "■", label: "Caries Incurable" },
  { glyph: "=", label: "Extracción" },
  { glyph: "X", label: "Diente Ausente" },
  { glyph: "/A", label: "Obturación Amalgama" },
  { glyph: "/S", label: "Obturación Silicato" },
  { glyph: "/Ac", label: "Obturación Acrílico/Composite" },
  { glyph: "Pd", label: "Paradentosis" },
  { glyph: "○", label: "Corona" },
  { glyph: "P", label: "Pivot" },
  { glyph: "|", label: "Incrustación" },
  { glyph: "⊓", label: "Puente" },
  { glyph: "☐", label: "Prot. Removible" },
  { glyph: "〰", label: "Ortodoncia" },
  { glyph: "IM", label: "Implante" },
];

function ModalShell({
  title,
  onClose,
  children,
  width = 520,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,34,68,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width,
          maxWidth: "92vw",
          maxHeight: "88vh",
          overflowY: "auto",
          background: C.cardBg,
          borderRadius: 12,
          boxShadow: "0 12px 48px rgba(15,34,68,0.25)",
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ fontFamily: FONT_SANS, fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textMuted, fontSize: 18 }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReferenciasModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Referencias Odontograma" onClose={onClose} width={560}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
        {REFERENCE_ROWS.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 26, fontFamily: FONT_SANS, fontWeight: 700, fontSize: 13, color: C.textPrimary }}>
              {r.glyph}
            </span>
            <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textSecondary }}>{r.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: C.preExisting, display: "inline-block" }} />
          <span style={{ fontFamily: FONT_SANS, fontSize: 12.5, color: C.textSecondary }}>Prestación Preexistente</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: C.required, display: "inline-block" }} />
          <span style={{ fontFamily: FONT_SANS, fontSize: 12.5, color: C.textSecondary }}>Prestación Requerida</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <PrimaryButton onClick={onClose}>ENTENDIDO</PrimaryButton>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════
// ODONTOGRAMA INTERACTIVO
// ════════════════════════════════════════════════════════════════
function ToothIcon({
  piece,
  record,
  onClick,
}: {
  piece: number;
  record: LocalToothRecordItem | undefined;
  onClick: () => void;
}) {
  const color = record ? (record.recordType === "PRE_EXISTING" ? C.preExisting : C.required) : C.textMuted;
  const glyph = record ? SYMBOL_GLYPHS[record.diagnosisSymbol] : "";
  return (
    <button
      onClick={onClick}
      title={record ? `${formatPiece(piece)} · ${record.diagnosisName}` : formatPiece(piece)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 2,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_SANS,
          fontSize: 12,
          fontWeight: 700,
          color,
        }}
      >
        {glyph}
      </div>
      <span style={{ fontFamily: FONT_SANS, fontSize: 10.5, color: C.textMuted }}>{formatPiece(piece)}</span>
    </button>
  );
}

function OdontogramGridView({
  grid,
  itemsByPiece,
  onPieceClick,
}: {
  grid: OdontogramGrid;
  itemsByPiece: Map<number, LocalToothRecordItem>;
  onPieceClick: (piece: number) => void;
}) {
  const renderRow = (left: number[], right: number[]) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {left.map((p) => (
        <ToothIcon key={p} piece={p} record={itemsByPiece.get(p)} onClick={() => onPieceClick(p)} />
      ))}
      <div style={{ width: 1, alignSelf: "stretch", background: C.border, margin: "0 6px" }} />
      {right.map((p) => (
        <ToothIcon key={p} piece={p} record={itemsByPiece.get(p)} onClick={() => onPieceClick(p)} />
      ))}
    </div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      {grid.label && (
        <div style={{ fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 6, textTransform: "uppercase" }}>
          {grid.label}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {renderRow(grid.topLeft, grid.topRight)}
        <div style={{ height: 1, background: C.border }} />
        {renderRow(grid.bottomLeft, grid.bottomRight)}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MODAL — Cargar prestación (§4.3)
// ════════════════════════════════════════════════════════════════
function CargarPrestacionModal({
  odontogramType,
  initialPieceNumbers,
  editingItem,
  diagnosisCatalog,
  onClose,
  onSave,
}: {
  odontogramType: OdontogramType;
  initialPieceNumbers: number[];
  editingItem?: LocalToothRecordItem;
  diagnosisCatalog: DiagnosisTypeCatalogResponse[];
  onClose: () => void;
  onSave: (item: LocalToothRecordItem) => void;
}) {
  const [recordType, setRecordType] = useState<RecordType>(editingItem?.recordType ?? "PRE_EXISTING");
  const [pieceNumbers, setPieceNumbers] = useState<number[]>(editingItem?.pieceNumbers ?? initialPieceNumbers);
  const [pieceInput, setPieceInput] = useState("");
  const [face, setFace] = useState<ToothFace>(editingItem?.face ?? "WHOLE_TOOTH");
  const [diagnosisId, setDiagnosisId] = useState<number | null>(editingItem?.diagnosisId ?? null);
  const [diagnosisQuery, setDiagnosisQuery] = useState(editingItem?.diagnosisName ?? "");
  const [showDiagnosisList, setShowDiagnosisList] = useState(false);
  const [observations, setObservations] = useState(editingItem?.observations ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const validPieces = useMemo(() => validPieceNumbersFor(odontogramType), [odontogramType]);

  const filteredDiagnoses = useMemo(() => {
    const q = diagnosisQuery.trim().toLowerCase();
    if (!q) return diagnosisCatalog;
    return diagnosisCatalog.filter((d) => d.name.toLowerCase().includes(q));
  }, [diagnosisCatalog, diagnosisQuery]);

  const addPiece = () => {
    const n = parseInt(pieceInput.replace(".", ""), 10);
    if (!n || Number.isNaN(n)) return;
    if (!validPieces.has(n)) {
      setFormError(`La pieza ${pieceInput} no es válida para el tipo de odontograma seleccionado.`);
      return;
    }
    if (!pieceNumbers.includes(n)) setPieceNumbers((prev) => [...prev, n]);
    setPieceInput("");
    setFormError(null);
  };

  const removePiece = (n: number) => setPieceNumbers((prev) => prev.filter((p) => p !== n));

  const handleSave = () => {
    if (pieceNumbers.length === 0) {
      setFormError("Seleccioná al menos una pieza.");
      return;
    }
    if (diagnosisId == null) {
      setFormError("Seleccioná un diagnóstico.");
      return;
    }
    const diagnosis = diagnosisCatalog.find((d) => d.id === diagnosisId);
    if (!diagnosis) {
      setFormError("El diagnóstico seleccionado ya no está disponible.");
      return;
    }
    onSave({
      tempId: editingItem?.tempId ?? genTempId(),
      pieceNumbers,
      recordType,
      face,
      diagnosisId,
      diagnosisName: diagnosis.name,
      diagnosisSymbol: diagnosis.symbol,
      observations: observations.trim() ? observations.trim() : null,
    });
  };

  return (
    <ModalShell title="Cargar prestación" onClose={onClose} width={560}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <FieldLabel>Tipo de prestación</FieldLabel>
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value as RecordType)}
            style={inputBaseStyle}
          >
            <option value="PRE_EXISTING">🔴 Prestación Preexistente</option>
            <option value="REQUIRED">🔵 Prestación Requerida</option>
          </select>
        </div>

        <div>
          <FieldLabel>Pieza/s</FieldLabel>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={pieceInput}
              onChange={(e) => setPieceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPiece();
                }
              }}
              placeholder="Ej: 1.4"
              style={inputBaseStyle}
            />
            <PrimaryButton variant="secondary" onClick={addPiece}>
              +
            </PrimaryButton>
          </div>
        </div>
      </div>

      {pieceNumbers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {pieceNumbers.map((p) => (
            <span
              key={p}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                borderRadius: 6,
                background: C.activeItemBg,
                border: `1px solid ${C.border}`,
                fontFamily: FONT_SANS,
                fontSize: 12,
                color: C.electric,
                fontWeight: 600,
              }}
            >
              {formatPiece(p)}
              <span style={{ cursor: "pointer" }} onClick={() => removePiece(p)}>
                ✕
              </span>
            </span>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <FieldLabel>Cara</FieldLabel>
        {/* Nota: el backend acepta una única cara por CreateToothRecordItem (`face: ToothFace`).
            Se implementa como single-select para respetar el contrato ya existente
            (Requirements.md §8 #7 — pregunta abierta no resuelta por la persona;
            se prioriza el contrato de backend confirmado por código). */}
        <select value={face} onChange={(e) => setFace(e.target.value as ToothFace)} style={inputBaseStyle}>
          {(Object.keys(FACE_LABEL) as ToothFace[]).map((f) => (
            <option key={f} value={f}>
              {FACE_LABEL[f]}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 16, position: "relative" }}>
        <FieldLabel>Diagnóstico</FieldLabel>
        <input
          value={diagnosisQuery}
          onChange={(e) => {
            setDiagnosisQuery(e.target.value);
            setShowDiagnosisList(true);
            setDiagnosisId(null);
          }}
          onFocus={() => setShowDiagnosisList(true)}
          placeholder="Buscar diagnóstico..."
          style={inputBaseStyle}
        />
        {showDiagnosisList && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 10,
              maxHeight: 200,
              overflowY: "auto",
              background: C.cardBg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(15,34,68,0.12)",
              marginTop: 4,
            }}
          >
            {filteredDiagnoses.map((d) => (
              <div
                key={d.id}
                onClick={() => {
                  setDiagnosisId(d.id);
                  setDiagnosisQuery(d.name);
                  setShowDiagnosisList(false);
                }}
                style={{
                  padding: "8px 12px",
                  fontFamily: FONT_SANS,
                  fontSize: 13,
                  color: C.textPrimary,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 700, width: 24 }}>{SYMBOL_GLYPHS[d.symbol]}</span>
                {d.name}
              </div>
            ))}
            {filteredDiagnoses.length === 0 && (
              <div style={{ padding: "8px 12px", fontFamily: FONT_SANS, fontSize: 12.5, color: C.textMuted }}>
                Sin resultados
              </div>
            )}
            {/* "Crear nuevo" fuera de alcance de esta especificación (endpoint no-mvp) — se
                muestra deshabilitado para no romper el layout observado en Imagen 7. */}
            <div
              title="Próximamente"
              style={{
                padding: "8px 12px",
                borderTop: `1px solid ${C.border}`,
                fontFamily: FONT_SANS,
                fontSize: 13,
                color: C.textMuted,
                cursor: "not-allowed",
              }}
            >
              + Crear nuevo
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <FieldLabel>Observaciones</FieldLabel>
        <TextArea value={observations} onChange={setObservations} placeholder="Observaciones" maxLength={2000} rows={3} />
      </div>

      {formError && (
        <div style={{ marginTop: 12, fontFamily: FONT_SANS, fontSize: 12.5, color: C.errorText }}>{formError}</div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <PrimaryButton variant="secondary" onClick={onClose}>
          CANCELAR
        </PrimaryButton>
        <PrimaryButton onClick={handleSave}>GUARDAR</PrimaryButton>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════
// MODAL — Cargar archivo (§4.6 / §8 #9)
// ════════════════════════════════════════════════════════════════
function CargarArchivoModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (file: File) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return "Formato no permitido. Solo se aceptan PDF, JPG o PNG.";
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return "El archivo supera el tamaño máximo permitido (15 MB).";
    }
    return null;
  };

  const handleFile = (file: File) => {
    const err = validate(file);
    if (err) {
      setError(err);
      setSelected(null);
      return;
    }
    setError(null);
    setSelected(file);
  };

  return (
    <ModalShell title="Cargar archivo" onClose={onClose} width={440}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        style={{
          border: `2px dashed ${dragOver ? C.electric : C.border}`,
          borderRadius: 10,
          padding: "36px 20px",
          textAlign: "center",
          background: dragOver ? C.activeItemBg : C.infoBg,
        }}
      >
        <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.electric, fontWeight: 700, marginBottom: 6 }}>
          <button
            onClick={() => inputRef.current?.click()}
            style={{ border: "none", background: "transparent", color: C.electric, cursor: "pointer", fontWeight: 700, fontFamily: FONT_SANS, fontSize: 13 }}
          >
            📄 SELECCIONA ARCHIVO
          </button>
        </div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12.5, color: C.textMuted }}>o arrástralo y soltalo aquí</div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {selected && !error && (
        <div style={{ marginTop: 12, fontFamily: FONT_SANS, fontSize: 12.5, color: C.textSecondary }}>
          Seleccionado: <strong>{selected.name}</strong> ({(selected.size / 1024 / 1024).toFixed(2)} MB)
        </div>
      )}
      {error && <div style={{ marginTop: 12, fontFamily: FONT_SANS, fontSize: 12.5, color: C.errorText }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <PrimaryButton variant="secondary" onClick={onClose}>
          CANCELAR
        </PrimaryButton>
        <PrimaryButton
          disabled={!selected || !!error}
          onClick={() => {
            if (selected) onSave(selected);
          }}
        >
          GUARDAR
        </PrimaryButton>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════
// LISTADO — "Registros" dentro del formulario de creación (§4.4)
// ════════════════════════════════════════════════════════════════
function RegistrosList({
  items,
  onEdit,
  onDelete,
}: {
  items: LocalToothRecordItem[];
  onEdit: (item: LocalToothRecordItem) => void;
  onDelete: (tempId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginTop: 8 }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          padding: "8px 0",
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em" }}>
          REGISTROS
        </span>
        <span style={{ color: C.textMuted, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open &&
        items.map((item) => (
          <div
            key={item.tempId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 4px",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div>
              <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary }}>
                {todayISO() === undefined ? "" : formatDateDisplay(todayISO())} |{" "}
                <strong>{item.pieceNumbers.map(formatPiece).join(", ")}</strong> | {item.diagnosisName}
              </div>
              {item.observations && (
                <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  {item.observations}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: item.recordType === "PRE_EXISTING" ? C.preExisting : C.required,
                }}
              >
                {item.recordType === "PRE_EXISTING" ? "PREEXISTENTE ●" : "REQUERIDA ●"}
              </span>
              <button
                onClick={() => onEdit(item)}
                title="Editar (local)"
                style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textMuted }}
              >
                ✎
              </button>
              <button
                onClick={() => onDelete(item.tempId)}
                title="Quitar (local)"
                style={{ border: "none", background: "transparent", cursor: "pointer", color: C.errorIcon }}
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      {open && items.length === 0 && (
        <div style={{ padding: "14px 4px", fontFamily: FONT_SANS, fontSize: 12.5, color: C.textMuted, fontStyle: "italic" }}>
          Sin registros cargados todavía.
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// HOOKS — catálogos (diagnóstico / alergias)
// ════════════════════════════════════════════════════════════════
function useCatalog<T>(url: string): { data: T[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<T[]>(url)
      .then((res) => {
        if (!cancelled) setData(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el catálogo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}

// ════════════════════════════════════════════════════════════════
// MAIN VIEW #1 — MedicalHistoryCreateView (§4 completo)
// ════════════════════════════════════════════════════════════════
export interface MedicalHistoryCreateViewProps { 
  userProfile: UserProfileShape | null;
  roles: string[];       
  patientId: number;
  onCreated: (medicalHistoryId: number, examUploadError?: string | null) => void;
  onCancel: () => void;
}

type BackendErrorCode =
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_DATE"
  | "INVALID_REQUEST_BODY"
  | "INVALID_PIECE_NUMBER"
  | "ALLERGY_NOT_FOUND"
  | "DIAGNOSIS_NOT_FOUND"
  | "DENTIST_NOT_ACTIVE"
  | "ACCESS_DENIED"
  | "PATIENT_NOT_FOUND"
  | string;

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_REQUIRED_FIELD: "Falta completar un campo obligatorio.",
  INVALID_DATE: "La fecha ingresada no es válida (no puede ser futura).",
  INVALID_REQUEST_BODY: "Ocurrió un error inesperado armando la solicitud. Reintentá.",
  INVALID_PIECE_NUMBER: "Una de las piezas cargadas no es válida para el tipo de odontograma seleccionado.",
  ALLERGY_NOT_FOUND: "Una de las alergias seleccionadas ya no está disponible.",
  DIAGNOSIS_NOT_FOUND: "Uno de los diagnósticos cargados ya no está disponible.",
  DENTIST_NOT_ACTIVE: "Tu cuenta no tiene acceso activo para crear historiales.",
  ACCESS_DENIED: "No tenés permiso para realizar esta acción.",
  PATIENT_NOT_FOUND: "No se encontró el paciente. Volvé al listado de pacientes.",
};

export function MedicalHistoryCreateView({ userProfile, patientId, onCreated, onCancel, roles }: MedicalHistoryCreateViewProps) {
  
  const isDentist = roles.includes("ROLE_DENTIST");

  // ── Catálogos ──
  const { data: diagnosisCatalog } = useCatalog<DiagnosisTypeCatalogResponse>("/api/diagnosis-type-catalog");
  const { data: allergyCatalog } = useCatalog<AllergyCatalogOption>("/api/allergies");

  // ── Evolución general ──
  const [startDate, setStartDate] = useState(todayISO());
  const [odontogramType, setOdontogramType] = useState<OdontogramType>("ADULT");
  const [showReferencias, setShowReferencias] = useState(false);

  // ── Odontograma / prestaciones ──
  const [toothRecordItems, setToothRecordItems] = useState<LocalToothRecordItem[]>([]);
  const [modalState, setModalState] = useState<{ pieces: number[]; editing?: LocalToothRecordItem } | null>(null);

  // ── Resto de campos ──
  const [pastMedicalHistory, setPastMedicalHistory] = useState("");
  const [observations, setObservations] = useState("");
  const [noAllergies, setNoAllergies] = useState(false);
  const [allergyQuery, setAllergyQuery] = useState("");
  const [showAllergyList, setShowAllergyList] = useState(false);
  const [selectedAllergies, setSelectedAllergies] = useState<AllergyCatalogOption[]>([]);
  const [dailyMedication, setDailyMedication] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingExamFile[]>([]);
  const [showFileModal, setShowFileModal] = useState(false);

  // ── Guardado ──
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Cuando cambia el tipo de odontograma, se descartan las piezas que dejaron
  // de ser válidas (evita quedar con registros locales imposibles de guardar).
  useEffect(() => {
    const valid = validPieceNumbersFor(odontogramType);
    setToothRecordItems((prev) => prev.filter((item) => item.pieceNumbers.every((p) => valid.has(p))));
  }, [odontogramType]);

  const itemsByPiece = useMemo(() => {
    const map = new Map<number, LocalToothRecordItem>();
    toothRecordItems.forEach((item) => item.pieceNumbers.forEach((p) => map.set(p, item)));
    return map;
  }, [toothRecordItems]);

  const grids = useMemo(() => buildGrids(odontogramType), [odontogramType]);

  const filteredAllergyOptions = useMemo(() => {
    const q = allergyQuery.trim().toLowerCase();
    const selectedIds = new Set(selectedAllergies.map((a) => a.id));
    return allergyCatalog.filter((a) => !selectedIds.has(a.id) && (!q || a.name.toLowerCase().includes(q)));
  }, [allergyCatalog, allergyQuery, selectedAllergies]);

  const handlePieceClick = useCallback(
    (piece: number) => {
      const existing = itemsByPiece.get(piece);
      setModalState({ pieces: existing ? existing.pieceNumbers : [piece], editing: existing });
    },
    [itemsByPiece]
  );

  const handleSaveToothRecordItem = (item: LocalToothRecordItem) => {
    setToothRecordItems((prev) => {
      const withoutOld = prev.filter((i) => i.tempId !== item.tempId);
      return [...withoutOld, item];
    });
    setModalState(null);
  };

  const handleDeleteToothRecordItem = (tempId: string) => {
    setToothRecordItems((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const handleAddFile = (file: File) => {
    setPendingFiles((prev) => [...prev, { tempId: genTempId(), file }]);
    setShowFileModal(false);
  };

  const handleRemoveFile = (tempId: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.tempId !== tempId));
  };

  // ── Guardar (§1.4 / §3 paso 2.8 / CA-01..CA-10) ──
  const handleSave = async () => {
    setSaveError(null);

    if (!startDate) {
      setSaveError(ERROR_MESSAGES.INVALID_DATE);
      return;
    }

    setSaving(true);

    const body = {
      odontogram_type: odontogramType,
      start_date: startDate,
      past_medical_history: pastMedicalHistory.trim() || null,
      observations: observations.trim() || null,
      has_allergies: !noAllergies,
      allergy_ids: !noAllergies ? selectedAllergies.map((a) => a.id) : [],
      daily_medication: dailyMedication.trim() || null,
      tooth_records: toothRecordItems.map((item) => ({
        piece_numbers: item.pieceNumbers,
        record_type: item.recordType,
        face: item.face,
        diagnosis_id: item.diagnosisId,
        observations: item.observations,
      })),
    };

    try {
      const res = await apiClient.post(`/api/medical-histories?patientId=${patientId}`, body);
      const medicalHistoryId: number = res.data.id;

      // Exámenes complementarios: llamadas independientes, una por archivo,
      // solo después de que (1) resolvió con éxito (§1.4 nota de arquitectura).
      let examUploadError: string | null = null;
      for (const pending of pendingFiles) {
        try {
          const formData = new FormData();
          formData.append("file", pending.file);
          await apiClient.post(`/api/medical-histories/${medicalHistoryId}/exams`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (err: any) {
          const msg =
            err?.response?.data?.message ??
            `No se pudo subir el archivo "${pending.file.name}".`;
          // Se conserva solo el primer error para el cartel de la vista de detalle
          // (Requirements.md §8 #11: cartel rojo con el motivo exacto).
          examUploadError = examUploadError ?? msg;
        }
      }

      onCreated(medicalHistoryId, examUploadError);
    } catch (err: any) {
      const code: BackendErrorCode | undefined = err?.response?.data?.error_code;
      const status = err?.response?.status;
      if (code && ERROR_MESSAGES[code]) {
        setSaveError(ERROR_MESSAGES[code]);
      } else if (status === 404) {
        setSaveError(ERROR_MESSAGES.PATIENT_NOT_FOUND);
      } else if (status === 403) {
        setSaveError(ERROR_MESSAGES.ACCESS_DENIED);
      } else {
        setSaveError(err?.response?.data?.message ?? "No se pudo guardar la historia clínica. Intentá nuevamente.");
      }
      // CA-07: el formulario permanece con los datos, no se intenta ningún
      // POST .../exams si la creación falló.
    } finally {
      setSaving(false);
    }
  };

  // CA-09 / §8 #16: ocultar el formulario para roles distintos de ROLE_DENTIST.
  if (!isDentist) {
    return (
      <div style={{ padding: "48px 36px", fontFamily: FONT_SANS }}>
        <div
          style={{
            background: C.warnBg,
            border: `1px solid ${C.warnBorder}`,
            borderRadius: 10,
            padding: 20,
            color: C.warnText,
            fontSize: 13,
            maxWidth: 480,
          }}
        >
          Solo un odontólogo puede crear una Historia Clínica General. Tu usuario no tiene los
          permisos necesarios.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: C.bg, fontFamily: FONT_SANS }}>
      {/* Header */}
      <div
        style={{
          background: C.cardBg,
          borderBottom: `1px solid ${C.border}`,
          padding: "18px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ fontFamily: FONT_SANS, fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0, letterSpacing: "0.02em" }}>
          HISTORIA CLÍNICA GENERAL
        </h2>
        <div style={{ display: "flex", gap: 10 }}>
          <PrimaryButton variant="secondary" onClick={onCancel} disabled={saving}>
            CANCELAR
          </PrimaryButton>
          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? "GUARDANDO…" : "GUARDAR"}
          </PrimaryButton>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 36px 60px" }}>
        {saveError && (
          <div
            style={{
              background: C.errorBg,
              border: `1px solid ${C.errorBorder}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: C.errorText,
              fontSize: 13,
              marginBottom: 20,
              maxWidth: 900,
            }}
          >
            {saveError}
          </div>
        )}

        <div style={{ maxWidth: 900, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          {/* ── 2.1 Evolución general ── */}
          <h4 style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, color: C.textPrimary, marginTop: 0 }}>
            Evolución general
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            <div>
              <FieldLabel required>Fecha</FieldLabel>
              <input
                type="date"
                value={startDate}
                max={todayISO()}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputBaseStyle}
              />
            </div>
            <div>
              <FieldLabel required>Tipo de odontograma</FieldLabel>
              <select
                value={odontogramType}
                onChange={(e) => setOdontogramType(e.target.value as OdontogramType)}
                style={inputBaseStyle}
              >
                <option value="ADULT">Adulto</option>
                <option value="PEDIATRIC">Infantil</option>
                <option value="MIX">Mixto</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
            <PrimaryButton
              onClick={() => setModalState({ pieces: [] })}
            >
              + PRESTACIÓN
            </PrimaryButton>
            <PrimaryButton variant="secondary" onClick={() => setShowReferencias(true)}>
              ⓘ REFERENCIAS
            </PrimaryButton>
            {/* Nota: el toggle "Tipo de prestación" del header original (Imagen 1) se
                omite deliberadamente — Requirements.md §8 #2: sin mapeo a ningún
                endpoint, la persona pidió quitarlo del UI. */}
          </div>

          {/* ── 2.2 Odontograma ── */}
          <div style={{ marginTop: 20 }}>
            {grids.map((g) => (
              <OdontogramGridView key={g.key} grid={g} itemsByPiece={itemsByPiece} onPieceClick={handlePieceClick} />
            ))}
          </div>

          {/* ── 2.4 Registros ── */}
          <RegistrosList
            items={toothRecordItems}
            onEdit={(item) => setModalState({ pieces: item.pieceNumbers, editing: item })}
            onDelete={handleDeleteToothRecordItem}
          />

          {/* ── 2.3 Antecedentes médicos ── */}
          <div style={{ marginTop: 24 }}>
            <FieldLabel>Antecedentes médicos</FieldLabel>
            <TextArea value={pastMedicalHistory} onChange={setPastMedicalHistory} maxLength={5000} rows={3} />
          </div>

          {/* ── 2.4 Exámenes complementarios ── */}
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Exámenes complementarios</FieldLabel>
            <button
              onClick={() => setShowFileModal(true)}
              style={{
                ...inputBaseStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                color: C.textMuted,
                textAlign: "left",
              }}
            >
              Adjuntar archivos <span>⭱</span>
            </button>
            {pendingFiles.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {pendingFiles.map((pf) => (
                  <div
                    key={pf.tempId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      background: C.infoBg,
                      border: `1px solid ${C.infoBorder}`,
                      borderRadius: 6,
                      fontFamily: FONT_SANS,
                      fontSize: 12.5,
                      color: C.textSecondary,
                    }}
                  >
                    <span>{pf.file.name}</span>
                    <button
                      onClick={() => handleRemoveFile(pf.tempId)}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: C.errorIcon }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 2.5 Observaciones ── */}
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Observaciones</FieldLabel>
            <TextArea value={observations} onChange={setObservations} maxLength={2000} rows={3} />
          </div>

          {/* ── 2.6 Alergias ── */}
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Alergias (Primera consulta)</FieldLabel>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={noAllergies}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNoAllergies(checked);
                  // §8 #15: al marcar "No refiere alergias" el combo desaparece
                  // directamente; se limpia también la selección visual.
                  if (checked) setSelectedAllergies([]);
                }}
              />
              No refiere alergias
            </label>

            {!noAllergies && (
              <div style={{ marginTop: 12, position: "relative" }}>
                <FieldLabel>Añadir alergias</FieldLabel>
                <input
                  value={allergyQuery}
                  onChange={(e) => {
                    setAllergyQuery(e.target.value);
                    setShowAllergyList(true);
                  }}
                  onFocus={() => setShowAllergyList(true)}
                  placeholder="Buscar alergia..."
                  style={inputBaseStyle}
                />
                {showAllergyList && filteredAllergyOptions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      maxHeight: 180,
                      overflowY: "auto",
                      background: C.cardBg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      boxShadow: "0 8px 24px rgba(15,34,68,0.12)",
                      marginTop: 4,
                    }}
                  >
                    {filteredAllergyOptions.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => {
                          setSelectedAllergies((prev) => [...prev, a]);
                          setAllergyQuery("");
                          setShowAllergyList(false);
                        }}
                        style={{ padding: "8px 12px", fontFamily: FONT_SANS, fontSize: 13, cursor: "pointer" }}
                      >
                        {a.name}
                      </div>
                    ))}
                  </div>
                )}
                {selectedAllergies.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {selectedAllergies.map((a) => (
                      <span
                        key={a.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: C.activeItemBg,
                          border: `1px solid ${C.border}`,
                          fontFamily: FONT_SANS,
                          fontSize: 12,
                          color: C.electric,
                          fontWeight: 600,
                        }}
                      >
                        {a.name}
                        <span
                          style={{ cursor: "pointer" }}
                          onClick={() => setSelectedAllergies((prev) => prev.filter((x) => x.id !== a.id))}
                        >
                          ✕
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 2.7 Medicación diaria ── */}
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Medicación diaria</FieldLabel>
            <TextArea value={dailyMedication} onChange={setDailyMedication} maxLength={1000} rows={2} />
          </div>
        </div>
      </div>

      {showReferencias && <ReferenciasModal onClose={() => setShowReferencias(false)} />}

      {modalState && (
        <CargarPrestacionModal
          odontogramType={odontogramType}
          initialPieceNumbers={modalState.pieces}
          editingItem={modalState.editing}
          diagnosisCatalog={diagnosisCatalog}
          onClose={() => setModalState(null)}
          onSave={handleSaveToothRecordItem}
        />
      )}

      {showFileModal && <CargarArchivoModal onClose={() => setShowFileModal(false)} onSave={handleAddFile} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN VIEW #2 — MedicalHistoryDetailView (§4.11)
// ════════════════════════════════════════════════════════════════
export interface MedicalHistoryDetailViewProps {
  patientId: number;
  medicalHistoryId: number;
  /** "Paciente sin/con alergias registradas" — ya resuelto en otro lado, se pasa por prop
      para no duplicar el cálculo del banner global del paciente. */
  allergyBannerState?: "present" | "absent" | "none";
  /** Mensaje de error de un examen que falló al subirse tras la creación (§8 #11). */
  examUploadError?: string | null;
  onNavigateToPatientHistorial: () => void;
}

function AllergyBannerSmall({ state }: { state: "present" | "absent" | "none" }) {
  if (state === "none") return null;
  const isPresent = state === "present";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: isPresent ? C.warnBg : C.infoBg,
        border: `1px solid ${isPresent ? C.warnBorder : C.infoBorder}`,
        borderRadius: 7,
        padding: "8px 14px",
        fontFamily: FONT_SANS,
        fontSize: 12.5,
        fontWeight: 600,
        color: isPresent ? C.warnText : C.infoText,
      }}
    >
      {isPresent ? "Paciente con alergias registradas" : "Paciente sin alergias registradas"}
    </div>
  );
}

function ExamUploadErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 18,
        right: 24,
        background: C.errorBg,
        border: `1px solid ${C.errorBorder}`,
        borderRadius: 8,
        padding: "10px 14px",
        maxWidth: 360,
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        boxShadow: "0 6px 18px rgba(220,38,38,0.15)",
        zIndex: 5,
      }}
    >
      <span style={{ color: C.errorIcon, fontWeight: 700 }}>!</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12.5, fontWeight: 700, color: C.errorText }}>
          Ocurrió un error cargando el archivo
        </div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.errorText, marginTop: 2 }}>{message}</div>
      </div>
      <button onClick={onDismiss} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.errorText }}>
        ✕
      </button>
    </div>
  );
}

export function MedicalHistoryDetailView({
  patientId,
  medicalHistoryId,
  allergyBannerState = "none",
  examUploadError,
  onNavigateToPatientHistorial,
}: MedicalHistoryDetailViewProps) {
  const [detail, setDetail] = useState<MedicalHistoryDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedExamError, setDismissedExamError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<MedicalHistoryDetailResponse>(`/api/medical-histories/${patientId}/${medicalHistoryId}`)
      .then((res) => {
        if (!cancelled) setDetail(res.data);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el detalle de la historia clínica.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, medicalHistoryId]);

  const grids = useMemo(() => (detail ? buildGrids(detail.odontogramType) : []), [detail]);

  const itemsByPiece = useMemo(() => {
    const map = new Map<number, LocalToothRecordItem>();
    detail?.toothRecords.forEach((tr) => {
      if (!tr.diagnosisType) return;
      map.set(tr.pieceNumber, {
        tempId: String(tr.id),
        pieceNumbers: [tr.pieceNumber],
        recordType: tr.recordType as RecordType,
        face: tr.face as ToothFace,
        diagnosisId: tr.diagnosisType.id,
        diagnosisName: tr.diagnosisType.name,
        diagnosisSymbol: tr.diagnosisType.symbol,
        observations: tr.observations,
      });
    });
    return map;
  }, [detail]);

  if (loading) {
    return <div style={{ padding: 48, fontFamily: FONT_SANS, color: C.textMuted }}>Cargando historia clínica…</div>;
  }
  if (error || !detail) {
    return (
      <div style={{ padding: 48, fontFamily: FONT_SANS, color: C.errorText }}>
        {error ?? "No se encontró la historia clínica."}
      </div>
    );
  }

  const editedByName = detail.editedBy ? fullNameOf(detail.editedBy) : null; // §8 #12

  return (
    <div style={{ position: "relative", height: "100%", overflowY: "auto", background: C.bg, fontFamily: FONT_SANS }}>
      {examUploadError && !dismissedExamError && (
        <ExamUploadErrorBanner message={examUploadError} onDismiss={() => setDismissedExamError(true)} />
      )}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 36px 60px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <AllergyBannerSmall state={allergyBannerState} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <span
              title="Editar (fuera de alcance de esta especificación)"
              style={{ width: 34, height: 34, borderRadius: 7, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, opacity: 0.5 }}
            >
              ✎
            </span>
            <span
              title="Imprimir (fuera de alcance de esta especificación)"
              style={{ width: 34, height: 34, borderRadius: 7, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, opacity: 0.5 }}
            >
              🖨
            </span>
          </div>
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.border}`, borderLeft: `4px solid ${C.electric}` }}>
            <h3 style={{ fontFamily: FONT_SANS, fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
              Historia Clínica General
            </h3>
            <button
              onClick={onNavigateToPatientHistorial}
              aria-label="Cerrar"
              style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textMuted, fontSize: 18 }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 20px", fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
            <span>
              Creado por: {fullNameOf(detail.dentist)} | {formatDateDisplay(detail.createdAt.slice(0, 10))}{" "}
              {detail.createdAt.slice(11, 16)} hs
            </span>
            {/* §8 #12: si editedBy es null, no se muestra nada (ni el label). */}
            {editedByName && (
              <span>
                Editado por: {editedByName} | {formatDateDisplay(detail.updatedAt.slice(0, 10))}{" "}
                {detail.updatedAt.slice(11, 16)} hs
              </span>
            )}
          </div>

          <div style={{ padding: 20 }}>
            <h4 style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, color: C.textPrimary, marginTop: 0 }}>
              Evolución general
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Fecha</div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
                  {formatDateDisplay(detail.startDate)}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Tipo de odontograma</div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
                  {detail.odontogramType === "ADULT" ? "Adulto" : detail.odontogramType === "PEDIATRIC" ? "Infantil" : "Mixto"}
                </div>
              </div>
            </div>

            {grids.map((g) => (
              <OdontogramGridView key={g.key} grid={g} itemsByPiece={itemsByPiece} onPieceClick={() => {}} />
            ))}

            <div style={{ marginTop: 4 }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                REGISTROS
              </div>
              {detail.toothRecords.length === 0 && (
                <div style={{ fontFamily: FONT_SANS, fontSize: 12.5, color: C.textMuted, fontStyle: "italic", padding: "6px 0" }}>
                  Sin registros.
                </div>
              )}
              {detail.toothRecords.map((tr) => (
                <div key={tr.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary }}>
                      {formatDateDisplay(tr.createdAt.slice(0, 10))} | <strong>{formatPiece(tr.pieceNumber)}</strong> |{" "}
                      {tr.diagnosisType?.name ?? "—"}
                    </div>
                    {tr.observations && (
                      <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted, marginTop: 2 }}>{tr.observations}</div>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color: tr.recordType === "PRE_EXISTING" ? C.preExisting : C.required,
                    }}
                  >
                    {tr.recordType === "PRE_EXISTING" ? "PREEXISTENTE ●" : "REQUERIDA ●"}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Antecedentes médicos</div>
              <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
                {detail.pastMedicalHistory || "Sin antecedentes"}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Observaciones</div>
              <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
                {detail.observations || "Sin observaciones registradas"}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Alergias (Primera consulta)</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, marginTop: 4 }}>
                <input type="checkbox" checked={!detail.hasAllergies} readOnly disabled />
                No refiere alergias
              </label>
              {detail.hasAllergies && detail.allergies.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {detail.allergies.map((a) => (
                    <span
                      key={a.id}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: C.activeItemBg,
                        border: `1px solid ${C.border}`,
                        fontFamily: FONT_SANS,
                        fontSize: 12,
                        color: C.electric,
                        fontWeight: 600,
                      }}
                    >
                      {a.allergyName}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* §8 #10: Exámenes complementarios y Medicación diaria SÍ se muestran
                en el detalle si tienen datos cargados; se omiten si están vacíos
                (igual comportamiento que "Editado por" con editedBy == null). */}
            {detail.exams.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
                  Exámenes complementarios
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {detail.exams.map((ex) => (
                    <a
                      key={ex.id}
                      href={ex.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: C.infoBg,
                        border: `1px solid ${C.infoBorder}`,
                        borderRadius: 6,
                        fontFamily: FONT_SANS,
                        fontSize: 12.5,
                        color: C.electric,
                        textDecoration: "none",
                      }}
                    >
                      <span>{ex.filename}</span>
                      <span style={{ color: C.textMuted, fontSize: 11 }}>
                        {ex.uploadBy ? `${ex.uploadBy.name} ${ex.uploadBy.lastName}` : ""}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {detail.dailyMedication && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Medicación diaria</div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
                  {detail.dailyMedication}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}