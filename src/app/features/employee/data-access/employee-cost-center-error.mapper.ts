import { readFunctionalErrorCode } from '../shared/utils/timeline-conflict.util';

/**
 * Los códigos que el backend enumera para la serie de distribuciones (ADR-057).
 *
 * No hay `COST_CENTER_COVERAGE_GAP` en la lista de rechazos que esta pantalla puede provocar:
 * la serie declara cobertura opcional (`backend#54`) y ninguna operación lo devuelve. Sigue
 * traducido por si el backend lo emitiera algún día.
 *
 * `ALREADY_CLOSED`, `REPLACE_NO_ACTIVE_WINDOW` y `CLOSE_IMPOSSIBLE_START_DATE` son de los
 * endpoints `deprecated` que esta pantalla ya no llama; retirarlos es del backend.
 */
const costCenterFunctionalErrorCodes = [
  'COST_CENTER_INVALID_WINDOW',
  'COST_CENTER_OVERLAP',
  'COST_CENTER_COVERAGE_GAP',
  'COST_CENTER_OUTSIDE_PRESENCE',
  'COST_CENTER_IS_A_CORRECTION',
  'COST_CENTER_CATALOG_NOT_FOUND',
  'COST_CENTER_DISTRIBUTION_NOT_FOUND',
  'COST_CENTER_DISTRIBUTION_ALREADY_CLOSED',
  'COST_CENTER_REPLACE_NO_ACTIVE_WINDOW',
  'COST_CENTER_CLOSE_IMPOSSIBLE_START_DATE',
] as const;

export type EmployeeCostCenterFunctionalErrorCode = (typeof costCenterFunctionalErrorCodes)[number];

export type EmployeeCostCenterErrorCode = EmployeeCostCenterFunctionalErrorCode | 'request-failed';

const costCenterFunctionalErrorCodeSet = new Set<string>(costCenterFunctionalErrorCodes);

export function mapEmployeeCostCenterErrorCode(error: unknown): EmployeeCostCenterErrorCode {
  const functionalCode = readFunctionalErrorCode(error);

  if (functionalCode && costCenterFunctionalErrorCodeSet.has(functionalCode)) {
    return functionalCode as EmployeeCostCenterFunctionalErrorCode;
  }

  return 'request-failed';
}
