import { PayrollPeriod } from '../../../shared/utils/payroll-period.util';

/**
 * El año natural de un empleado, para la tira de «Lo que pasa cada mes» (`b4rrhh/frontend#109`).
 * Lo sirve una sola consulta (`b4rrhh/backend#151`): doce meses no son doce viajes por carril.
 */
export interface EmployeeYearModel {
  readonly year: number;
  readonly presences: ReadonlyArray<EmployeeYearPresence>;
  /** Siempre doce, enero primero. */
  readonly months: ReadonlyArray<EmployeeYearMonth>;
  /** Las que tocan el año, enteras aunque empiecen o acaben fuera de él. */
  readonly absences: ReadonlyArray<EmployeeYearAbsence>;
}

export interface EmployeeYearPresence {
  readonly startDate: string;
  /** Nulo: sigue abierta. */
  readonly endDate: string | null;
}

/** Cerrado es que todos sus recibos del mes son definitivos; sin recibo, nulo. */
export type EmployeeYearPayrollState = 'OPEN' | 'CLOSED' | null;

export interface EmployeeYearMonth {
  readonly period: PayrollPeriod;
  readonly payrollState: EmployeeYearPayrollState;
  readonly payrollInputCount: number;
  readonly activeRetroMarkCount: number;
  readonly consumedRetroMarkCount: number;
}

export interface EmployeeYearAbsence {
  readonly absenceTypeCode: string;
  readonly startDate: string;
  /** Nulo: sigue abierta. */
  readonly endDate: string | null;
}
