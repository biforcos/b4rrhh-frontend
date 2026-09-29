import { EmployeeStatus } from '../models/employee-detail.model';

/**
 * Lo que cabe hacer con el ciclo de vida de un empleado (`b4rrhh/frontend#111`).
 *
 * `PLANNED` es lo que ya está grabado y todavía no ha llegado: no se ofrece otra vez, se dice
 * cuándo pasa. `NONE` es que no hay nada que ofrecer: sin estado, o sin ninguna presencia que
 * reabrir.
 */
export type EmployeeLifecycleAction =
  | { kind: 'TERMINATE' }
  | { kind: 'REHIRE' }
  | { kind: 'PLANNED'; event: 'TERMINATION' | 'REHIRE' | 'HIRE'; date: string }
  | { kind: 'NONE' };

export interface EmployeePlannedDates {
  plannedTerminationDate: string | null;
  plannedHireDate: string | null;
}

/**
 * El único sitio que decide qué acción de ciclo de vida cabe, para el estado que dice el servidor
 * (`b4rrhh/backend#148`) y sus fechas previstas. Antes el menú miraba sólo si el estado era
 * `ACTIVE`, y a quien tenía la readmisión grabada le ofrecía readmitir, que el backend rechaza.
 */
export function lifecycleActionFor(
  status: EmployeeStatus | null,
  planned: EmployeePlannedDates,
): EmployeeLifecycleAction {
  switch (status) {
    case 'ACTIVE':
      return planned.plannedTerminationDate
        ? { kind: 'PLANNED', event: 'TERMINATION', date: planned.plannedTerminationDate }
        : { kind: 'TERMINATE' };
    case 'TERMINATED':
      return planned.plannedHireDate
        ? { kind: 'PLANNED', event: 'REHIRE', date: planned.plannedHireDate }
        : { kind: 'REHIRE' };
    case 'NOT_HIRED':
      return planned.plannedHireDate
        ? { kind: 'PLANNED', event: 'HIRE', date: planned.plannedHireDate }
        : { kind: 'NONE' };
    default:
      return { kind: 'NONE' };
  }
}
