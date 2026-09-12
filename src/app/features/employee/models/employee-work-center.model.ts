export interface EmployeeWorkCenterModel {
  workCenterAssignmentNumber: number;
  workCenterCode: string;
  workCenterName?: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}
