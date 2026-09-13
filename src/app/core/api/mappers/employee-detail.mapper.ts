import { EmployeeReadApiModel } from '../clients/employee-read.client';

export interface EmployeeDetailReadModel {
  /** @deprecated Identificador tecnico. La identidad publica es la business key (ADR-004). */
  id?: number;
  ruleSystemCode: string;
  employeeTypeCode: string;
  employeeNumber: string;
  firstName: string;
  lastName1: string;
  lastName2: string | null;
  preferredName: string | null;
  displayName: string;
  statusLabel: string;
  workCenter: string;
  photoUrl: string | null;
}

const pendingWorkCenterLabel = 'Pending assignment';

export function mapEmployeeReadApiToDetailModel(
  source: EmployeeReadApiModel,
): EmployeeDetailReadModel {
  return {
    id: source.id,
    ruleSystemCode: source.ruleSystemCode,
    employeeTypeCode: source.employeeTypeCode,
    employeeNumber: source.employeeNumber,
    firstName: source.firstName,
    lastName1: source.lastName1,
    lastName2: source.lastName2,
    preferredName: source.preferredName,
    displayName: source.displayName,
    statusLabel: source.status,
    workCenter: pendingWorkCenterLabel,
    photoUrl: source.photoUrl ?? null,
  };
}
