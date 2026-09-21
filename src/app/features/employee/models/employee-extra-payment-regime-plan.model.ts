/** Un tramo de fechas; `endDate` a null significa «en adelante». */
export interface ExtraPaymentRegimeDatePeriod {
  startDate: string;
  endDate: string | null;
}

/** Una regimen de pagas extras nombrada por el plan. Sin número solo la que el plan añadiría. */
export interface ExtraPaymentRegimePlanOccurrence extends ExtraPaymentRegimeDatePeriod {
  extraPaymentRegimeNumber: number | null;
}

/** La única regimen de pagas extras existente que el plan movería por su cuenta: solo cambia su fecha fin (ADR-057). */
export interface ExtraPaymentRegimePlanAdjustment {
  extraPaymentRegimeNumber: number;
  before: ExtraPaymentRegimeDatePeriod;
  after: ExtraPaymentRegimeDatePeriod;
}

export type ExtraPaymentRegimePlanOperation = 'ADD' | 'REMOVE' | 'CORRECT';

export type ExtraPaymentRegimePlanRejection =
  | 'OUTSIDE_PRESENCE'
  | 'OVERLAP'
  | 'GAP_NOT_ALLOWED'
  | 'IS_A_CORRECTION';

/**
 * Lo que un cambio haría a la serie de regimen de pagas extrass antes de aplicarlo (ADR-057, decisión 6): qué se
 * cerraría o reabriría, qué hueco o solape aparecería, y la serie como quedaría. Viene del backend;
 * la pantalla lo enseña y no lo recalcula.
 */
export interface EmployeeExtraPaymentRegimePlanModel {
  operation: ExtraPaymentRegimePlanOperation;
  accepted: boolean;
  rejection: ExtraPaymentRegimePlanRejection | null;
  occurrence: ExtraPaymentRegimePlanOccurrence;
  /**
   * En una corrección, la regimen de pagas extras tal y como está hoy: la que `occurrence` sustituye. Es lo que
   * nombra un `IS_A_CORRECTION`, y con lo que la pantalla ofrece pasar a corregirla.
   */
  correctedOccurrence: ExtraPaymentRegimePlanOccurrence | null;
  adjustedOccurrence: ExtraPaymentRegimePlanAdjustment | null;
  overlaps: ReadonlyArray<ExtraPaymentRegimeDatePeriod>;
  gaps: ReadonlyArray<ExtraPaymentRegimeDatePeriod>;
  stretchCandidates: ReadonlyArray<ExtraPaymentRegimePlanOccurrence>;
  projected: ReadonlyArray<ExtraPaymentRegimePlanOccurrence>;
}

/** Las fechas que acompañan a un rechazo de invariante (`details` del 409). */
export interface EmployeeExtraPaymentRegimeConflictModel {
  overlaps: ReadonlyArray<ExtraPaymentRegimeDatePeriod>;
  gaps: ReadonlyArray<ExtraPaymentRegimeDatePeriod>;
  stretchCandidates: ReadonlyArray<ExtraPaymentRegimePlanOccurrence>;
  /** La regimen de pagas extras que el alta rechazada corregiría, cuando el 409 es `IS_A_CORRECTION`. */
  correctedOccurrence: ExtraPaymentRegimePlanOccurrence | null;
}
