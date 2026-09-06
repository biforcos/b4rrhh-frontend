import { readFunctionalErrorCode } from '../shared/utils/timeline-conflict.util';

/** Los códigos que el backend enumera en `AddressErrorResponse` (ADR-057). */
const addressFunctionalErrorCodes = [
  'ADDRESS_NOT_FOUND',
  'ADDRESS_INVALID_REQUEST',
  'ADDRESS_OVERLAP',
  'ADDRESS_COVERAGE_GAP',
  'ADDRESS_IS_A_CORRECTION',
  'ADDRESS_TYPE_COVERAGE_NOT_DECLARED',
] as const;

export type EmployeeAddressFunctionalErrorCode = (typeof addressFunctionalErrorCodes)[number];
export type EmployeeAddressErrorCode = EmployeeAddressFunctionalErrorCode | 'request-failed';

const addressFunctionalErrorCodeSet = new Set<string>(addressFunctionalErrorCodes);

export function mapEmployeeAddressErrorCode(error: unknown): EmployeeAddressErrorCode {
  const functionalCode = readFunctionalErrorCode(error);

  if (functionalCode && addressFunctionalErrorCodeSet.has(functionalCode)) {
    return functionalCode as EmployeeAddressFunctionalErrorCode;
  }

  return 'request-failed';
}
