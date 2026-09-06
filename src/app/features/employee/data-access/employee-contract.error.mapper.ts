import {
  ContractDatePeriod,
  EmployeeContractConflictModel,
} from '../models/employee-contract-plan.model';

/** Los códigos que el backend enumera en `ContractErrorResponse` (ADR-057). */
const contractFunctionalErrorCodes = [
  'CONTRACT_NOT_FOUND',
  'CONTRACT_EMPLOYEE_NOT_FOUND',
  'CONTRACT_INVALID_REQUEST',
  'CONTRACT_OVERLAP',
  'CONTRACT_COVERAGE_GAP',
  'CONTRACT_OUTSIDE_PRESENCE',
  'CONTRACT_IS_A_CORRECTION',
  'CONTRACT_ALREADY_CLOSED',
] as const;

export type EmployeeContractFunctionalErrorCode = (typeof contractFunctionalErrorCodes)[number];
export type EmployeeContractErrorCode = EmployeeContractFunctionalErrorCode | 'request-failed';

const contractFunctionalErrorCodeSet = new Set<string>(contractFunctionalErrorCodes);

export function mapEmployeeContractErrorCode(error: unknown): EmployeeContractErrorCode {
  const functionalCode = extractFunctionalCode(error);

  if (functionalCode && contractFunctionalErrorCodeSet.has(functionalCode)) {
    return functionalCode as EmployeeContractFunctionalErrorCode;
  }

  return 'request-failed';
}

/**
 * Las fechas que el backend adjunta a un rechazo de invariante (`details.gaps`,
 * `details.overlaps`, `details.stretchCandidates`, `details.correctedOccurrence`). Vacías cuando
 * el error no las trae.
 */
export function mapEmployeeContractConflict(error: unknown): EmployeeContractConflictModel {
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

function readPeriods(value: unknown): ReadonlyArray<ContractDatePeriod> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPeriod).map(toPeriod);
}

function readPeriod(value: unknown): ContractDatePeriod | null {
  return isPeriod(value) ? toPeriod(value) : null;
}

function toPeriod(source: Record<string, unknown> & { startDate: string }): ContractDatePeriod {
  return {
    startDate: source['startDate'],
    endDate: typeof source['endDate'] === 'string' ? source['endDate'] : null,
  };
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
