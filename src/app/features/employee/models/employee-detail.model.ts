import { EmployeeBusinessKey } from './employee-business-key.model';

/**
 * El estado del empleado en una fecha, tal como lo dice el servidor: lo lee de las presencias y no
 * lo guarda (b4rrhh/backend#148). El día del cese todavía es alta; la baja empieza al siguiente.
 */
export type EmployeeStatus = 'ACTIVE' | 'TERMINATED' | 'NOT_HIRED';

export interface EmployeeDetailModel extends EmployeeBusinessKey {
  firstName: string;
  lastName1: string;
  lastName2: string | null;
  preferredName: string | null;
  displayName: string;
  statusLabel: string;
  status: EmployeeStatus;
  /** Primer día del estado actual; `null` si aún no hay alta. */
  statusSince: string | null;
  /** De alta, el último día del tramo si tiene cese grabado. */
  plannedTerminationDate: string | null;
  /** Sin alta o de baja, el día en que empieza la siguiente presencia si la hay. */
  plannedHireDate: string | null;
  workCenter: string;
  photoUrl: string | null;
}
