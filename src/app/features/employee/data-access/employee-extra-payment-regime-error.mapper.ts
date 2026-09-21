import {
  EmployeeExtraPaymentRegimeConflictModel,
  ExtraPaymentRegimeDatePeriod,
  ExtraPaymentRegimePlanOccurrence,
} from '../models/employee-extra-payment-regime-plan.model';

const extraPaymentRegimeFunctionalErrorCodes = [
  'EXTRA_PAYMENT_REGIME_NOT_FOUND',
  'EXTRA_PAYMENT_REGIME_INVALID_PERCENTAGE',
  'EXTRA_PAYMENT_REGIME_INVALID_PERIOD',
  'EXTRA_PAYMENT_REGIME_OVERLAP',
  'EXTRA_PAYMENT_REGIME_COVERAGE_GAP',
  'EXTRA_PAYMENT_REGIME_OUTSIDE_PRESENCE',
  'EXTRA_PAYMENT_REGIME_NUMBER_CONFLICT',
  'EXTRA_PAYMENT_REGIME_ALREADY_CLOSED',
  // El alta que empieza el mismo dia que otra regimen de pagas extras no es un alta: es su correccion, y el
  // backend lo dice nombrandola (backend#58). Sin este codigo aqui, el 409 caia en
  // `request-failed` y el aviso no sabia que decir justo cuando el backend lo explicaba.
  'EXTRA_PAYMENT_REGIME_IS_A_CORRECTION',
] as const;

export type EmployeeExtraPaymentRegimeFunctionalErrorCode =
  (typeof extraPaymentRegimeFunctionalErrorCodes)[number];
export type EmployeeExtraPaymentRegimeErrorCode =
  | EmployeeExtraPaymentRegimeFunctionalErrorCode
  | 'request-failed';

const extraPaymentRegimeFunctionalErrorCodeSet = new Set<string>(
  extraPaymentRegimeFunctionalErrorCodes,
);

export function mapEmployeeExtraPaymentRegimeErrorCode(
  error: unknown,
): EmployeeExtraPaymentRegimeErrorCode {
  const functionalCode = extractFunctionalCode(error);

  if (functionalCode && extraPaymentRegimeFunctionalErrorCodeSet.has(functionalCode)) {
    return functionalCode as EmployeeExtraPaymentRegimeFunctionalErrorCode;
  }

  return 'request-failed';
}

/**
 * Las fechas que el backend adjunta a un rechazo de invariante (`details.gaps`,
 * `details.overlaps`, `details.stretchCandidates`). Vacías cuando el error no las trae.
 */
export function mapEmployeeExtraPaymentRegimeConflict(
  error: unknown,
): EmployeeExtraPaymentRegimeConflictModel {
  const details = extractDetails(error);

  return {
    overlaps: readPeriods(details?.['overlaps']),
    gaps: readPeriods(details?.['gaps']),
    stretchCandidates: readOccurrences(details?.['stretchCandidates']),
    correctedOccurrence: readOccurrence(details?.['correctedOccurrence']),
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

function readPeriods(value: unknown): ReadonlyArray<ExtraPaymentRegimeDatePeriod> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPeriod).map((period) => ({
    startDate: period['startDate'],
    endDate: typeof period['endDate'] === 'string' ? period['endDate'] : null,
  }));
}

function readOccurrences(value: unknown): ReadonlyArray<ExtraPaymentRegimePlanOccurrence> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPeriod).map((occurrence) => ({
    extraPaymentRegimeNumber:
      typeof occurrence['extraPaymentRegimeNumber'] === 'number'
        ? occurrence['extraPaymentRegimeNumber']
        : null,
    startDate: occurrence['startDate'],
    endDate: typeof occurrence['endDate'] === 'string' ? occurrence['endDate'] : null,
  }));
}

/** Una sola ocurrencia: la regimen de pagas extras que el 409 nombra como la que habria que corregir. */
function readOccurrence(value: unknown): ExtraPaymentRegimePlanOccurrence | null {
  return isPeriod(value) ? readOccurrences([value])[0] : null;
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
