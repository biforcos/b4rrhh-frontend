/** Un tramo de fechas; `endDate` a null significa «en adelante». */
export interface CostCenterDatePeriod {
  startDate: string;
  endDate: string | null;
}

/** La única ventana existente que el plan movería por su cuenta: solo cambia su fecha fin (ADR-057). */
export interface CostCenterPlanAdjustment {
  before: CostCenterDatePeriod;
  after: CostCenterDatePeriod;
}

export type CostCenterPlanOperation = 'ADD' | 'REMOVE' | 'CORRECT';

export type CostCenterPlanRejection =
  | 'OUTSIDE_PRESENCE'
  | 'OVERLAP'
  | 'GAP_NOT_ALLOWED'
  | 'IS_A_CORRECTION';

/**
 * Lo que un cambio haría a la serie de distribuciones antes de aplicarlo (ADR-057, decisión 6).
 * La ocurrencia es la ventana —el conjunto de líneas que comparten fecha de inicio—, no la
 * línea, y se nombra por el día en que empieza.
 *
 * Es la única serie del producto con **cobertura opcional** (`backend#54`): un hueco no impide
 * nada. El plan vuelve aceptado y con el hueco dentro, para que la pantalla lo cuente.
 */
export interface EmployeeCostCenterPlanModel {
  operation: CostCenterPlanOperation;
  accepted: boolean;
  rejection: CostCenterPlanRejection | null;
  occurrence: CostCenterDatePeriod;
  /**
   * En una corrección, la ventana tal y como está hoy: la que `occurrence` sustituye. Es lo que
   * nombra un `IS_A_CORRECTION`, y con lo que la pantalla ofrece pasar a corregirla.
   */
  correctedOccurrence: CostCenterDatePeriod | null;
  adjustedOccurrence: CostCenterPlanAdjustment | null;
  overlaps: ReadonlyArray<CostCenterDatePeriod>;
  gaps: ReadonlyArray<CostCenterDatePeriod>;
  stretchCandidates: ReadonlyArray<CostCenterDatePeriod>;
  projected: ReadonlyArray<CostCenterDatePeriod>;
}
