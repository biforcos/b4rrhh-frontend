export interface EmployeeWorkingTimeModel {
  workingTimeNumber: number;
  startDate: string;
  endDate: string | null;
  workingTimePercentage: number;
  weeklyHours: number;
  dailyHours: number;
  monthlyHours: number;
  isActive: boolean;
}
