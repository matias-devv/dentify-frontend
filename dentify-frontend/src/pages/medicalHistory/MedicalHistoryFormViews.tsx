// ════════════════════════════════════════════════════════════════════════════
// MedicalHistoryFormViews.tsx — "Historia Clínica General" — Dentify
//
// Fusión de:
//   - La lógica real (hooks, apiClient, validaciones, manejo de errores) del
//     archivo vigente en el proyecto.
//   - Los componentes visuales del diseño de Figma (ToothSVG interactivo,
//     modales, RegistrosList con badges de cara), que reemplazan por completo
//     a los viejos ToothIcon / listados planos.
//
// Contiene, en un único archivo:
//   1) MedicalHistoryCreateView   — formulario de creación
//   2) MedicalHistoryDetailView   — vista de detalle post-guardado
//   3) Componentes auxiliares: ToothSVG (odontograma), modal "Cargar
//      prestación", modal "Cargar archivo", listado de "Registros",
//      leyenda de caras.
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
// Ajustes visuales/UX pedidos sobre la versión ya fusionada con el diseño de
// Figma:
//   D1  RegistrosList: se agrega la fecha al extremo izquierdo de cada fila
//       (antes del número de pieza), conservando el resto igual.
//   D2  Al tocar una cara específica del diente en el odontograma, el modal
//       "Cargar prestación" arranca con esa cara ya seleccionada en el campo
//       "Cara" (antes siempre arrancaba en "Todo el diente" sin importar
//       dónde se tocara).
//   D3  La leyenda de colores por cara (Vestibular/Palatino/.../Todo el
//       diente) se muestra UNA sola vez por formulario, sin importar si el
//       odontograma es Adulto, Infantil o Mixto (antes se duplicaba: una vez
//       por cada grilla renderizada).
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
// DESIGN TOKENS
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
  toothFace: string;
  observations: string | null;
  createdAt: string;
  diagnosis: DiagnosisTypeCatalogResponse | null;
}

interface PatientAllergyDetailResponse {
  id: number;
  notes: string | null;
  allergyId: number;
  allergyName: string;
  isAllergyActive: boolean;
}

interface SimpleUserProfileResponse {
  id: number;
  name: string;
  lastName: string;
}

interface ComplementaryExamResponse {
  id: number;
  object_key: string;
  filename: string;
  fileType: string;
  uploadDate: string;
  uploadBy: SimpleUserProfileResponse | null;
}

interface PatientDetailResponse {
  id: number;
  name: string;
  surname: string;
  dni: string;
  dateOfBirth: string;
  phone: string | null;
  email: string;
  coverageType: string | null;
  insurance: string | null;
}

interface DentistDetailResponse {
  id: number;
  name: string;
  surname: string;
  professionalLicense: string;
}

interface MedicalHistoryEditedByResponse {
  id: number;
  name: string;
  lastName: string;
}

export interface MedicalHistoryDetailResponse {
  id: number;
  startDate: string;
  odontogramType: OdontogramType;
  pastMedicalHistory: string | null;
  observations: string | null;
  hasAllergies: boolean;
  dailyMedication: string | null;

  patient: PatientDetailResponse;
  dentist: DentistDetailResponse;
  editedBy: MedicalHistoryEditedByResponse | null;

  toothRecords: ToothRecordResponse[];
  allergies: PatientAllergyDetailResponse[];
  complementaryExams: ComplementaryExamResponse[];
}

// ════════════════════════════════════════════════════════════════
// GLYPHS & FACE COLORS
// ════════════════════════════════════════════════════════════════
const SYMBOL_GLYPHS: Record<DiagnosisSymbol, string> = {
  ROOT_CANAL_TREATMENT: "TC", INCURABLE_TOOTH_DECAY: "■", MISSING_TOOTH: "X",
  SILICATE_FILLING: "/S", PARADENTOSIS: "Pd", PERNO: "P", BRIDGE: "⊓",
  ORTHODONTICS: "〰", TREATABLE_DECAY: "●", EXTRACTION: "=",
  AMALGAM_FILLING: "/A", ACRYLIC_FILLING: "/Ac", CROWN: "○",
  INLAY_ONLAY: "|", REMOVABLE_PROSTHESIS: "☐", IMPLANT: "IM", CUSTOM: "◆",
};

// Variantes de 1-2 caracteres para las regiones periféricas del odontograma
// (zonas angostas): usar el glifo completo ahí lo vuelve ilegible.
const SHORT_GLYPH: Record<DiagnosisSymbol, string> = {
  ROOT_CANAL_TREATMENT: "T", INCURABLE_TOOTH_DECAY: "■", MISSING_TOOTH: "X",
  SILICATE_FILLING: "S", PARADENTOSIS: "P", PERNO: "P", BRIDGE: "⊓",
  ORTHODONTICS: "≈", TREATABLE_DECAY: "●", EXTRACTION: "=",
  AMALGAM_FILLING: "A", ACRYLIC_FILLING: "Ac", CROWN: "○",
  INLAY_ONLAY: "|", REMOVABLE_PROSTHESIS: "☐", IMPLANT: "I", CUSTOM: "◆",
};

const FACE_LABEL: Record<ToothFace, string> = {
  VESTIBULAR: "Vestibular", PALATAL: "Palatino", DISTAL: "Distal",
  MESIAL: "Mesial", INCISAL: "Incisal", WHOLE_TOOTH: "Todo el diente",
};

const FACE_COLOR: Record<ToothFace, string> = {
  VESTIBULAR: "#7DD3FC", PALATAL: "#F9A8D4", DISTAL: "#FCA5A5",
  MESIAL: "#6EE7B7", INCISAL: "#C4B5FD", WHOLE_TOOTH: "#FDE68A",
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
  buildGrids(type).forEach((g) =>
    [...g.topLeft, ...g.topRight, ...g.bottomLeft, ...g.bottomRight].forEach((p) => set.add(p))
  );
  return set;
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
const formatPiece = (n: number): string => `${Math.floor(n / 10)}.${n % 10}`;
const todayISO = (): string => new Date().toISOString().slice(0, 10);
const genTempId = (): string => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const formatDateDisplay = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const fullNameOf = (
  person:
    | {
        name?: string;
        surname?: string;
        lastName?: string;
        fullName?: string;
      }
    | null
    | undefined
): string => {
  if (!person) return "";

  if (person.fullName) {
    return person.fullName;
  }

  const surname = person.surname ?? person.lastName ?? "";

  return [person.name, surname]
    .filter(Boolean)
    .join(" ");
};

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// ════════════════════════════════════════════════════════════════
// SVG TOOTH GEOMETRY
// ════════════════════════════════════════════════════════════════
// ViewBox 0 0 40 40, center (20,20), outer r=17, inner r=7
const CX = 20, CY = 20, RO = 17, RI = 7;

function cpt(deg: number, r: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

// Puntos de esquina cada 45°: SE=45°, SW=135°, NW=225°, NE=315°
const iSE = cpt(45, RI), iSW = cpt(135, RI), iNW = cpt(225, RI), iNE = cpt(315, RI);
const oSE = cpt(45, RO), oSW = cpt(135, RO), oNW = cpt(225, RO), oNE = cpt(315, RO);

function svgArc(r: number, [x, y]: [number, number], sw: 0 | 1) {
  return `A ${r},${r} 0 0,${sw} ${x.toFixed(2)},${y.toFixed(2)}`;
}
function svgM([x, y]: [number, number]) { return `M ${x.toFixed(2)},${y.toFixed(2)}`; }
function svgL([x, y]: [number, number]) { return `L ${x.toFixed(2)},${y.toFixed(2)}`; }

// Sectores tipo dona: arco interior CW (sweep=1) → línea al exterior → arco
// exterior CCW (sweep=0)
const SECTOR: Record<"top" | "right" | "bottom" | "left", string> = {
  top:    [svgM(iNW), svgArc(RI, iNE, 1), svgL(oNE), svgArc(RO, oNW, 0), "Z"].join(" "),
  right:  [svgM(iNE), svgArc(RI, iSE, 1), svgL(oSE), svgArc(RO, oNE, 0), "Z"].join(" "),
  bottom: [svgM(iSE), svgArc(RI, iSW, 1), svgL(oSW), svgArc(RO, oSE, 0), "Z"].join(" "),
  left:   [svgM(iSW), svgArc(RI, iNW, 1), svgL(oNW), svgArc(RO, oSW, 0), "Z"].join(" "),
};

const MID = (RI + RO) / 2; // = 12 — punto medio del anillo, para centrar glifos

const REGION_CENTER: Record<"top" | "right" | "bottom" | "left" | "center", [number, number]> = {
  top: [CX, CY - MID], right: [CX + MID, CY],
  bottom: [CX, CY + MID], left: [CX - MID, CY], center: [CX, CY],
};

// ════════════════════════════════════════════════════════════════
// FACE ↔ POSICIÓN VISUAL
// ════════════════════════════════════════════════════════════════
type VP = "top" | "right" | "bottom" | "left" | "center";

function faceToVP(face: ToothFace, quad: number): VP {
  const isUpper = [1, 2, 5, 6].includes(quad);
  const mesialRight = [1, 4, 5, 8].includes(quad);
  switch (face) {
    case "VESTIBULAR": return isUpper ? "top" : "bottom";
    case "PALATAL":    return isUpper ? "bottom" : "top";
    case "MESIAL":     return mesialRight ? "right" : "left";
    case "DISTAL":     return mesialRight ? "left" : "right";
    default:           return "center";
  }
}

function vpToFace(pos: VP, quad: number): ToothFace {
  const isUpper = [1, 2, 5, 6].includes(quad);
  const mesialRight = [1, 4, 5, 8].includes(quad);
  switch (pos) {
    case "top":    return isUpper ? "VESTIBULAR" : "PALATAL";
    case "bottom": return isUpper ? "PALATAL" : "VESTIBULAR";
    case "left":   return mesialRight ? "DISTAL" : "MESIAL";
    case "right":  return mesialRight ? "MESIAL" : "DISTAL";
    default:       return "INCISAL";
  }
}

const OUTER_PETALS = ["top", "right", "bottom", "left"] as const;

// ════════════════════════════════════════════════════════════════
// TOOTH SVG — 5 regiones, hover por cara, click POR REGIÓN
// ════════════════════════════════════════════════════════════════
function ToothSVG({
  piece, records, onClick, isReadOnly,
}: {
  piece: number;
  records: LocalToothRecordItem[];
  /**
   * Se invoca con la cara (ToothFace) exacta de la región tocada — ya no
   * simplemente "se tocó el diente" — para poder precargar esa cara en el
   * modal "Cargar prestación" (antes el mini formulario siempre arrancaba en
   * "Todo el diente" sin importar dónde se hacía click).
   */
  onClick?: (face: ToothFace) => void;
  isReadOnly?: boolean;
}) {
  const [hovVP, setHovVP] = useState<VP | null>(null);
  const quad = Math.floor(piece / 10);
  const pid = `t${piece}`;

  const wholeRec = records.find(r => r.face === "WHOLE_TOOTH");

  // Agrupa los registros parciales (no WHOLE_TOOTH) por posición visual
  const byVP = useMemo(() => {
    const m = new Map<VP, LocalToothRecordItem[]>();
    for (const r of records) {
      if (r.face === "WHOLE_TOOTH") continue;
      const vp = faceToVP(r.face, quad);
      if (!m.has(vp)) m.set(vp, []);
      m.get(vp)!.push(r);
    }
    return m;
  }, [records, quad]);

  const primaryRec = wholeRec ?? records[0];
  const borderColor = primaryRec
    ? (primaryRec.recordType === "PRE_EXISTING" ? C.preExisting : C.required)
    : C.border;
  const borderW = records.length > 0 ? 1.8 : 1.5;
  const sepOp = wholeRec ? 0.2 : 1;

  const handleRegionClick = (vp: VP) => {
    if (isReadOnly || !onClick) return;
    onClick(vpToFace(vp, quad));
  };

  function renderGlyph(recs: LocalToothRecordItem[], vp: VP) {
    const r = recs[0];
    if (!r) return null;
    const [cx, cy] = REGION_CENTER[vp];
    const color = r.recordType === "PRE_EXISTING" ? C.preExisting : C.required;
    const isCenter = vp === "center";
    const glyphStr = isCenter ? SYMBOL_GLYPHS[r.diagnosisSymbol] : SHORT_GLYPH[r.diagnosisSymbol];
    const fs = isCenter ? 6.5 : 5.2;
    return (
      <g key={vp} clipPath={`url(#${pid}-${vp})`} style={{ pointerEvents: "none" }}>
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="central"
          fontSize={fs} fontWeight="800"
          fontFamily="'Courier New', monospace"
          fill={color} style={{ userSelect: "none" }}
        >
          {glyphStr}
        </text>
        {recs.length > 1 && (
          <circle cx={cx + (isCenter ? 4.5 : 3.5)} cy={cy - 2.5} r={1.3} fill={color} />
        )}
      </g>
    );
  }

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        cursor: isReadOnly ? "default" : "pointer",
      }}
      title={formatPiece(piece)}
    >
      <svg width={36} height={36} viewBox="0 0 40 40" overflow="visible">
        <defs>
          {OUTER_PETALS.map(vp => (
            <clipPath key={vp} id={`${pid}-${vp}`}>
              <path d={SECTOR[vp]} />
            </clipPath>
          ))}
          <clipPath id={`${pid}-center`}>
            <circle cx={CX} cy={CY} r={RI} />
          </clipPath>
          <clipPath id={`${pid}-whole`}>
            <circle cx={CX} cy={CY} r={RO} />
          </clipPath>
        </defs>

        {/* Base blanca */}
        <circle cx={CX} cy={CY} r={RO} fill="white" />

        {/* Tinte de fondo si hay registro WHOLE_TOOTH */}
        {wholeRec && (
          <circle cx={CX} cy={CY} r={RO}
            fill={FACE_COLOR.WHOLE_TOOTH} fillOpacity={0.18} />
        )}

        {/* Regiones periféricas: hover + tinte de diagnóstico + click por cara */}
        {OUTER_PETALS.map(vp => {
          const recs = byVP.get(vp) ?? [];
          const isHov = hovVP === vp && !isReadOnly;
          const face = vpToFace(vp, quad);
          const diagFill = recs.length > 0
            ? (recs[0].recordType === "PRE_EXISTING" ? "#FEE2E2" : "#DBEAFE")
            : null;
          return (
            <path key={vp} d={SECTOR[vp]}
              fill={isHov ? FACE_COLOR[face] : diagFill ?? "rgba(0,0,0,0)"}
              fillOpacity={isHov ? 0.38 : diagFill ? 0.5 : 1}
              pointerEvents={isReadOnly ? "none" : "all"}
              style={{ cursor: isReadOnly ? "default" : "pointer" }}
              onMouseEnter={() => !isReadOnly && setHovVP(vp)}
              onMouseLeave={() => setHovVP(null)}
              onClick={() => handleRegionClick(vp)}
            />
          );
        })}

        {/* Líneas separadoras (el círculo interior tapa la parte central) */}
        {([oSE, oSW, oNW, oNE] as [number, number][]).map((pt, i) => (
          <line key={i}
            x1={CX} y1={CY} x2={pt[0].toFixed(2)} y2={pt[1].toFixed(2)}
            stroke={C.border} strokeWidth={0.75} opacity={sepOp}
            style={{ pointerEvents: "none" }}
          />
        ))}

        {/* Borde exterior */}
        <circle cx={CX} cy={CY} r={RO}
          fill="none" stroke={borderColor} strokeWidth={borderW}
          style={{ pointerEvents: "none" }} />

        {/* Región central (INCISAL) — también con click propio */}
        {(() => {
          const recs = byVP.get("center") ?? [];
          const isHov = hovVP === "center" && !isReadOnly;
          const diagFill = recs.length > 0
            ? (recs[0].recordType === "PRE_EXISTING" ? "#FEE2E2" : "#EFF6FF")
            : "white";
          const innerStroke = recs.length > 0 && !wholeRec
            ? (recs[0].recordType === "PRE_EXISTING" ? C.preExisting : C.required)
            : C.border;
          return (
            <circle cx={CX} cy={CY} r={RI}
              fill={isHov ? FACE_COLOR.INCISAL : diagFill}
              fillOpacity={isHov ? 0.45 : 1}
              stroke={innerStroke} strokeWidth={0.85}
              pointerEvents={isReadOnly ? "none" : "all"}
              style={{ cursor: isReadOnly ? "default" : "pointer" }}
              onMouseEnter={() => !isReadOnly && setHovVP("center")}
              onMouseLeave={() => setHovVP(null)}
              onClick={() => handleRegionClick("center")}
            />
          );
        })()}

        {/* Glifos de diagnóstico — periféricos */}
        {OUTER_PETALS.map(vp => renderGlyph(byVP.get(vp) ?? [], vp))}

        {/* Glifo de diagnóstico — centro (INCISAL) */}
        {renderGlyph(byVP.get("center") ?? [], "center")}

        {/* Glifo WHOLE_TOOTH (recorte de diente completo) */}
        {wholeRec && (
          <g clipPath={`url(#${pid}-whole)`} style={{ pointerEvents: "none" }}>
            <text x={CX} y={CY}
              textAnchor="middle" dominantBaseline="central"
              fontSize={8} fontWeight="800"
              fontFamily="'Courier New', monospace"
              fill={wholeRec.recordType === "PRE_EXISTING" ? C.preExisting : C.required}
              style={{ userSelect: "none" }}
            >
              {SYMBOL_GLYPHS[wholeRec.diagnosisSymbol]}
            </text>
          </g>
        )}
      </svg>

      <span style={{ fontFamily: FONT_SANS, fontSize: 9.5, color: C.textMuted, lineHeight: 1 }}>
        {formatPiece(piece)}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ODONTOGRAMA — grilla + leyenda (leyenda extraída, ver FaceLegend)
// ════════════════════════════════════════════════════════════════
function OdontogramGridView({
  grid, itemsByPiece, onPieceClick, isReadOnly,
}: {
  grid: OdontogramGrid;
  itemsByPiece: Map<number, LocalToothRecordItem[]>;
  onPieceClick: (piece: number, face: ToothFace) => void;
  isReadOnly?: boolean;
}) {
  const renderRow = (left: number[], right: number[]) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "nowrap" }}>
      {left.map(p => (
        <ToothSVG key={p} piece={p}
          records={itemsByPiece.get(p) ?? []}
          onClick={(face) => onPieceClick(p, face)}
          isReadOnly={isReadOnly}
        />
      ))}
      <div style={{ width: 1, alignSelf: "stretch", background: C.border, flexShrink: 0, margin: "0 4px" }} />
      {right.map(p => (
        <ToothSVG key={p} piece={p}
          records={itemsByPiece.get(p) ?? []}
          onClick={(face) => onPieceClick(p, face)}
          isReadOnly={isReadOnly}
        />
      ))}
    </div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      {grid.label && (
        <div style={{
          fontFamily: FONT_SANS, fontSize: 10.5, fontWeight: 700,
          color: C.textMuted, marginBottom: 8, textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          {grid.label}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {renderRow(grid.topLeft, grid.topRight)}
        <div style={{ height: 1, background: C.border }} />
        {renderRow(grid.bottomLeft, grid.bottomRight)}
      </div>
      {/* Nota: la leyenda de colores por cara ya NO se renderiza acá adentro.
          Antes se repetía una vez por cada grilla (Adulto + Infantil en modo
          Mixto quedaban con dos leyendas idénticas apiladas). Ahora vive una
          sola vez en <FaceLegend/>, fuera del .map de grillas. */}
    </div>
  );
}

function FaceLegend() {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "6px 14px",
      marginTop: 2, marginBottom: 14, paddingTop: 10, borderTop: `1px solid ${C.border}`,
    }}>
      {(Object.entries(FACE_LABEL) as [ToothFace, string][]).map(([face, label]) => (
        <div key={face} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 10, height: 10, borderRadius: 2,
            background: FACE_COLOR[face], border: `1px solid ${C.border}`,
            flexShrink: 0,
          }} />
          <span style={{ fontFamily: FONT_SANS, fontSize: 10.5, color: C.textSecondary }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// REGISTROS (formulario de creación) — filas estructuradas con badge de cara
// y fecha a la izquierda
// ════════════════════════════════════════════════════════════════
function RegistrosList({
  items, onEdit, onDelete,
}: {
  items: LocalToothRecordItem[];
  onEdit: (item: LocalToothRecordItem) => void;
  onDelete: (tempId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  // Ajuste pedido: mostrar la fecha al extremo izquierdo de cada fila. Como
  // estos ítems son locales (todavía no persistidos, no tienen createdAt
  // propio del backend), se muestra la fecha de hoy — el día en que
  // efectivamente se está cargando la prestación.
  const todayLabel = formatDateDisplay(todayISO());

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "8px 0",
          background: "transparent", border: "none",
          borderTop: `1px solid ${C.border}`, cursor: "pointer",
        }}
      >
        <span style={{
          fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700,
          color: C.textMuted, letterSpacing: "0.06em",
        }}>
          REGISTROS ({items.length})
        </span>
        <span style={{ color: C.textMuted, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && items.length === 0 && (
        <div style={{
          padding: "12px 4px", fontFamily: FONT_SANS, fontSize: 12.5,
          color: C.textMuted, fontStyle: "italic",
        }}>
          Sin registros cargados todavía.
        </div>
      )}

      {open && items.map(item => (
        <div key={item.tempId} style={{ borderBottom: `1px solid ${C.border}` }}>
          {/* Fila principal */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "9px 4px",
            gap: 8,
          }}>
            {/* Izquierda: fecha + pieza + badge de cara + nombre de diagnóstico */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
              <span style={{
                fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600,
                color: C.textMuted, flexShrink: 0, whiteSpace: "nowrap",
              }}>
                {todayLabel}
              </span>
              <span style={{ color: C.textMuted, flexShrink: 0, fontSize: 12 }}>·</span>
              <span style={{
                fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700,
                color: C.textPrimary, flexShrink: 0,
              }}>
                {item.pieceNumbers.map(formatPiece).join(", ")}
              </span>
              <span style={{ color: C.textMuted, flexShrink: 0, fontSize: 12 }}>·</span>
              {/* Badge de cara */}
              <span style={{
                display: "inline-flex", alignItems: "center",
                padding: "1px 7px", borderRadius: 5,
                background: FACE_COLOR[item.face] + "55",
                border: `1px solid ${FACE_COLOR[item.face]}99`,
                fontFamily: FONT_SANS, fontSize: 11, fontWeight: 600,
                color: C.textPrimary, flexShrink: 0, whiteSpace: "nowrap",
              }}>
                {FACE_LABEL[item.face]}
              </span>
              <span style={{
                fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {item.diagnosisName}
              </span>
            </div>

            {/* Derecha: tipo de prestación + acciones */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{
                fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700,
                letterSpacing: "0.04em",
                color: item.recordType === "PRE_EXISTING" ? C.preExisting : C.required,
              }}>
                {item.recordType === "PRE_EXISTING" ? "PREEXISTENTE ●" : "REQUERIDA ●"}
              </span>
              <button
                onClick={() => onEdit(item)}
                title="Editar"
                style={{
                  border: "none", background: "transparent",
                  cursor: "pointer", color: C.textMuted, fontSize: 14, padding: 2,
                }}
              >
                ✎
              </button>
              <button
                onClick={() => onDelete(item.tempId)}
                title="Quitar"
                style={{
                  border: "none", background: "transparent",
                  cursor: "pointer", color: C.errorIcon, fontSize: 13, padding: 2,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Observaciones — solo si hay */}
          {item.observations && (
            <div style={{
              padding: "0 4px 8px 4px",
              fontFamily: FONT_SANS, fontSize: 12, color: C.textSecondary,
              lineHeight: 1.45,
            }}>
              {item.observations}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PRIMITIVAS DE UI COMPARTIDAS
// ════════════════════════════════════════════════════════════════
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{
      display: "block", fontFamily: FONT_SANS, fontSize: 12.5,
      fontWeight: 600, color: C.textSecondary, marginBottom: 6,
    }}>
      {children}
      {required && <span style={{ color: C.errorIcon }}> *</span>}
    </label>
  );
}

const inputBaseStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  border: `1.5px solid ${C.border}`, borderRadius: 8,
  fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary,
  background: C.cardBg, outline: "none", boxSizing: "border-box",
};

function TextArea({ value, onChange, placeholder, rows = 4, maxLength }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; maxLength?: number;
}) {
  return (
    <textarea
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows} maxLength={maxLength}
      style={{ ...inputBaseStyle, resize: "vertical" }}
    />
  );
}

function PrimaryButton({ children, onClick, disabled, variant = "primary" }: {
  children: React.ReactNode; onClick?: () => void;
  disabled?: boolean; variant?: "primary" | "secondary" | "danger";
}) {
  const [hov, setHov] = useState(false);
  const bg =
    variant === "primary" ? (disabled ? "#93B4F8" : hov ? "#1d4ed8" : C.electric) :
    variant === "danger"  ? (hov ? "#B91C1C" : C.errorIcon) :
    (hov ? C.activeItemBg : C.cardBg);
  const clr = variant === "secondary" ? C.textSecondary : "#fff";
  const bdr = variant === "secondary" ? `1.5px solid ${C.border}` : "none";
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: "9px 20px", borderRadius: 7, border: bdr,
        background: bg, color: clr, fontFamily: FONT_SANS,
        fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", transition: "background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// MODAL — Referencias Odontograma — solo lectura
// ════════════════════════════════════════════════════════════════
const REFERENCE_ROWS: Array<{ glyph: string; label: string }> = [
  { glyph: "TC",  label: "Tratamiento de Conducto" },
  { glyph: "●",   label: "Caries Curable" },
  { glyph: "■",   label: "Caries Incurable" },
  { glyph: "=",   label: "Extracción" },
  { glyph: "X",   label: "Diente Ausente" },
  { glyph: "/A",  label: "Obturación Amalgama" },
  { glyph: "/S",  label: "Obturación Silicato" },
  { glyph: "/Ac", label: "Obturación Acrílico/Composite" },
  { glyph: "Pd",  label: "Paradentosis" },
  { glyph: "○",   label: "Corona" },
  { glyph: "P",   label: "Pivot" },
  { glyph: "|",   label: "Incrustación" },
  { glyph: "⊓",   label: "Puente" },
  { glyph: "☐",   label: "Prot. Removible" },
  { glyph: "〰",   label: "Ortodoncia" },
  { glyph: "IM",  label: "Implante" },
];

function ModalShell({ title, onClose, children, width = 520 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,34,68,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto",
        background: C.cardBg, borderRadius: 12,
        boxShadow: "0 12px 48px rgba(15,34,68,0.25)", padding: 24,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18,
        }}>
          <h3 style={{ fontFamily: FONT_SANS, fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
            {title}
          </h3>
          <button onClick={onClose} aria-label="Cerrar" style={{
            border: "none", background: "transparent", cursor: "pointer",
            color: C.textMuted, fontSize: 18,
          }}>✕</button>
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
        {REFERENCE_ROWS.map(r => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 28, fontFamily: "'Courier New', monospace",
              fontWeight: 700, fontSize: 13, color: C.textPrimary,
            }}>{r.glyph}</span>
            <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textSecondary }}>{r.label}</span>
          </div>
        ))}
      </div>
      <div style={{
        display: "flex", gap: 18, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}`,
      }}>
        {([["PRE_EXISTING", "Prestación Preexistente"], ["REQUIRED", "Prestación Requerida"]] as const).map(([t, label]) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 9, height: 9, borderRadius: "50%",
              background: t === "PRE_EXISTING" ? C.preExisting : C.required,
              display: "inline-block",
            }} />
            <span style={{ fontFamily: FONT_SANS, fontSize: 12.5, color: C.textSecondary }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <PrimaryButton onClick={onClose}>ENTENDIDO</PrimaryButton>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════
// MODAL — Cargar prestación
// ════════════════════════════════════════════════════════════════
function CargarPrestacionModal({
  odontogramType, initialPieceNumbers, editingItem, initialFace, diagnosisCatalog, onClose, onSave,
}: {
  odontogramType: OdontogramType;
  initialPieceNumbers: number[];
  editingItem?: LocalToothRecordItem;
  /**
   * Cara pre-seleccionada al abrir un registro NUEVO (ajuste pedido): si el
   * usuario tocó una región específica del diente, el mini formulario debe
   * arrancar en esa cara en vez de siempre en "Todo el diente". Si se está
   * editando un registro existente, `editingItem.face` tiene prioridad sobre
   * este valor.
   */
  initialFace?: ToothFace;
  diagnosisCatalog: DiagnosisTypeCatalogResponse[];
  onClose: () => void;
  onSave: (item: LocalToothRecordItem) => void;
}) {
  const [recordType, setRecordType] = useState<RecordType>(editingItem?.recordType ?? "PRE_EXISTING");
  const [pieceNumbers, setPieceNumbers] = useState<number[]>(editingItem?.pieceNumbers ?? initialPieceNumbers);
  const [pieceInput, setPieceInput] = useState("");
  const [face, setFace] = useState<ToothFace>(editingItem?.face ?? initialFace ?? "WHOLE_TOOTH");
  const [diagnosisId, setDiagnosisId] = useState<number | null>(editingItem?.diagnosisId ?? null);
  const [diagnosisQuery, setDiagnosisQuery] = useState(editingItem?.diagnosisName ?? "");
  const [showDiagnosisList, setShowDiagnosisList] = useState(false);
  const [observations, setObservations] = useState(editingItem?.observations ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const validPieces = useMemo(() => validPieceNumbersFor(odontogramType), [odontogramType]);

  const filteredDiagnoses = useMemo(() => {
    const q = diagnosisQuery.trim().toLowerCase();
    if (!q) return diagnosisCatalog;
    return diagnosisCatalog.filter(d => d.name.toLowerCase().includes(q));
  }, [diagnosisCatalog, diagnosisQuery]);

  const addPiece = () => {
    const n = parseInt(pieceInput.replace(".", ""), 10);
    if (!n || Number.isNaN(n)) return;
    if (!validPieces.has(n)) {
      setFormError(`La pieza ${pieceInput} no es válida para el tipo de odontograma seleccionado.`);
      return;
    }
    if (!pieceNumbers.includes(n)) setPieceNumbers(prev => [...prev, n]);
    setPieceInput("");
    setFormError(null);
  };

  const removePiece = (n: number) => setPieceNumbers(prev => prev.filter(p => p !== n));

  const handleSave = () => {
    if (pieceNumbers.length === 0) { setFormError("Seleccioná al menos una pieza."); return; }
    if (diagnosisId == null) { setFormError("Seleccioná un diagnóstico."); return; }
    const diagnosis = diagnosisCatalog.find(d => d.id === diagnosisId);
    if (!diagnosis) { setFormError("El diagnóstico seleccionado ya no está disponible."); return; }
    onSave({
      tempId: editingItem?.tempId ?? genTempId(),
      pieceNumbers, recordType, face, diagnosisId,
      diagnosisName: diagnosis.name, diagnosisSymbol: diagnosis.symbol,
      observations: observations.trim() ? observations.trim() : null,
    });
  };

  return (
    <ModalShell title="Cargar prestación" onClose={onClose} width={560}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <FieldLabel>Tipo de prestación</FieldLabel>
          <select value={recordType} onChange={e => setRecordType(e.target.value as RecordType)} style={inputBaseStyle}>
            <option value="PRE_EXISTING">🔴 Prestación Preexistente</option>
            <option value="REQUIRED">🔵 Prestación Requerida</option>
          </select>
        </div>

        <div>
          <FieldLabel>Pieza/s</FieldLabel>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={pieceInput}
              onChange={e => setPieceInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPiece(); } }}
              placeholder="Ej: 1.4"
              style={inputBaseStyle}
            />
            <PrimaryButton variant="secondary" onClick={addPiece}>+</PrimaryButton>
          </div>
        </div>
      </div>

      {pieceNumbers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {pieceNumbers.map(p => (
            <span key={p} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 8px", borderRadius: 6,
              background: C.activeItemBg, border: `1px solid ${C.border}`,
              fontFamily: FONT_SANS, fontSize: 12, color: C.electric, fontWeight: 600,
            }}>
              {formatPiece(p)}
              <span style={{ cursor: "pointer" }} onClick={() => removePiece(p)}>✕</span>
            </span>
          ))}
        </div>
      )}

      {/* Cara */}
      <div style={{ marginTop: 16 }}>
        <FieldLabel>Cara</FieldLabel>
        {/* Nota: el backend acepta una única cara por CreateToothRecordItem
            (`face: ToothFace`), por eso sigue siendo un single-select. */}
        <select value={face} onChange={e => setFace(e.target.value as ToothFace)} style={inputBaseStyle}>
          {(Object.keys(FACE_LABEL) as ToothFace[]).map(f => (
            <option key={f} value={f}>{FACE_LABEL[f]}</option>
          ))}
        </select>
      </div>

      {/* Diagnóstico */}
      <div style={{ marginTop: 16, position: "relative" }}>
        <FieldLabel>Diagnóstico</FieldLabel>
        <input
          value={diagnosisQuery}
          onChange={e => { setDiagnosisQuery(e.target.value); setShowDiagnosisList(true); setDiagnosisId(null); }}
          onFocus={() => setShowDiagnosisList(true)}
          placeholder="Buscar diagnóstico..."
          style={inputBaseStyle}
        />
        {showDiagnosisList && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
            maxHeight: 200, overflowY: "auto", background: C.cardBg,
            border: `1px solid ${C.border}`, borderRadius: 8,
            boxShadow: "0 8px 24px rgba(15,34,68,0.12)", marginTop: 4,
          }}>
            {filteredDiagnoses.map(d => (
              <div key={d.id}
                onClick={() => { setDiagnosisId(d.id); setDiagnosisQuery(d.name); setShowDiagnosisList(false); }}
                style={{
                  padding: "8px 12px", fontFamily: FONT_SANS, fontSize: 13,
                  color: C.textPrimary, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{ fontWeight: 700, width: 28, fontFamily: "'Courier New', monospace" }}>
                  {SYMBOL_GLYPHS[d.symbol]}
                </span>
                {d.name}
              </div>
            ))}
            {filteredDiagnoses.length === 0 && (
              <div style={{ padding: "8px 12px", fontFamily: FONT_SANS, fontSize: 12.5, color: C.textMuted }}>
                Sin resultados
              </div>
            )}
            {/* "Crear nuevo" diagnóstico fuera de alcance (endpoint no-mvp) —
                se muestra deshabilitado para no romper el layout esperado. */}
            <div
              title="Próximamente"
              style={{
                padding: "8px 12px", borderTop: `1px solid ${C.border}`,
                fontFamily: FONT_SANS, fontSize: 13, color: C.textMuted, cursor: "not-allowed",
              }}
            >
              + Crear nuevo
            </div>
          </div>
        )}
      </div>

      {/* Observaciones */}
      <div style={{ marginTop: 16 }}>
        <FieldLabel>Observaciones</FieldLabel>
        <TextArea value={observations} onChange={setObservations} placeholder="Observaciones" maxLength={2000} rows={3} />
      </div>

      {formError && (
        <div style={{ marginTop: 12, fontFamily: FONT_SANS, fontSize: 12.5, color: C.errorText }}>{formError}</div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <PrimaryButton variant="secondary" onClick={onClose}>CANCELAR</PrimaryButton>
        <PrimaryButton onClick={handleSave}>GUARDAR</PrimaryButton>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════
// MODAL — Cargar archivo
// ════════════════════════════════════════════════════════════════
function CargarArchivoModal({ onClose, onSave }: { onClose: () => void; onSave: (file: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) return "Formato no permitido. Solo se aceptan PDF, JPG o PNG.";
    if (file.size > MAX_FILE_SIZE_BYTES) return "El archivo supera el tamaño máximo permitido (15 MB).";
    return null;
  };

  const handleFile = (file: File) => {
    const err = validate(file);
    if (err) { setError(err); setSelected(null); return; }
    setError(null); setSelected(file);
  };

  return (
    <ModalShell title="Cargar archivo" onClose={onClose} width={440}>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        style={{
          border: `2px dashed ${dragOver ? C.electric : C.border}`,
          borderRadius: 10, padding: "36px 20px", textAlign: "center",
          background: dragOver ? C.activeItemBg : C.infoBg,
        }}
      >
        <button onClick={() => inputRef.current?.click()} style={{
          border: "none", background: "transparent", color: C.electric,
          cursor: "pointer", fontWeight: 700, fontFamily: FONT_SANS, fontSize: 13,
        }}>
          📄 SELECCIONA ARCHIVO
        </button>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>
          o arrástralo y soltalo aquí
        </div>
        <input ref={inputRef} type="file" accept={ALLOWED_MIME_TYPES.join(",")} style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
      {selected && !error && (
        <div style={{ marginTop: 12, fontFamily: FONT_SANS, fontSize: 12.5, color: C.textSecondary }}>
          Seleccionado: <strong>{selected.name}</strong> ({(selected.size / 1024 / 1024).toFixed(2)} MB)
        </div>
      )}
      {error && <div style={{ marginTop: 12, fontFamily: FONT_SANS, fontSize: 12.5, color: C.errorText }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <PrimaryButton variant="secondary" onClick={onClose}>CANCELAR</PrimaryButton>
        <PrimaryButton disabled={!selected || !!error} onClick={() => { if (selected) onSave(selected); }}>GUARDAR</PrimaryButton>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════
// HOOKS — catálogos (diagnóstico / alergias), vía apiClient real
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
// MAIN VIEW #1 — MedicalHistoryCreateView
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

  // ── Catálogos reales ──
  const { data: diagnosisCatalog } = useCatalog<DiagnosisTypeCatalogResponse>("/api/diagnosis-type-catalog");
  const { data: allergyCatalog } = useCatalog<AllergyCatalogOption>("/api/allergies");

  // ── Evolución general ──
  const [startDate, setStartDate] = useState(todayISO());
  const [odontogramType, setOdontogramType] = useState<OdontogramType>("ADULT");
  const [showReferencias, setShowReferencias] = useState(false);

  // ── Odontograma / prestaciones ──
  const [toothRecordItems, setToothRecordItems] = useState<LocalToothRecordItem[]>([]);
  const [modalState, setModalState] = useState<{ pieces: number[]; editing?: LocalToothRecordItem; initialFace?: ToothFace } | null>(null);

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
  // de ser válidas.
  useEffect(() => {
    const valid = validPieceNumbersFor(odontogramType);
    setToothRecordItems((prev) => prev.filter((item) => item.pieceNumbers.every((p) => valid.has(p))));
  }, [odontogramType]);

  // Mapa pieza → registros[] (arreglo, no un único registro): una misma
  // pieza puede tener varios registros simultáneos en caras distintas (ej:
  // mesial + distal), y ToothSVG ya sabe agrupar y dibujar todos en la
  // posición que corresponde a cada cara.
  const itemsByPiece = useMemo(() => {
    const map = new Map<number, LocalToothRecordItem[]>();
    toothRecordItems.forEach((item) => {
      item.pieceNumbers.forEach((p) => {
        const arr = map.get(p) ?? [];
        arr.push(item);
        map.set(p, arr);
      });
    });
    return map;
  }, [toothRecordItems]);

  const grids = useMemo(() => buildGrids(odontogramType), [odontogramType]);

  const filteredAllergyOptions = useMemo(() => {
    const q = allergyQuery.trim().toLowerCase();
    const selectedIds = new Set(selectedAllergies.map((a) => a.id));
    return allergyCatalog.filter((a) => !selectedIds.has(a.id) && (!q || a.name.toLowerCase().includes(q)));
  }, [allergyCatalog, allergyQuery, selectedAllergies]);

  const handlePieceClick = useCallback(
    (piece: number, clickedFace: ToothFace) => {
      const existingForPiece = itemsByPiece.get(piece) ?? [];
      // Ajuste pedido: si ya hay un registro exactamente en la cara tocada,
      // se edita ese. Si no, pero hay un registro "Todo el diente" sobre la
      // pieza, se edita ese (cubre toda la pieza igual). Si no hay ninguno,
      // se abre un registro NUEVO ya pre-cargado con la cara tocada (antes
      // siempre arrancaba en "Todo el diente" sin importar dónde se clickeaba).
      const matching =
        existingForPiece.find((r) => r.face === clickedFace) ??
        existingForPiece.find((r) => r.face === "WHOLE_TOOTH");
      setModalState({
        pieces: matching ? matching.pieceNumbers : [piece],
        editing: matching,
        initialFace: matching ? matching.face : clickedFace,
      });
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
      odontogramType: odontogramType,
      startDate: startDate,
      pastMedicalHistory: pastMedicalHistory.trim() || null,
      observations: observations.trim() || null,
      hasAllergies: !noAllergies,
      allergyIds: !noAllergies ? selectedAllergies.map((a) => a.id) : [],
      dailyMedication: dailyMedication.trim() || null,
      toothRecords: toothRecordItems.map((item) => ({
        pieceNumbers: item.pieceNumbers,
        recordType: item.recordType,
        face: item.face,
        diagnosisId: item.diagnosisId,
        observations: item.observations,
      })),
    };

    try {
      const res = await apiClient.post(`/api/medical-histories?patientId=${patientId}`, body);
      const idMedicalHistory: number = res.data.idMedicalHistory;

      // Exámenes complementarios: llamadas independientes, una por archivo,
      // solo después de que (1) resolvió con éxito.
      let examUploadError: string | null = null;
      for (const pending of pendingFiles) {
        try {
          const formData = new FormData();
          formData.append("file", pending.file);
          await apiClient.post(`/api/exams/${idMedicalHistory}`, formData);
        } catch (err: any) {
          const msg =
            err?.response?.data?.message ??
            `No se pudo subir el archivo "${pending.file.name}".`;
          // Se conserva solo el primer error para el cartel de la vista de
          // detalle (§8 #11: cartel rojo con el motivo exacto).
          examUploadError = examUploadError ?? msg;
        }
      }

      onCreated(idMedicalHistory, examUploadError);
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
              maxWidth: 960,
            }}
          >
            {saveError}
          </div>
        )}

        <div style={{ maxWidth: 960, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          {/* ── Evolución general ── */}
          <h4 style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, color: C.textPrimary, marginTop: 0, marginBottom: 16 }}>
            Evolución general
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
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

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <PrimaryButton onClick={() => setModalState({ pieces: [] })}>
              + PRESTACIÓN
            </PrimaryButton>
            <PrimaryButton variant="secondary" onClick={() => setShowReferencias(true)}>
              ⓘ REFERENCIAS
            </PrimaryButton>
            {/* El toggle "Tipo de prestación" del header original no se
                renderiza — Requirements.md §8 #2: sin mapeo a ningún
                endpoint, se quitó del UI a pedido explícito. */}
          </div>

          {/* ── Odontograma ── */}
          <div style={{ overflowX: "auto" }}>
            {grids.map((g) => (
              <OdontogramGridView key={g.key} grid={g} itemsByPiece={itemsByPiece} onPieceClick={handlePieceClick} />
            ))}
            {/* Leyenda de colores por cara: una sola vez, sin importar si el
                odontograma es Adulto, Infantil o Mixto (ver nota en
                OdontogramGridView). */}
            <FaceLegend />
          </div>

          {/* ── Registros ── */}
          <RegistrosList
            items={toothRecordItems}
            onEdit={(item) => setModalState({ pieces: item.pieceNumbers, editing: item, initialFace: item.face })}
            onDelete={handleDeleteToothRecordItem}
          />

          {/* ── Antecedentes médicos ── */}
          <div style={{ marginTop: 24 }}>
            <FieldLabel>Antecedentes médicos</FieldLabel>
            <TextArea value={pastMedicalHistory} onChange={setPastMedicalHistory} maxLength={5000} rows={3} />
          </div>

          {/* ── Exámenes complementarios ── */}
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

          {/* ── Observaciones ── */}
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Observaciones</FieldLabel>
            <TextArea value={observations} onChange={setObservations} maxLength={2000} rows={3} />
          </div>

          {/* ── Alergias ── */}
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Alergias (Primera consulta)</FieldLabel>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={noAllergies}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNoAllergies(checked);
                  // §8 #15: al marcar "No refiere alergias" el combo
                  // desaparece directamente; se limpia también la selección.
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

          {/* ── Medicación diaria ── */}
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
          initialFace={modalState.initialFace}
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
// MAIN VIEW #2 — MedicalHistoryDetailView
// ════════════════════════════════════════════════════════════════
export interface MedicalHistoryDetailViewProps {
  patientId: number;
  medicalHistoryId: number;
  /** "Paciente sin/con alergias registradas" — ya resuelto en otro lado, se
      pasa por prop para no duplicar el cálculo del banner global del
      paciente. */
  allergyBannerState?: "present" | "absent" | "none";
  /** Mensaje de error de un examen que falló al subirse tras la creación
      (§8 #11). */
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
  setError(null);

  apiClient
    .get<MedicalHistoryDetailResponse>(
      `/api/medical-histories/${patientId}/${medicalHistoryId}`
    )
    .then((res) => {
      if (cancelled) return;

      setDetail({
        ...res.data,
        toothRecords: res.data.toothRecords ?? [],
        allergies: res.data.allergies ?? [],
        complementaryExams: res.data.complementaryExams ?? [],
      });
    })
    .catch((err: unknown) => {
      if (cancelled) return;

      console.error("Error cargando historia clínica:", err);

      setError(
        "No se pudo cargar el detalle de la historia clínica."
      );
    })
    .finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

  return () => {
    cancelled = true;
  };
}, [patientId, medicalHistoryId]);

  const grids = useMemo(() => (detail ? buildGrids(detail.odontogramType) : []), [detail]);

  // Igual que en la vista de creación: Map<pieza, registros[]> para poder
  // mostrar más de un registro por pieza (ej. una obturación en distal y una
  // caries en incisal sobre el mismo diente).
  const itemsByPiece = useMemo(() => {
  const map = new Map<number, LocalToothRecordItem[]>();

  const toothRecords = detail?.toothRecords ?? [];

  toothRecords.forEach((tr) => {
    if (!tr.diagnosis) return;

    const item: LocalToothRecordItem = {
      tempId: String(tr.id),
      pieceNumbers: [tr.pieceNumber],
      recordType: tr.recordType as RecordType,
      face: tr.toothFace as ToothFace,
      diagnosisId: tr.diagnosis.id,
      diagnosisName: tr.diagnosis.name,
      diagnosisSymbol: tr.diagnosis.symbol,
      observations: tr.observations,
    };

    const currentItems = map.get(tr.pieceNumber) ?? [];

    currentItems.push(item);
    map.set(tr.pieceNumber, currentItems);
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

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 36px 60px" }}>
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

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 20px",
              fontFamily: FONT_SANS,
              fontSize: 12,
              color: C.textMuted,
              borderBottom: `1px solid ${C.border}`,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <span>
              Creado por: {fullNameOf(detail.dentist)} |{" "}
              {formatDateDisplay(detail.startDate)}
            </span>

            {editedByName && (
              <span>
                Editado por: {editedByName}
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

            <div style={{ overflowX: "auto" }}>
              {grids.map((g) => (
                <OdontogramGridView
                  key={g.key}
                  grid={g}
                  itemsByPiece={itemsByPiece}
                  onPieceClick={() => {}}
                  isReadOnly
                />
              ))}
              {/* Misma leyenda única que en el formulario de creación, sin
                  importar cuántas grillas se muestren. */}
              <FaceLegend />
            </div>

            <div style={{ marginTop: 4 }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                REGISTROS ({detail.toothRecords.length})
              </div>
              {detail.toothRecords.length === 0 && (
                <div style={{ padding: "12px 4px", fontFamily: FONT_SANS, fontSize: 12.5, color: C.textMuted, fontStyle: "italic" }}>
                  Sin registros.
                </div>
              )}
              {detail.toothRecords.map((tr) => (
                <div key={tr.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 4px", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600, color: C.textMuted, flexShrink: 0, whiteSpace: "nowrap" }}>
                        {formatDateDisplay(tr.createdAt.slice(0, 10))}
                      </span>
                      <span style={{ color: C.textMuted, flexShrink: 0, fontSize: 12 }}>·</span>
                      <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, color: C.textPrimary, flexShrink: 0 }}>
                        {formatPiece(tr.pieceNumber)}
                      </span>
                      <span style={{ color: C.textMuted, flexShrink: 0, fontSize: 12 }}>·</span>
                      <span
  style={{
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 7px",
    borderRadius: 5,
    background:
      (FACE_COLOR[tr.toothFace as ToothFace] ?? C.infoBg) + "55",
    border: `1px solid ${
      FACE_COLOR[tr.toothFace as ToothFace] ?? C.border
    }99`,
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: 600,
    color: C.textPrimary,
    flexShrink: 0,
    whiteSpace: "nowrap",
  }}
>
  {FACE_LABEL[tr.toothFace as ToothFace] ?? tr.toothFace}
</span>

<span
  style={{
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: C.textPrimary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }}
>
  {tr.diagnosis?.name ?? "Sin diagnóstico"}
</span>
                    </div>
                    <span style={{ fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: tr.recordType === "PRE_EXISTING" ? C.preExisting : C.required, flexShrink: 0 }}>
                      {tr.recordType === "PRE_EXISTING" ? "PREEXISTENTE ●" : "REQUERIDA ●"}
                    </span>
                  </div>
                  {tr.observations && (
                    <div style={{ padding: "0 4px 8px 4px", fontFamily: FONT_SANS, fontSize: 12, color: C.textSecondary, lineHeight: 1.45 }}>
                      {tr.observations}
                    </div>
                  )}
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

            {/* §8 #10: Exámenes complementarios y Medicación diaria SÍ se
                muestran en el detalle si tienen datos cargados; se omiten si
                están vacíos (igual comportamiento que "Editado por" con
                editedBy == null). */}
          {detail.complementaryExams.length > 0 && (
  <div style={{ marginTop: 16 }}>
    <div
      style={{
        fontFamily: FONT_SANS,
        fontSize: 12,
        color: C.textMuted,
        marginBottom: 6,
      }}
    >
      Exámenes complementarios
    </div>

    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {detail.complementaryExams.map((exam) => (
        <div
          key={exam.id}
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
            color: C.textPrimary,
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {exam.filename}
            </span>

            <span
              style={{
                color: C.textMuted,
                fontSize: 11,
              }}
            >
              {formatDateDisplay(exam.uploadDate?.slice(0, 10))}
            </span>
          </div>

          <span
            style={{
              color: C.textMuted,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            {exam.uploadBy
              ? `${exam.uploadBy.name} ${exam.uploadBy.lastName}`
              : ""}
          </span>
        </div>
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