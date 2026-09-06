import { readFunctionalErrorCode } from '../shared/utils/timeline-conflict.util';

/**
 * Los códigos que el backend enumera para la serie de centros de trabajo (ADR-057).
 *
 * `ALREADY_CLOSED` y `DELETE_FORBIDDEN_AT_PRESENCE_START` se quedan aunque esta pantalla ya no
 * pueda provocarlos: el que los emite es el backend, y retirarlos es suyo. Traducidos siguen
 * diciendo algo; fuera de la lista se leerían como un fallo de red.
 */
const workCenterFunctionalErrorCodes = [
  'WORK_CENTER_OVERLAP',
  'WORK_CENTER_COVERAGE_GAP',
  'WORK_CENTER_OUTSIDE_PRESENCE',
  'WORK_CENTER_IS_A_CORRECTION',
  'WORK_CENTER_COMPANY_MISMATCH',
  'WORK_CENTER_CATALOG_NOT_FOUND',
  'WORK_CENTER_NOT_FOUND',
  'WORK_CENTER_INVALID_PERIOD',
  'WORK_CENTER_ALREADY_CLOSED',
  'WORK_CENTER_DELETE_FORBIDDEN_AT_PRESENCE_START',
] as const;

export type EmployeeWorkCenterFunctionalErrorCode = (typeof workCenterFunctionalErrorCodes)[number];

export type EmployeeWorkCenterErrorCode = EmployeeWorkCenterFunctionalErrorCode | 'request-failed';

const workCenterFunctionalErrorCodeSet = new Set<string>(workCenterFunctionalErrorCodes);

export function mapEmployeeWorkCenterErrorCode(error: unknown): EmployeeWorkCenterErrorCode {
  const functionalCode = readFunctionalErrorCode(error);

  if (functionalCode && workCenterFunctionalErrorCodeSet.has(functionalCode)) {
    return functionalCode as EmployeeWorkCenterFunctionalErrorCode;
  }

  return 'request-failed';
}
