import { EmployeeWorkCenterApiModel } from '../clients/employee-work-center-read.client';

export interface EmployeeWorkCenterReadModel {
  workCenterAssignmentNumber: number;
  workCenterCode: string;
  workCenterName: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
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

  return {
    workCenterAssignmentNumber: source.workCenterAssignmentNumber,
    workCenterCode,
    workCenterName: normalizeOptionalValue(source.workCenterName),
    startDate,
    endDate,
    isActive: endDate === null,
  };
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}
