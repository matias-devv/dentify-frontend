// ════════════════════════════════════════════════════════════════════════════
// medicalHistory.types.ts — Tipos del módulo Historial Clínico — Dentify
// Espejo del contrato backend MedicalHistorySummaryResponse (Requirements.md §6)
// TypeScript estricto · cero any
// ════════════════════════════════════════════════════════════════════════════

export interface DentistRef {
  id: number;
  fullName: string;
}

export interface EditedByRef {
  id: number;
  fullName: string;
}

// AJUSTAR: confirmar los valores reales del enum OdontogramType en el backend
export type OdontogramType = "ADULT" | "MIX" | "PEDIATRIC";

export interface MedicalHistorySummaryResponse {
  id: number;
  startDate: string; // "YYYY-MM-DD"
  odontogramType: OdontogramType;
  observations: string | null;
  pastMedicalHistory: string | null; // no se muestra en esta vista de listado (§3)
  hasAllergies: boolean;
  dailyMedication: string | null; // no se muestra en esta vista de listado (§3)
  dentist: DentistRef;
  editedBy: EditedByRef | null;
  allergyCount: number;
  toothRecordCount: number;
  examCount: number;
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
}

/**
 * Datos mínimos del paciente para el header de esta vista.
 * El endpoint find-all no expone nombre/edad/fecha de nacimiento del paciente
 * (Requirements.md §9, AJUSTAR). Se resuelve con la opción (a): PacientesListView
 * los pasa por location.state al navegar. Si el usuario llega por deep-link sin
 * ese state, patientHeader es null y la vista cae a un fallback visual.
 */
export interface PatientHeaderInfo {
  id: number;
  fullName: string;
  birthDate: string | null;
}