import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { EmployeePayrollInputService } from '../../../core/api/generated/api/employee-payroll-input.service';
import { PayrollEngineService } from '../../../core/api/generated/api/payroll-engine.service';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';

export interface EmployeeInputConcept {
  label: string;
  conceptCode: string;
}

export interface PayrollInputItem {
  conceptCode: string;
  quantity: number;
}

export interface PayrollInputCreateDraft {
  conceptCode: string;
  period: number;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class EmployeePayrollInputGateway {
  private readonly api = inject(EmployeePayrollInputService);
  private readonly payrollEngineApi = inject(PayrollEngineService);

  listEmployeeInputConcepts(ruleSystemCode: string): Observable<EmployeeInputConcept[]> {
    return this.payrollEngineApi.listPayrollConcepts({ ruleSystemCode }).pipe(
      map((concepts) =>
        concepts
          .filter((c) => c.calculationType === 'EMPLOYEE_INPUT')
          .map((c) => ({
            label: `${c.conceptCode} — ${c.conceptMnemonic}`,
            conceptCode: c.conceptCode,
          })),
      ),
      catchError(() => of([])),
    );
  }

  listInputs(
    key: EmployeeBusinessKey,
    period: number,
  ): Observable<ReadonlyArray<PayrollInputItem>> {
    const k = toEmployeeBusinessKey(key);
    return this.api
      .listEmployeePayrollInputsByBusinessKey({
        ruleSystemCode: k.ruleSystemCode,
        employeeTypeCode: k.employeeTypeCode,
        employeeNumber: k.employeeNumber,
        period,
      })
      .pipe(
        // Sin empleado es un 404 que pasa: ya no se lee como «no tiene entradas» (b4rrhh/backend#144).
        map((res) => res.inputs.map((i) => ({ conceptCode: i.conceptCode, quantity: i.quantity }))),
      );
  }

  createInput(key: EmployeeBusinessKey, draft: PayrollInputCreateDraft): Observable<void> {
    const k = toEmployeeBusinessKey(key);
    return this.api
      .createEmployeePayrollInputByBusinessKey({
        ruleSystemCode: k.ruleSystemCode,
        employeeTypeCode: k.employeeTypeCode,
        employeeNumber: k.employeeNumber,
        createEmployeePayrollInputRequest: {
          conceptCode: draft.conceptCode,
          period: draft.period,
          quantity: draft.quantity,
        },
      })
      .pipe(map(() => undefined));
  }

  updateInput(
    key: EmployeeBusinessKey,
    conceptCode: string,
    period: number,
    quantity: number,
  ): Observable<void> {
    const k = toEmployeeBusinessKey(key);
    return this.api
      .updateEmployeePayrollInputByBusinessKey({
        ruleSystemCode: k.ruleSystemCode,
        employeeTypeCode: k.employeeTypeCode,
        employeeNumber: k.employeeNumber,
        conceptCode,
        period,
        updateEmployeePayrollInputRequest: { quantity },
      })
      .pipe(map(() => undefined));
  }

  deleteInput(key: EmployeeBusinessKey, conceptCode: string, period: number): Observable<void> {
    const k = toEmployeeBusinessKey(key);
    return this.api
      .deleteEmployeePayrollInputByBusinessKey({
        ruleSystemCode: k.ruleSystemCode,
        employeeTypeCode: k.employeeTypeCode,
        employeeNumber: k.employeeNumber,
        conceptCode,
        period,
      })
      .pipe(map(() => undefined));
  }
}
