import {
  formatLongDisplayDate,
  formatLongDisplayDateRange,
} from '../../../../shared/utils/local-date.util';
import {
  EmployeeWorkingTimeConflictModel,
  EmployeeWorkingTimePlanModel,
  WorkingTimeDatePeriod,
  WorkingTimePlanAdjustment,
  WorkingTimePlanOccurrence,
  WorkingTimePlanOperation,
} from '../../models/employee-working-time-plan.model';

export type WorkingTimePlanTone = 'info' | 'warning' | 'error';

/** El plan contado en castellano y con fechas: lo que la pantalla enseña antes de confirmar. */
export interface WorkingTimePlanNotice {
  tone: WorkingTimePlanTone;
  lines: ReadonlyArray<string>;
}

export const WORKING_TIME_PLAN_NO_OTHER_CHANGE = 'No cambia ninguna otra jornada.';
export const WORKING_TIME_PLAN_OUTSIDE_PRESENCE =
  'La jornada quedaría fuera de la presencia del empleado.';

/**
 * Redacta lo que un plan haría (ADR-057): qué jornada se cerrará o reabrirá y hasta cuándo, o
 * por qué no se puede aplicar —el hueco o el solape con sus fechas y las vecinas que se
 * podrían alargar—. No decide nada: el plan viene del backend.
 */
export function describeWorkingTimePlan(plan: EmployeeWorkingTimePlanModel): WorkingTimePlanNotice {
  if (!plan.accepted) {
    return { tone: 'error', lines: describeRejection(plan) };
  }

  if (!plan.adjustedOccurrence) {
    return { tone: 'info', lines: [WORKING_TIME_PLAN_NO_OTHER_CHANGE] };
  }

  return { tone: 'warning', lines: [describeAdjustment(plan.operation, plan.adjustedOccurrence)] };
}

/**
 * El mismo relato para un rechazo que llega al aplicar (el `409`), cuando trae fechas. Null
 * si el código no es de invariante o el error no dice dónde: la pantalla cae al texto genérico.
 */
export function describeWorkingTimeConflict(
  errorCode: string | null,
  conflict: EmployeeWorkingTimeConflictModel | null,
): string | null {
  if (!conflict) {
    return null;
  }

  if (errorCode === 'WORKING_TIME_COVERAGE_GAP' && conflict.gaps.length > 0) {
    return [
      ...describeGaps(conflict.gaps),
      ...describeStretchCandidates(conflict.stretchCandidates),
    ].join(' ');
  }

  if (errorCode === 'WORKING_TIME_OVERLAP' && conflict.overlaps.length > 0) {
    return describeOverlaps(conflict.overlaps).join(' ');
  }

  return null;
}

function describeAdjustment(
  operation: WorkingTimePlanOperation,
  adjustment: WorkingTimePlanAdjustment,
): string {
  const since = formatLongDisplayDate(adjustment.before.startDate);
  const until = adjustment.after.endDate;

  if (operation === 'ADD') {
    return until
      ? `La jornada en vigor desde el ${since} se cerrará el ${formatLongDisplayDate(until)}.`
      : `La jornada en vigor desde el ${since} quedará en vigor.`;
  }

  if (operation === 'REMOVE') {
    return until
      ? `La jornada anterior, desde el ${since}, se reabrirá hasta el ${formatLongDisplayDate(until)}.`
      : `La jornada anterior, desde el ${since}, se reabrirá y quedará en vigor.`;
  }

  return until
    ? `La jornada desde el ${since} pasará a terminar el ${formatLongDisplayDate(until)}.`
    : `La jornada desde el ${since} pasará a quedar en vigor.`;
}

function describeRejection(plan: EmployeeWorkingTimePlanModel): ReadonlyArray<string> {
  switch (plan.rejection) {
    case 'OUTSIDE_PRESENCE':
      return [WORKING_TIME_PLAN_OUTSIDE_PRESENCE];
    case 'OVERLAP':
      return describeOverlaps(plan.overlaps);
    case 'GAP_NOT_ALLOWED':
      return [...describeGaps(plan.gaps), ...describeStretchCandidates(plan.stretchCandidates)];
    default:
      return ['El cambio no se puede aplicar.'];
  }
}

function describeGaps(gaps: ReadonlyArray<WorkingTimeDatePeriod>): ReadonlyArray<string> {
  if (gaps.length === 0) {
    return ['Quedaría un hueco en la presencia del empleado.'];
  }

  return gaps.map(
    (gap) => `Quedaría un hueco ${formatLongDisplayDateRange(gap.startDate, gap.endDate)}.`,
  );
}

function describeOverlaps(overlaps: ReadonlyArray<WorkingTimeDatePeriod>): ReadonlyArray<string> {
  if (overlaps.length === 0) {
    return ['Se solaparía con otra jornada.'];
  }

  return overlaps.map(
    (overlap) =>
      `Se solaparía con otra jornada ${formatLongDisplayDateRange(overlap.startDate, overlap.endDate)}.`,
  );
}

function describeStretchCandidates(
  candidates: ReadonlyArray<WorkingTimePlanOccurrence>,
): ReadonlyArray<string> {
  return candidates.map(
    (candidate) =>
      `Antes se puede alargar la jornada ${formatLongDisplayDateRange(candidate.startDate, candidate.endDate)}.`,
  );
}
