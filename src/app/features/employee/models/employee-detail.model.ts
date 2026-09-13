import { EmployeeBusinessKey } from './employee-business-key.model';

export interface EmployeeDetailModel extends EmployeeBusinessKey {
  /** @deprecated Identificador tecnico. La identidad publica es la business key (ADR-004). */
  id?: number;
  firstName: string;
  lastName1: string;
  lastName2: string | null;
  preferredName: string | null;
  displayName: string;
  statusLabel: string;
  workCenter: string;
  photoUrl: string | null;
}
