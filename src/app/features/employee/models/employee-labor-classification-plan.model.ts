/** Un tramo de fechas; `endDate` a null significa «en adelante». */
export interface LaborClassificationDatePeriod {
  startDate: string;
  endDate: string | null;
}

/**
 * La única clasificación existente que el plan movería por su cuenta: solo cambia su fecha fin
 * (ADR-057).
 */
export interface LaborClassificationPlanAdjustment {
  before: LaborClassificationDatePeriod;
  after: LaborClassificationDatePeriod;
}

export type LaborClassificationPlanOperation = 'ADD' | 'REMOVE' | 'CORRECT';

export type LaborClassificationPlanRejection =
  | 'OUTSIDE_PRESENCE'
  | 'OVERLAP'
  | 'GAP_NOT_ALLOWED'
  | 'IS_A_CORRECTION';

/**
 * Lo que un cambio haría a la serie de clasificaciones antes de aplicarlo (ADR-057, decisión 6):
 * qué se cerraría, qué hueco o solape aparecería, y la serie como quedaría. Viene del backend; la
 * pantalla lo enseña y no lo recalcula.
 */
export interface EmployeeLaborClassificationPlanModel {
  operation: LaborClassificationPlanOperation;
  accepted: boolean;
  rejection: LaborClassificationPlanRejection | null;
  occurrence: LaborClassificationDatePeriod;
  /**
   * En una corrección, la clasificación tal y como está hoy: la que `occurrence` sustituye. Es lo
   * que nombra un `IS_A_CORRECTION`, y con lo que la pantalla ofrece pasar a corregirla.
   */
  correctedOccurrence: LaborClassificationDatePeriod | null;
  adjustedOccurrence: LaborClassificationPlanAdjustment | null;
  overlaps: ReadonlyArray<LaborClassificationDatePeriod>;
  gaps: ReadonlyArray<LaborClassificationDatePeriod>;
  stretchCandidates: ReadonlyArray<LaborClassificationDatePeriod>;
  projected: ReadonlyArray<LaborClassificationDatePeriod>;
}

/** Las fechas que acompañan a un rechazo de invariante (`details` del 409). */
export interface EmployeeLaborClassificationConflictModel {
  overlaps: ReadonlyArray<LaborClassificationDatePeriod>;
  gaps: ReadonlyArray<LaborClassificationDatePeriod>;
  stretchCandidates: ReadonlyArray<LaborClassificationDatePeriod>;
  correctedOccurrence: LaborClassificationDatePeriod | null;
}
