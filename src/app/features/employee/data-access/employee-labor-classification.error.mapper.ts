export const employeeLaborClassificationKnownErrorCodes = [
  'LABOR_CLASSIFICATION_OVERLAP',
  'LABOR_CLASSIFICATION_OUTSIDE_PRESENCE',
  'LABOR_CLASSIFICATION_INCOMPLETE_COVERAGE',
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
