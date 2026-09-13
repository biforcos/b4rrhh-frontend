import { EmployeeBusinessKey } from './employee-business-key.model';

export interface EmployeeDetailModel extends EmployeeBusinessKey {
  firstName: string;
  lastName1: string;
  lastName2: string | null;
  preferredName: string | null;
  displayName: string;
  statusLabel: string;
  workCenter: string;
  photoUrl: string | null;
}
