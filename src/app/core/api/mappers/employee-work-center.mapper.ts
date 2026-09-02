import { EmployeeWorkCenterApiModel } from '../clients/employee-work-center-read.client';

export interface EmployeeWorkCenterReadModel {
  workCenterAssignmentNumber: number;
  workCenterCode: string;
  workCenterName: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  canDelete: boolean;
  startsAtPresenceStart: boolean;
  deleteForbiddenReason: 'starts-at-presence-start' | null;
}

export function mapEmployeeWorkCenterApiToReadModel(
  source: EmployeeWorkCenterApiModel,
): EmployeeWorkCenterReadModel | null {
  const workCenterCode = source.workCenterCode.trim().toUpperCase();
  const startDate = source.startDate.trim();

  if (!workCenterCode || !startDate) {
    return null;
  }

  const endDate = normalizeOptionalValue(source.endDate);
  const startsAtPresenceStart = source.startsAtPresenceStart === true;
  const hasDeleteForbiddenByPresenceReason =
    source.deleteForbiddenReason?.trim().toUpperCase() === 'STARTS_AT_PRESENCE_START';
  const deleteForbiddenByPresenceReason =
    startsAtPresenceStart || hasDeleteForbiddenByPresenceReason;
  const canDelete = source.canDelete ?? !deleteForbiddenByPresenceReason;

  return {
    workCenterAssignmentNumber: source.workCenterAssignmentNumber,
    workCenterCode,
    workCenterName: normalizeOptionalValue(source.workCenterName),
    startDate,
    endDate,
    isActive: endDate === null,
    canDelete,
    startsAtPresenceStart,
    deleteForbiddenReason: deleteForbiddenByPresenceReason ? 'starts-at-presence-start' : null,
  };
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}
