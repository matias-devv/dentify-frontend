// ════════════════════════════════════════════════════════════════════════════
// MedicalHistoryEditView.tsx — "Historia Clínica General" (edición) — Dentify
//
// Complementa a MedicalHistoryFormViews.tsx (MedicalHistoryCreateView /
// MedicalHistoryDetailView). Visualmente calcado del formulario de creación,
// pero:
//   - Precarga los datos vía GET /api/medical-histories/{patientId}/{medicalHistoryId}
//   - Guarda vía PATCH /api/medical-histories/{patientId}/{medicalHistoryId}
//   - Odontograma y "Registros" 100% de solo lectura (MVP): no se pueden
//     agregar/editar/borrar ToothRecords desde esta vista.
//   - Exámenes complementarios 100% de solo lectura (MVP): no hay upload acá.
//   - Alergias: el checkbox "No refiere alergias" es la única acción posible
//     (mapea a hasAllergies en el PATCH); el listado de alergias existentes
//     se muestra pero no se puede agregar/quitar (no hay endpoint para eso
//     en el código de backend provisto).
//
// ── Fuente de verdad ──
// El Requirements.md original (el que describe `null` como "borrar campo" y
// habla de un PUT con roles DENTIST/ADMIN) quedó reemplazado por el código
// real de backend que se compartió. Diferencias clave respecto al doc:
//   1) Es un PATCH, no un PUT.
//   2) `EditMedicalHistoryRequest.setNewAttributes` solo aplica un campo si
//      `!= null`. Como Jackson deserializa tanto "campo ausente" como
//      "campo con `null` explícito" al mismo `null` de Java, AMBOS casos
//      significan "no modificar" — nunca hay forma de distinguirlos ni de
//      usar `null` para borrar. La única forma de borrar pastMedicalHistory
//      / observations / dailyMedication es enviar explícitamente `""`
//      (ver la documentación de pruebas adjunta, que lo confirma).
//   3) Los roles habilitados son únicamente DENTIST (`@PreAuthorize("hasRole('DENTIST')")`),
//      no DENTIST+ADMIN como decía la doc del endpoint.
//   4) toothRecords / allergies / exams NO forman parte de este PATCH bajo
//      ningún concepto — se gestionan (a futuro) con sus propios endpoints.
//
// Este archivo asume que las siguientes piezas de MedicalHistoryFormViews.tsx
// pasan a exportarse (agregar `export` delante de cada una — no se tocó su
// implementación, solo la visibilidad):
//   C, FONT_SANS, FACE_LABEL, FACE_COLOR, buildGrids, formatPiece,
//   formatDateDisplay, fullNameOf, inputBaseStyle, FieldLabel, TextArea,
//   PrimaryButton, ModalShell, ReferenciasModal, OdontogramGridView, FaceLegend
// Los tipos (OdontogramType, LocalToothRecordItem, MedicalHistoryDetailResponse,
// etc.) ya se exportaban en el archivo original, no requieren cambios.
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from "react";
import apiClient from "../../api/apiClient"; // AJUSTAR: confirmar path relativo real en el proyecto

import {
  // tipos
  OdontogramType,
  ToothFace,
  MedicalHistoryDetailResponse,
  // tokens de diseño
  C,
  FONT_SANS,
  FACE_LABEL,
  FACE_COLOR,
  // helpers
  buildGrids,
  formatPiece,
  formatDateDisplay,
  // primitivas de UI
  inputBaseStyle,
  FieldLabel,
  TextArea,
  PrimaryButton,
  ModalShell,
  ReferenciasModal,
  OdontogramGridView,
  FaceLegend,
} from "./MedicalHistoryFormViews.tsx"; // AJUSTAR: confirmar path relativo real en el proyecto

// ════════════════════════════════════════════════════════════════
// PROPS
// ════════════════════════════════════════════════════════════════
export interface MedicalHistoryEditViewProps {
  patientId: number;
  medicalHistoryId: number;
  /**
   * Roles del usuario autenticado (mismo patrón que MedicalHistoryCreateView).
   * No estaba en el Requirements.md original, pero el backend expone el PATCH
   * únicamente con `@PreAuthorize("hasRole('DENTIST')")`: sin este gate, un
   * usuario con otro rol vería el formulario de edición y solo se enteraría
   * al fallar el guardado con 403.
   */
  roles: string[];
  /** Callback cuando el guardado fue exitoso — debe navegar a la vista de detalle. */
  onSaveSuccess: () => void;
  /** Callback cuando el usuario cancela — debe volver al detalle o al listado. */
  onCancel: () => void;
  /** Opcional: datos ya cargados por el padre, para evitar el GET inicial. */
  initialData?: MedicalHistoryDetailResponse;
}

// ════════════════════════════════════════════════════════════════
// MENSAJES DE ERROR
// ════════════════════════════════════════════════════════════════
type LoadErrorKind = "404" | "403" | "network" | "generic";

const LOAD_ERROR_MESSAGES: Record<LoadErrorKind, string> = {
  "404": "La historia clínica que intentás editar ya no existe.",
  "403": "No tenés permiso para editar esta historia clínica.",
  network: "No se pudo conectar al servidor. Verificá tu conexión e intentá de nuevo.",
  generic: "No se pudo cargar el detalle de la historia clínica.",
};

// AJUSTAR: confirmar con el back los `errorCode` reales que emite
// GlobalExceptionHandler para OdontogramTypeConflictException y
// AllergyInconsistencyException. Se usan alias razonables como fallback y,
// si no coinciden, igual se infiere la causa por el campo que cambió (ver
// handleSave) y por el status 409.
const SAVE_ERROR_MESSAGES: Record<string, string> = {
  ODONTOGRAM_TYPE_LOCKED:
    "No se puede cambiar el tipo de odontograma porque ya hay registros dentales asociados. Elimínalos primero.",
  ODONTOGRAM_TYPE_CONFLICT:
    "No se puede cambiar el tipo de odontograma porque ya hay registros dentales asociados. Elimínalos primero.",
  ALLERGY_INCONSISTENCY:
    "No se puede desactivar 'alergias' porque hay alergias registradas. Elimínalas primero.",
};

// ════════════════════════════════════════════════════════════════
// MODAL DE CONFIRMACIÓN GENÉRICO (cancelar / desactivar alergias)
// ════════════════════════════════════════════════════════════════
function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onDismiss, danger,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  danger?: boolean;
}) {
  return (
    <ModalShell title={title} onClose={onDismiss} width={420}>
      <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
        {message}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <PrimaryButton variant="secondary" onClick={onDismiss}>CANCELAR</PrimaryButton>
        <PrimaryButton variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</PrimaryButton>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════════
export function MedicalHistoryEditView({
  patientId,
  medicalHistoryId,
  roles,
  onSaveSuccess,
  onCancel,
  initialData,
}: MedicalHistoryEditViewProps) {
  const isDentist = roles.includes("ROLE_DENTIST");

  // ── Carga de datos ──
  const [detail, setDetail] = useState<MedicalHistoryDetailResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [loadErrorKind, setLoadErrorKind] = useState<LoadErrorKind | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (initialData) return; // Fase 1: si ya vino precargado desde el padre, no se pide de nuevo.

    let cancelled = false;
    setLoading(true);
    setLoadErrorKind(null);

    apiClient
      .get<MedicalHistoryDetailResponse>(`/api/medical-histories/${patientId}/${medicalHistoryId}`)
      .then((res) => {
        if (cancelled) return;
        setDetail({
          ...res.data,
          toothRecords: res.data.toothRecords ?? [],
          allergies: res.data.allergies ?? [],
          complementaryExams: res.data.complementaryExams ?? [],
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 404) setLoadErrorKind("404");
        else if (status === 403) setLoadErrorKind("403");
        else if (!err?.response) setLoadErrorKind("network");
        else setLoadErrorKind("generic");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, medicalHistoryId, initialData, retryKey]);

  // ── Estado del formulario (Fase 1: precarga desde `detail`) ──
  const [odontogramType, setOdontogramType] = useState<OdontogramType>("ADULT");
  const [pastMedicalHistory, setPastMedicalHistory] = useState("");
  const [observations, setObservations] = useState("");
  const [dailyMedication, setDailyMedication] = useState("");
  const [noAllergies, setNoAllergies] = useState(false);

  useEffect(() => {
    if (!detail) return;
    setOdontogramType(detail.odontogramType);
    setPastMedicalHistory(detail.pastMedicalHistory ?? "");
    setObservations(detail.observations ?? "");
    setDailyMedication(detail.dailyMedication ?? "");
    setNoAllergies(!detail.hasAllergies);
  }, [detail]);

  const [showReferencias, setShowReferencias] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showAllergyWarning, setShowAllergyWarning] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Odontograma (Fase 2) — 100% solo lectura ──
  const grids = useMemo(() => buildGrids(odontogramType), [odontogramType]);

  const itemsByPiece = useMemo(() => {
    const map = new Map<number, any[]>();
    const toothRecords = detail?.toothRecords ?? [];
    toothRecords.forEach((tr) => {
      if (!tr.diagnosis) return;
      const item = {
        tempId: String(tr.id),
        pieceNumbers: [tr.pieceNumber],
        recordType: tr.recordType,
        face: tr.toothFace as ToothFace,
        diagnosisId: tr.diagnosis.id,
        diagnosisName: tr.diagnosis.name,
        diagnosisSymbol: tr.diagnosis.symbol,
        observations: tr.observations,
      };
      const arr = map.get(tr.pieceNumber) ?? [];
      arr.push(item);
      map.set(tr.pieceNumber, arr);
    });
    return map;
  }, [detail]);

  const hasExistingToothRecords = (detail?.toothRecords.length ?? 0) > 0;
  const hasExistingAllergies = (detail?.allergies.length ?? 0) > 0;

  // ── Detección de cambios ──
  const hasOdontogramTypeChanged = !!detail && odontogramType !== detail.odontogramType;
  const hasPastMedicalHistoryChanged = !!detail && pastMedicalHistory !== (detail.pastMedicalHistory ?? "");
  const hasObservationsChanged = !!detail && observations !== (detail.observations ?? "");
  const hasDailyMedicationChanged = !!detail && dailyMedication !== (detail.dailyMedication ?? "");
  const hasAllergiesFlagChanged = !!detail && noAllergies !== !detail.hasAllergies;

  const hasUnsavedChanges =
    hasOdontogramTypeChanged ||
    hasPastMedicalHistoryChanged ||
    hasObservationsChanged ||
    hasDailyMedicationChanged ||
    hasAllergiesFlagChanged;

  // ── Toggle "No refiere alergias" ──
  const handleToggleNoAllergies = (checked: boolean) => {
    // Caso 3: si el usuario intenta desmarcar "no refiere alergias" estando
    // ya marcada (o marcarla estando desmarcada) y hay alergias existentes,
    // se advierte antes de aplicar el cambio localmente. El PATCH igual
    // puede fallar con conflicto — no hay endpoint en este MVP para borrar
    // las alergias existentes desde acá.
    if (checked && hasExistingAllergies) {
      setShowAllergyWarning(true);
      return;
    }
    setNoAllergies(checked);
  };

  // ── Guardado (PATCH) ──
  const buildPatchBody = useCallback((): Record<string, unknown> => {
    if (!detail) return {};
    const body: Record<string, unknown> = {};
    // Campos de texto: solo se incluyen si cambiaron. Para "borrar" un campo
    // hay que enviar "" explícito (no `null` — el backend lo ignora, ver
    // nota de cabecera). Al incluir el campo con el valor actual (vacío o
    // no) ya queda correctamente expresado.
    if (hasPastMedicalHistoryChanged) body.pastMedicalHistory = pastMedicalHistory.trim();
    if (hasObservationsChanged) body.observations = observations.trim();
    if (hasDailyMedicationChanged) body.dailyMedication = dailyMedication.trim();
    if (hasAllergiesFlagChanged) body.hasAllergies = !noAllergies;
    if (hasOdontogramTypeChanged) body.odontogramType = odontogramType;
    return body;
  }, [
    detail,
    hasPastMedicalHistoryChanged, pastMedicalHistory,
    hasObservationsChanged, observations,
    hasDailyMedicationChanged, dailyMedication,
    hasAllergiesFlagChanged, noAllergies,
    hasOdontogramTypeChanged, odontogramType,
  ]);

  const handleSave = async () => {
    if (!detail || !hasUnsavedChanges) return;
    setSaveError(null);
    setSaving(true);

    const body = buildPatchBody();

    try {
      await apiClient.patch(`/api/medical-histories/${patientId}/${medicalHistoryId}`, body);
      onSaveSuccess();
    } catch (err: any) {
      const status = err?.response?.status;
      const code: string | undefined = err?.response?.data?.errorCode ?? err?.response?.data?.error_code;

      if (code && SAVE_ERROR_MESSAGES[code]) {
        setSaveError(SAVE_ERROR_MESSAGES[code]);
        if (code.startsWith("ODONTOGRAM")) setOdontogramType(detail.odontogramType);
        if (code.startsWith("ALLERGY")) setNoAllergies(!detail.hasAllergies);
      } else if (status === 409 || status === 400) {
        // Sin errorCode reconocido: se infiere la causa por el campo que
        // efectivamente cambió, priorizando odontogramType (caso 2) sobre
        // hasAllergies (caso 3), ya que ambos no pueden fallar a la vez en
        // la misma llamada según la lógica del servicio.
        if (hasOdontogramTypeChanged) {
          setSaveError(SAVE_ERROR_MESSAGES.ODONTOGRAM_TYPE_LOCKED);
          setOdontogramType(detail.odontogramType);
        } else if (hasAllergiesFlagChanged) {
          setSaveError(SAVE_ERROR_MESSAGES.ALLERGY_INCONSISTENCY);
          setNoAllergies(!detail.hasAllergies);
        } else {
          setSaveError(err?.response?.data?.message ?? "Uno de los campos enviados no es válido.");
        }
      } else if (status === 404) {
        setSaveError(LOAD_ERROR_MESSAGES["404"]);
      } else if (status === 403) {
        setSaveError(LOAD_ERROR_MESSAGES["403"]);
      } else if (!err?.response) {
        setSaveError(LOAD_ERROR_MESSAGES.network);
      } else {
        setSaveError(err?.response?.data?.message ?? "No se pudo guardar los cambios. Intentá nuevamente.");
      }
      // El formulario conserva su estado — no se resetea ante un error.
    } finally {
      setSaving(false);
    }
  };

  // ── Cancelar ──
  const handleCancelClick = () => {
    if (hasUnsavedChanges) {
      setShowCancelConfirm(true);
      return;
    }
    onCancel();
  };

  // ════════════════════════════════════════════════════════════
  // GATE de rol — mismo criterio que MedicalHistoryCreateView, alineado
  // con @PreAuthorize("hasRole('DENTIST')") del backend.
  // ════════════════════════════════════════════════════════════
  if (!isDentist) {
    return (
      <div style={{ padding: "48px 36px", fontFamily: FONT_SANS }}>
        <div style={{
          background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 10,
          padding: 20, color: C.warnText, fontSize: 13, maxWidth: 480,
        }}>
          Solo un odontólogo puede editar una Historia Clínica General. Tu usuario no tiene los
          permisos necesarios.
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // ESTADO DE CARGA
  // ════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div style={{ padding: 48, fontFamily: FONT_SANS, color: C.textMuted }}>
        Cargando historia clínica…
      </div>
    );
  }

  if (loadErrorKind || !detail) {
    const kind = loadErrorKind ?? "generic";
    const message = LOAD_ERROR_MESSAGES[kind];
    return (
      <div style={{ padding: 48, fontFamily: FONT_SANS }}>
        <div style={{
          background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 10,
          padding: 20, color: C.errorText, fontSize: 13, maxWidth: 480, marginBottom: 16,
        }}>
          {message}
        </div>
        {kind === "404" && <PrimaryButton onClick={onCancel}>VOLVER AL LISTADO</PrimaryButton>}
        {kind === "403" && <PrimaryButton onClick={onCancel}>VOLVER</PrimaryButton>}
        {(kind === "network" || kind === "generic") && (
          <PrimaryButton onClick={() => setRetryKey((k) => k + 1)}>REINTENTAR</PrimaryButton>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ════════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: C.bg, fontFamily: FONT_SANS }}>
      {/* Header */}
      <div style={{
        background: C.cardBg, borderBottom: `1px solid ${C.border}`, padding: "18px 36px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h2 style={{ fontFamily: FONT_SANS, fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0, letterSpacing: "0.02em" }}>
          HISTORIA CLÍNICA GENERAL
        </h2>
        <div style={{ display: "flex", gap: 10 }}>
          <PrimaryButton variant="secondary" onClick={handleCancelClick} disabled={saving}>
            CANCELAR
          </PrimaryButton>
          <PrimaryButton onClick={handleSave} disabled={saving || !hasUnsavedChanges}>
            {saving ? "GUARDANDO…" : "GUARDAR"}
          </PrimaryButton>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 36px 60px" }}>
        {saveError && (
          <div style={{
            background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8,
            padding: "10px 14px", color: C.errorText, fontSize: 13, marginBottom: 20, maxWidth: 960,
          }}>
            {saveError}
          </div>
        )}

        <div style={{ maxWidth: 960, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          {/* ── Evolución general ── */}
          <h4 style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, color: C.textPrimary, marginTop: 0, marginBottom: 16 }}>
            Evolución general
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <FieldLabel>Fecha</FieldLabel>
              {/* No editable — fecha clínica auditada, ver notas del endpoint. */}
              <div style={{ ...inputBaseStyle, background: C.infoBg, color: C.textSecondary, cursor: "default" }}>
                {formatDateDisplay(detail.startDate)}
              </div>
            </div>
            <div>
              <FieldLabel required>Tipo de odontograma</FieldLabel>
              <select
                value={odontogramType}
                disabled={hasExistingToothRecords}
                onChange={(e) => setOdontogramType(e.target.value as OdontogramType)}
                style={{
                  ...inputBaseStyle,
                  background: hasExistingToothRecords ? C.infoBg : C.cardBg,
                  cursor: hasExistingToothRecords ? "not-allowed" : "pointer",
                }}
              >
                <option value="ADULT">Adulto</option>
                <option value="PEDIATRIC">Infantil</option>
                <option value="MIX">Mixto</option>
              </select>
            </div>
          </div>

          {hasExistingToothRecords && (
            <div style={{ fontFamily: FONT_SANS, fontSize: 11.5, color: C.textMuted, marginBottom: 20 }}>
              No se puede cambiar el tipo de odontograma porque ya hay registros dentales asociados. Elimínalos primero.
            </div>
          )}
          {!hasExistingToothRecords && <div style={{ marginBottom: 12 }} />}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span title='Agregar registros dentales no está disponible en edición. Crea una nueva historia clínica o utiliza el detalle.'>
              <PrimaryButton disabled>+ PRESTACIÓN</PrimaryButton>
            </span>
            <PrimaryButton variant="secondary" onClick={() => setShowReferencias(true)}>
              ⓘ REFERENCIAS
            </PrimaryButton>
          </div>

          {/* ── Odontograma (solo lectura) ── */}
          <div style={{ overflowX: "auto" }}>
            {grids.map((g) => (
              <OdontogramGridView key={g.key} grid={g} itemsByPiece={itemsByPiece} onPieceClick={() => {}} isReadOnly />
            ))}
            <FaceLegend />
          </div>

          {/* ── Registros (solo lectura: existentes desde backend) ── */}
          <ReadOnlyRegistrosList toothRecords={detail.toothRecords} />

          {/* ── Antecedentes médicos ── */}
          <div style={{ marginTop: 24 }}>
            <FieldLabel>Antecedentes médicos</FieldLabel>
            <TextArea value={pastMedicalHistory} onChange={setPastMedicalHistory} maxLength={5000} rows={3} />
          </div>

          {/* ── Exámenes complementarios (solo lectura) ── */}
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Exámenes complementarios</FieldLabel>
            {detail.complementaryExams.length === 0 ? (
              <div style={{ fontFamily: FONT_SANS, fontSize: 12.5, color: C.textMuted, fontStyle: "italic" }}>
                Sin exámenes cargados.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {detail.complementaryExams.map((exam) => (
                  <div key={exam.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", background: C.infoBg, border: `1px solid ${C.infoBorder}`,
                    borderRadius: 6, fontFamily: FONT_SANS, fontSize: 12.5, color: C.textPrimary, gap: 16,
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {exam.filename}
                      </span>
                      <span style={{ color: C.textMuted, fontSize: 11 }}>
                        {formatDateDisplay(exam.uploadDate?.slice(0, 10))}
                      </span>
                    </div>
                    <span style={{ color: C.textMuted, fontSize: 11, flexShrink: 0 }}>
                      {exam.uploadBy ? `${exam.uploadBy.name} ${exam.uploadBy.lastName}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: C.textMuted, marginTop: 6 }}>
              Subir nuevos exámenes no está disponible en edición (MVP).
            </div>
          </div>

          {/* ── Observaciones ── */}
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Observaciones</FieldLabel>
            <TextArea value={observations} onChange={setObservations} maxLength={5000} rows={3} />
          </div>

          {/* ── Alergias ── */}
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Alergias (Primera consulta)</FieldLabel>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={noAllergies}
                onChange={(e) => handleToggleNoAllergies(e.target.checked)}
              />
              No refiere alergias
            </label>

            {!noAllergies && detail.allergies.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <FieldLabel>Alergias registradas</FieldLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {detail.allergies.map((a) => (
                    <span key={a.id} style={{
                      padding: "3px 8px", borderRadius: 6, background: C.activeItemBg,
                      border: `1px solid ${C.border}`, fontFamily: FONT_SANS, fontSize: 12,
                      color: C.electric, fontWeight: 600,
                    }}>
                      {a.allergyName}
                    </span>
                  ))}
                </div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                  Agregar o quitar alergias no está disponible en edición (MVP).
                </div>
              </div>
            )}
          </div>

          {/* ── Medicación diaria ── */}
          <div style={{ marginTop: 20 }}>
            <FieldLabel>Medicación diaria</FieldLabel>
            <TextArea value={dailyMedication} onChange={setDailyMedication} maxLength={2000} rows={2} />
          </div>
        </div>
      </div>

      {showReferencias && <ReferenciasModal onClose={() => setShowReferencias(false)} />}

      {showCancelConfirm && (
        <ConfirmDialog
          title="Cambios sin guardar"
          message="¿Estás seguro? Los cambios no guardados se perderán."
          confirmLabel="DESCARTAR CAMBIOS"
          danger
          onConfirm={() => { setShowCancelConfirm(false); onCancel(); }}
          onDismiss={() => setShowCancelConfirm(false)}
        />
      )}

      {showAllergyWarning && (
        <ConfirmDialog
          title="Alergias registradas"
          message="Hay alergias registradas para esta historia clínica. ¿Estás seguro de que el paciente no refiere alergias? Si continúan registradas, el guardado va a fallar hasta que se eliminen primero."
          confirmLabel="CONFIRMAR"
          danger
          onConfirm={() => { setShowAllergyWarning(false); setNoAllergies(true); }}
          onDismiss={() => setShowAllergyWarning(false)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// REGISTROS — listado de solo lectura de ToothRecords ya persistidos
// (mismo estilo visual que la sección "Registros" del formulario de
// creación / detalle, sin acciones de editar/borrar).
// ════════════════════════════════════════════════════════════════
function ReadOnlyRegistrosList({ toothRecords }: { toothRecords: MedicalHistoryDetailResponse["toothRecords"] }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 0", background: "transparent", border: "none",
          borderTop: `1px solid ${C.border}`, cursor: "pointer",
        }}
      >
        <span style={{ fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em" }}>
          REGISTROS ({toothRecords.length})
        </span>
        <span style={{ color: C.textMuted, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && toothRecords.length === 0 && (
        <div style={{ padding: "12px 4px", fontFamily: FONT_SANS, fontSize: 12.5, color: C.textMuted, fontStyle: "italic" }}>
          Sin registros.
        </div>
      )}

      {open && toothRecords.map((tr) => (
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
              <span style={{
                display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 5,
                background: (FACE_COLOR[tr.toothFace as ToothFace] ?? C.infoBg) + "55",
                border: `1px solid ${FACE_COLOR[tr.toothFace as ToothFace] ?? C.border}99`,
                fontFamily: FONT_SANS, fontSize: 11, fontWeight: 600, color: C.textPrimary,
                flexShrink: 0, whiteSpace: "nowrap",
              }}>
                {FACE_LABEL[tr.toothFace as ToothFace] ?? tr.toothFace}
              </span>
              <span style={{
                fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {tr.diagnosis?.name ?? "Sin diagnóstico"}
              </span>
            </div>
            <span style={{
              fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
              color: tr.recordType === "PRE_EXISTING" ? C.preExisting : C.required, flexShrink: 0,
            }}>
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
  );
}