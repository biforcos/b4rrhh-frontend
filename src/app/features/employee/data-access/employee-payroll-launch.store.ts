import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { concat, firstValueFrom, last } from 'rxjs';

import { OperacionesGateway } from '../../nomina/operaciones/gateway/operaciones.gateway';
import {
  RETRO_LIMIT_MONTHS_BACK,
  shiftPeriod,
} from '../../nomina/operaciones/store/operaciones.store';
import { RecibosGateway } from '../../nomina/recibos/gateway/recibos.gateway';
import { PayrollBusinessKey } from '../../nomina/recibos/models/payroll-business-key.model';
import { PayrollSummaryModel } from '../../nomina/recibos/models/payroll-summary.model';
import { describeFailure, toHttpFailure } from '../../../shared/utils/http-failure.util';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeePresenceModel } from '../models/employee-presence.model';

/**
 * Lo que el botón va a hacer, dicho antes de hacerlo (`b4rrhh/frontend#97`).
 *
 * @param line la frase de una línea que se enseña para confirmar
 * @param toInvalidate los recibos del mes que no están cerrados: se invalidan para que el
 *        lanzamiento los vuelva a calcular, que es lo que el botón promete
 */
export interface EmployeePayrollLaunchPlan {
  key: EmployeeBusinessKey;
  period: string;
  retroLimit: string;
  toInvalidate: ReadonlyArray<PayrollBusinessKey>;
  line: string;
}

export type EmployeePayrollLaunchState =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'armed'; plan: EmployeePayrollLaunchPlan }
  | { kind: 'blocked'; reason: string }
  | { kind: 'launching'; plan: EmployeePayrollLaunchPlan }
  | { kind: 'failed'; reason: string };

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * «Calcular nómina» en la ficha calcula la nómina de ese empleado (`b4rrhh/frontend#97`).
 *
 * <p>Antes sólo llevaba a la pestaña del mes, y el revisor de la demo esperaba otra cosa: «el botón
 * ha perdido el sentido». Ahora lanza **para este empleado, en el período abierto**, con el límite
 * de retro por defecto y sin suelo —el mismo del recálculo desde el recibo, `b4rrhh/backend#136`—,
 * y lleva a la ejecución. Si el recibo del mes ya estaba calculado y no cerrado, se invalida antes:
 * un lanzamiento salta lo que ya tiene recibo, y «calcular» que acabara en «ya tenía recibo» sería
 * el mismo botón sin sentido con otro nombre.
 *
 * <p>Si no puede, lo dice: sin presencia en el mes no hay nómina que calcular, y un mes cerrado
 * para él no se vuelve a calcular —lo que cambie irá como atraso al siguiente—.
 */
@Injectable()
export class EmployeePayrollLaunchStore {
  private readonly recibos = inject(RecibosGateway);
  private readonly operaciones = inject(OperacionesGateway);
  private readonly router = inject(Router);

  private readonly stateSignal = signal<EmployeePayrollLaunchState>({ kind: 'idle' });
  readonly state = this.stateSignal.asReadonly();

  async prepare(
    key: EmployeeBusinessKey,
    presences: ReadonlyArray<EmployeePresenceModel>,
  ): Promise<void> {
    this.stateSignal.set({ kind: 'preparing' });
    try {
      const period = await this.openPeriod();
      const label = periodLabel(period);
      if (!presences.some((presence) => coversPeriod(presence, period))) {
        this.stateSignal.set({
          kind: 'blocked',
          reason: `${key.employeeNumber} no está de alta ningún día de ${label}: no hay nómina que calcular.`,
        });
        return;
      }

      const receipts = await this.receiptsOf(key, period);
      const open = receipts.filter((receipt) => receipt.status !== 'DEFINITIVE');
      if (receipts.length > 0 && open.length === 0) {
        this.stateSignal.set({
          kind: 'blocked',
          reason:
            `${label} ya está cerrado para ${key.employeeNumber}: ` +
            'lo que cambie irá como atraso en el mes siguiente.',
        });
        return;
      }

      const retroLimit = String(shiftPeriod(Number(period), -RETRO_LIMIT_MONTHS_BACK));
      const verb =
        open.length > 0
          ? `Recalcula ${label} de ${key.employeeNumber}: su recibo se invalida y se calcula de nuevo`
          : `Calcula ${label} de ${key.employeeNumber}`;
      this.stateSignal.set({
        kind: 'armed',
        plan: {
          key,
          period,
          retroLimit,
          toInvalidate: open.map(toBusinessKey),
          line: `${verb}, y recoge sus atrasos desde ${periodLabel(retroLimit)}. Sólo él.`,
        },
      });
    } catch (err) {
      this.stateSignal.set({
        kind: 'failed',
        reason: describeFailure('No se pudo preparar el cálculo', toHttpFailure(err)),
      });
    }
  }

  async confirm(): Promise<void> {
    const state = this.stateSignal();
    if (state.kind !== 'armed') return;
    const { plan } = state;
    this.stateSignal.set({ kind: 'launching', plan });
    try {
      if (plan.toInvalidate.length > 0) {
        await firstValueFrom(
          concat(...plan.toInvalidate.map((receipt) => this.recibos.invalidate(receipt))).pipe(
            last(),
          ),
        );
      }
      const run = await firstValueFrom(
        this.operaciones.launchCalculation({
          ruleSystemCode: plan.key.ruleSystemCode,
          payrollPeriodCode: plan.period,
          payrollTypeCode: 'NORMAL',
          calculationEngineCode: 'GRAPH',
          calculationEngineVersion: '1.0',
          targetSelection: {
            selectionType: 'SINGLE_EMPLOYEE',
            employee: {
              employeeTypeCode: plan.key.employeeTypeCode,
              employeeNumber: plan.key.employeeNumber,
            },
          },
          retroLimitPeriodCode: plan.retroLimit,
          retroFloorPeriodCode: null,
        }),
      );
      this.stateSignal.set({ kind: 'idle' });
      await this.router.navigate(['/nomina/operaciones', run.runId]);
    } catch (err) {
      this.stateSignal.set({
        kind: 'failed',
        reason: describeFailure('No se pudo lanzar el cálculo', toHttpFailure(err)),
      });
    }
  }

  cancel(): void {
    this.stateSignal.set({ kind: 'idle' });
  }

  /**
   * El período abierto: el del recibo más reciente si no está cerrado, y el siguiente si lo está
   * (la misma regla que la lista de recibos, `b4rrhh/frontend#93`). Sin ningún recibo, el mes de hoy.
   */
  private async openPeriod(): Promise<string> {
    const first = await firstValueFrom(
      this.recibos.search({ payrollPeriodCode: '', employeeNumber: '', status: '' }, 0, 1),
    );
    const latest = first.items[0];
    if (!latest) return String(currentPeriod());
    return latest.status === 'DEFINITIVE'
      ? String(shiftPeriod(Number(latest.payrollPeriodCode), 1))
      : latest.payrollPeriodCode;
  }

  private async receiptsOf(
    key: EmployeeBusinessKey,
    period: string,
  ): Promise<ReadonlyArray<PayrollSummaryModel>> {
    const page = await firstValueFrom(
      this.recibos.search({
        payrollPeriodCode: period,
        employeeNumber: key.employeeNumber,
        status: '',
      }),
    );
    return page.items.filter(
      (receipt) =>
        receipt.ruleSystemCode === key.ruleSystemCode &&
        receipt.employeeTypeCode === key.employeeTypeCode &&
        receipt.employeeNumber === key.employeeNumber &&
        receipt.payrollTypeCode === 'NORMAL',
    );
  }
}

function toBusinessKey(receipt: PayrollSummaryModel): PayrollBusinessKey {
  const { ruleSystemCode, employeeTypeCode, employeeNumber, payrollPeriodCode, payrollTypeCode } =
    receipt;
  return {
    ruleSystemCode,
    employeeTypeCode,
    employeeNumber,
    payrollPeriodCode,
    payrollTypeCode,
    presenceNumber: receipt.presenceNumber,
  };
}

/** Si la presencia tiene al menos un día dentro del mes `yyyyMM`. */
function coversPeriod(presence: EmployeePresenceModel, period: string): boolean {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  const first = `${period.slice(0, 4)}-${period.slice(4, 6)}-01`;
  const last = `${period.slice(0, 4)}-${period.slice(4, 6)}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  return presence.startDate <= last && (presence.endDate === null || presence.endDate >= first);
}

function periodLabel(period: string): string {
  return `${MONTHS[Number(period.slice(4, 6)) - 1]} de ${period.slice(0, 4)}`;
}

function currentPeriod(): number {
  const today = new Date();
  return today.getFullYear() * 100 + today.getMonth() + 1;
}
