import {
  EmployeeWorkingTimeConflictModel,
  WorkingTimeDatePeriod,
  WorkingTimePlanOccurrence,
} from '../models/employee-working-time-plan.model';

const workingTimeFunctionalErrorCodes = [
  'WORKING_TIME_NOT_FOUND',
  'WORKING_TIME_INVALID_PERCENTAGE',
  'WORKING_TIME_INVALID_PERIOD',
  'WORKING_TIME_OVERLAP',
  'WORKING_TIME_COVERAGE_GAP',
  'WORKING_TIME_OUTSIDE_PRESENCE',
  'WORKING_TIME_NUMBER_CONFLICT',
  'WORKING_TIME_ALREADY_CLOSED',
] as const;

export type EmployeeWorkingTimeFunctionalErrorCode =
  (typeof workingTimeFunctionalErrorCodes)[number];
export type EmployeeWorkingTimeErrorCode =
  | EmployeeWorkingTimeFunctionalErrorCode
  | 'request-failed';

const workingTimeFunctionalErrorCodeSet = new Set<string>(workingTimeFunctionalErrorCodes);

export function mapEmployeeWorkingTimeErrorCode(error: unknown): EmployeeWorkingTimeErrorCode {
  const functionalCode = extractFunctionalCode(error);

  if (functionalCode && workingTimeFunctionalErrorCodeSet.has(functionalCode)) {
    return functionalCode as EmployeeWorkingTimeFunctionalErrorCode;
  }

  return 'request-failed';
}

/**
 * Las fechas que el backend adjunta a un rechazo de invariante (`details.gaps`,
 * `details.overlaps`, `details.stretchCandidates`). Vacías cuando el error no las trae.
 */
export function mapEmployeeWorkingTimeConflict(error: unknown): EmployeeWorkingTimeConflictModel {
  const details = extractDetails(error);

  return {
    overlaps: readPeriods(details?.['overlaps']),
    gaps: readPeriods(details?.['gaps']),
    stretchCandidates: readOccurrences(details?.['stretchCandidates']),
  };
}

function extractDetails(error: unknown): Record<string, unknown> | null {
  if (!isRecord(error)) {
    return null;
  }

  if (isRecord(error['details'])) {
    return error['details'];
  }

  if (isRecord(error['error']) && isRecord(error['error']['details'])) {
    return error['error']['details'];
  }

  return null;
}

function readPeriods(value: unknown): ReadonlyArray<WorkingTimeDatePeriod> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPeriod).map((period) => ({
    startDate: period['startDate'],
    endDate: typeof period['endDate'] === 'string' ? period['endDate'] : null,
  }));
}

function readOccurrences(value: unknown): ReadonlyArray<WorkingTimePlanOccurrence> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPeriod).map((occurrence) => ({
    workingTimeNumber:
      typeof occurrence['workingTimeNumber'] === 'number' ? occurrence['workingTimeNumber'] : null,
    startDate: occurrence['startDate'],
    endDate: typeof occurrence['endDate'] === 'string' ? occurrence['endDate'] : null,
  }));
}

function isPeriod(value: unknown): value is Record<string, unknown> & { startDate: string } {
  return isRecord(value) && typeof value['startDate'] === 'string';
}

function extractFunctionalCode(error: unknown): string | null {
  if (!isRecord(error)) {
    return null;
  }

  if (typeof error['code'] === 'string') {
    return error['code'];
  }

  if (isRecord(error['error']) && typeof error['error']['code'] === 'string') {
    return error['error']['code'];
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
