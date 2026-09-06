import {
  EmployeeLaborClassificationConflictModel,
  LaborClassificationDatePeriod,
} from '../models/employee-labor-classification-plan.model';

export const employeeLaborClassificationKnownErrorCodes = [
  'LABOR_CLASSIFICATION_OVERLAP',
  'LABOR_CLASSIFICATION_OUTSIDE_PRESENCE',
  'LABOR_CLASSIFICATION_INCOMPLETE_COVERAGE',
  'LABOR_CLASSIFICATION_IS_A_CORRECTION',
  'LABOR_CLASSIFICATION_INVALID_PERIOD',
  'LABOR_CLASSIFICATION_ALREADY_CLOSED',
  'LABOR_CLASSIFICATION_NOT_FOUND',
  'AGREEMENT_NOT_FOUND',
  'AGREEMENT_CATEGORY_NOT_FOUND',
  'AGREEMENT_CATEGORY_RELATION_INVALID',
] as const;

export type EmployeeLaborClassificationFunctionalErrorCode =
  (typeof employeeLaborClassificationKnownErrorCodes)[number];

export type EmployeeLaborClassificationErrorCode =
  | EmployeeLaborClassificationFunctionalErrorCode
  | 'request-failed';

export function mapEmployeeLaborClassificationErrorCode(
  error: unknown,
): EmployeeLaborClassificationErrorCode {
  const rawErrorCode =
    typeof error === 'object' && error !== null && 'error' in error
      ? (error as { error?: { code?: unknown } }).error?.code
      : null;

  if (typeof rawErrorCode !== 'string') {
    return 'request-failed';
  }

  const normalizedErrorCode = rawErrorCode.trim().toUpperCase();
  if (
    employeeLaborClassificationKnownErrorCodes.includes(
      normalizedErrorCode as EmployeeLaborClassificationFunctionalErrorCode,
    )
  ) {
    return normalizedErrorCode as EmployeeLaborClassificationFunctionalErrorCode;
  }

  return 'request-failed';
}

/**
 * Las fechas que el backend adjunta a un rechazo de invariante (`details.gaps`,
 * `details.overlaps`, `details.stretchCandidates`, `details.correctedOccurrence`). Vacías cuando
 * el error no las trae.
 */
export function mapEmployeeLaborClassificationConflict(
  error: unknown,
): EmployeeLaborClassificationConflictModel {
  const details = extractDetails(error);

  return {
    overlaps: readPeriods(details?.['overlaps']),
    gaps: readPeriods(details?.['gaps']),
    stretchCandidates: readPeriods(details?.['stretchCandidates']),
    correctedOccurrence: readPeriod(details?.['correctedOccurrence']),
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

function readPeriods(value: unknown): ReadonlyArray<LaborClassificationDatePeriod> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPeriod).map(toPeriod);
}

function readPeriod(value: unknown): LaborClassificationDatePeriod | null {
  return isPeriod(value) ? toPeriod(value) : null;
}

function toPeriod(
  source: Record<string, unknown> & { startDate: string },
): LaborClassificationDatePeriod {
  return {
    startDate: source['startDate'],
    endDate: typeof source['endDate'] === 'string' ? source['endDate'] : null,
  };
}

function isPeriod(value: unknown): value is Record<string, unknown> & { startDate: string } {
  return isRecord(value) && typeof value['startDate'] === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
