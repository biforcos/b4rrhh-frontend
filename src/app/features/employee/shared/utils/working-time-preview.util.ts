export interface WorkingTimePreview {
  weeklyHours: number;
  dailyHours: number;
  monthlyHours: number;
}

export function buildWorkingTimePreview(
  workingTimePercentage: number | null | undefined,
): WorkingTimePreview | null {
  if (
    workingTimePercentage === null ||
    workingTimePercentage === undefined ||
    !Number.isFinite(workingTimePercentage) ||
    workingTimePercentage <= 0 ||
    workingTimePercentage > 100
  ) {
    return null;
  }

  const percentageFactor = workingTimePercentage / 100;

  return {
    weeklyHours: roundToTwoDecimals(40 * percentageFactor),
    dailyHours: roundToTwoDecimals(8 * percentageFactor),
    monthlyHours: roundToTwoDecimals((2000 / 12) * percentageFactor),
  };
}

export function formatWorkingTimeHours(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
