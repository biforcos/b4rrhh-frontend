const workingTimeFunctionalErrorCodes = [
  'WORKING_TIME_NOT_FOUND',
  'WORKING_TIME_INVALID_PERCENTAGE',
  'WORKING_TIME_INVALID_PERIOD',
  'WORKING_TIME_OVERLAP',
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
