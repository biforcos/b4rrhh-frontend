import { EmployeeDirectoryApiModel } from '../clients/employee-read.client';

export interface EmployeeDirectoryReadModel {
  ruleSystemCode: string;
  employeeTypeCode: string;
  employeeNumber: string;
  displayName: string;
  /** El código del centro vigente, o `null` cuando no hay ninguno: el literal lo pone la pantalla. */
  workCenter: string | null;
  statusLabel: string;
}

export function mapEmployeeDirectoryApiToDirectoryModel(
  source: EmployeeDirectoryApiModel,
): EmployeeDirectoryReadModel {
  return {
    ruleSystemCode: source.ruleSystemCode,
    employeeTypeCode: source.employeeTypeCode,
    employeeNumber: source.employeeNumber,
    displayName: source.displayName,
    workCenter: normalizeWorkCenter(source.workCenterCode),
    statusLabel: source.status,
  };
}

function normalizeWorkCenter(workCenterCode: string | null): string | null {
  const normalizedCode = workCenterCode?.trim();
  return normalizedCode && normalizedCode.length > 0 ? normalizedCode : null;
}
