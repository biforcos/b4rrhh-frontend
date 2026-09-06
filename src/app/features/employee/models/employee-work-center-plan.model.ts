/** Un tramo de fechas; `endDate` a null significa «en adelante». */
export interface WorkCenterDatePeriod {
  startDate: string;
  endDate: string | null;
}

/**
 * Un tramo que además nombra la asignación a la que pertenece. El número es null solo en la
 * asignación que el plan añadiría, que aún no tiene ninguno.
 */
export interface WorkCenterOccurrencePeriod extends WorkCenterDatePeriod {
  workCenterAssignmentNumber: number | null;
}

/** La única asignación existente que el plan movería por su cuenta: solo cambia su fecha fin (ADR-057). */
export interface WorkCenterPlanAdjustment {
  before: WorkCenterDatePeriod;
  after: WorkCenterDatePeriod;
}

export type WorkCenterPlanOperation = 'ADD' | 'REMOVE' | 'CORRECT';

export type WorkCenterPlanRejection =
  | 'OUTSIDE_PRESENCE'
  | 'OVERLAP'
  | 'GAP_NOT_ALLOWED'
  | 'IS_A_CORRECTION';

/**
 * Lo que un cambio haría a la serie de centros de trabajo antes de aplicarlo (ADR-057,
 * decisión 6): qué se cerraría, qué hueco o solape aparecería, y la serie como quedaría. Viene
 * del backend; la pantalla lo enseña y no lo recalcula.
 *
 * La cobertura es obligatoria: un hueco dentro de la presencia es un rechazo, no un aviso.
 */
export interface EmployeeWorkCenterPlanModel {
  operation: WorkCenterPlanOperation;
  accepted: boolean;
  rejection: WorkCenterPlanRejection | null;
  occurrence: WorkCenterOccurrencePeriod;
  /**
   * En una corrección, la asignación tal y como está hoy: la que `occurrence` sustituye. Es lo
   * que nombra un `IS_A_CORRECTION`, y con lo que la pantalla ofrece pasar a corregirla —por eso
   * lleva su número, que es como se pide la corrección—.
   */
  correctedOccurrence: WorkCenterOccurrencePeriod | null;
  adjustedOccurrence: WorkCenterPlanAdjustment | null;
  overlaps: ReadonlyArray<WorkCenterDatePeriod>;
  gaps: ReadonlyArray<WorkCenterDatePeriod>;
  stretchCandidates: ReadonlyArray<WorkCenterDatePeriod>;
  projected: ReadonlyArray<WorkCenterDatePeriod>;
}
