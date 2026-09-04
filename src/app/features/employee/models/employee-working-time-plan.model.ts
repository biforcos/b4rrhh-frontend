/** Un tramo de fechas; `endDate` a null significa «en adelante». */
export interface WorkingTimeDatePeriod {
  startDate: string;
  endDate: string | null;
}

/** Una jornada nombrada por el plan. Sin número solo la que el plan añadiría. */
export interface WorkingTimePlanOccurrence extends WorkingTimeDatePeriod {
  workingTimeNumber: number | null;
}

/** La única jornada existente que el plan movería por su cuenta: solo cambia su fecha fin (ADR-057). */
export interface WorkingTimePlanAdjustment {
  workingTimeNumber: number;
  before: WorkingTimeDatePeriod;
  after: WorkingTimeDatePeriod;
}

export type WorkingTimePlanOperation = 'ADD' | 'REMOVE' | 'CORRECT';

export type WorkingTimePlanRejection = 'OUTSIDE_PRESENCE' | 'OVERLAP' | 'GAP_NOT_ALLOWED';

/**
 * Lo que un cambio haría a la serie de jornadas antes de aplicarlo (ADR-057, decisión 6): qué se
 * cerraría o reabriría, qué hueco o solape aparecería, y la serie como quedaría. Viene del backend;
 * la pantalla lo enseña y no lo recalcula.
 */
export interface EmployeeWorkingTimePlanModel {
  operation: WorkingTimePlanOperation;
  accepted: boolean;
  rejection: WorkingTimePlanRejection | null;
  occurrence: WorkingTimePlanOccurrence;
  adjustedOccurrence: WorkingTimePlanAdjustment | null;
  overlaps: ReadonlyArray<WorkingTimeDatePeriod>;
  gaps: ReadonlyArray<WorkingTimeDatePeriod>;
  stretchCandidates: ReadonlyArray<WorkingTimePlanOccurrence>;
  projected: ReadonlyArray<WorkingTimePlanOccurrence>;
}

/** Las fechas que acompañan a un rechazo de invariante (`details` del 409). */
export interface EmployeeWorkingTimeConflictModel {
  overlaps: ReadonlyArray<WorkingTimeDatePeriod>;
  gaps: ReadonlyArray<WorkingTimeDatePeriod>;
  stretchCandidates: ReadonlyArray<WorkingTimePlanOccurrence>;
}
