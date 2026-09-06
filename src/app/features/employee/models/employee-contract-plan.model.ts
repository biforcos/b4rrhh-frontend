/** Un tramo de fechas; `endDate` a null significa «en adelante». */
export interface ContractDatePeriod {
  startDate: string;
  endDate: string | null;
}

/** El único contrato existente que el plan movería por su cuenta: solo cambia su fecha fin (ADR-057). */
export interface ContractPlanAdjustment {
  before: ContractDatePeriod;
  after: ContractDatePeriod;
}

export type ContractPlanOperation = 'ADD' | 'REMOVE' | 'CORRECT';

export type ContractPlanRejection =
  | 'OUTSIDE_PRESENCE'
  | 'OVERLAP'
  | 'GAP_NOT_ALLOWED'
  | 'IS_A_CORRECTION';

/**
 * Lo que un cambio haría a la serie de contratos antes de aplicarlo (ADR-057, decisión 6): qué se
 * cerraría, qué hueco o solape aparecería, y la serie como quedaría. Viene del backend; la
 * pantalla lo enseña y no lo recalcula.
 */
export interface EmployeeContractPlanModel {
  operation: ContractPlanOperation;
  accepted: boolean;
  rejection: ContractPlanRejection | null;
  occurrence: ContractDatePeriod;
  /**
   * En una corrección, el contrato tal y como está hoy: el que `occurrence` sustituye. Es lo que
   * nombra un `IS_A_CORRECTION`, y con lo que la pantalla ofrece pasar a corregirlo.
   */
  correctedOccurrence: ContractDatePeriod | null;
  adjustedOccurrence: ContractPlanAdjustment | null;
  overlaps: ReadonlyArray<ContractDatePeriod>;
  gaps: ReadonlyArray<ContractDatePeriod>;
  stretchCandidates: ReadonlyArray<ContractDatePeriod>;
  projected: ReadonlyArray<ContractDatePeriod>;
}

/** Las fechas que acompañan a un rechazo de invariante (`details` del 409). */
export interface EmployeeContractConflictModel {
  overlaps: ReadonlyArray<ContractDatePeriod>;
  gaps: ReadonlyArray<ContractDatePeriod>;
  stretchCandidates: ReadonlyArray<ContractDatePeriod>;
  correctedOccurrence: ContractDatePeriod | null;
}
