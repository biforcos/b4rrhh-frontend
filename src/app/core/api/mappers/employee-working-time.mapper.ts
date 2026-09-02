import { EmployeeWorkingTimeApiModel } from '../clients/employee-working-time-read.client';

export interface EmployeeWorkingTimeReadModel {
  workingTimeNumber: number;
  startDate: string;
  endDate: string | null;
  workingTimePercentage: number;
  weeklyHours: number;
  dailyHours: number;
  monthlyHours: number;
  isActive: boolean;
}

export function mapEmployeeWorkingTimeApiToReadModel(
  source: EmployeeWorkingTimeApiModel,
): EmployeeWorkingTimeReadModel | null {
  const workingTimeNumber = source.workingTimeNumber;
  const startDate = source.startDate.trim();

  if (!Number.isInteger(workingTimeNumber) || workingTimeNumber <= 0 || startDate.length === 0) {
    return null;
  }

  if (
    !isFiniteNumber(source.workingTimePercentage) ||
    source.workingTimePercentage <= 0 ||
    source.workingTimePercentage > 100
  ) {
    return null;
  }

  if (
    !isFinitePositiveNumber(source.weeklyHours) ||
    !isFinitePositiveNumber(source.dailyHours) ||
    !isFinitePositiveNumber(source.monthlyHours)
  ) {
    return null;
  }

  const endDate = normalizeOptionalValue(source.endDate);

  return {
    workingTimeNumber,
    startDate,
    endDate,
    workingTimePercentage: source.workingTimePercentage,
    weeklyHours: source.weeklyHours,
    dailyHours: source.dailyHours,
    monthlyHours: source.monthlyHours,
    isActive: endDate === null,
  };
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFinitePositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}
