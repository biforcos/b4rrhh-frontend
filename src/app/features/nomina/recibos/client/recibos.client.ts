import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PayrollService } from '../../../../core/api/generated/api/payroll.service';
import { PayrollSummaryResponse } from '../../../../core/api/generated/model/payroll-summary-response';
import { PayrollResponse } from '../../../../core/api/generated/model/payroll-response';
import { PayrollCalculationStepResponse } from '../../../../core/api/generated/model/payroll-calculation-step-response';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { RecibosFilters } from '../models/recibos-filters.model';

@Injectable({ providedIn: 'root' })
export class RecibosClient {
  private readonly api = inject(PayrollService);

  search(filters: RecibosFilters): Observable<Array<PayrollSummaryResponse>> {
    return this.api.searchPayrolls({
      payrollPeriodCode: filters.payrollPeriodCode || undefined,
      employeeNumber: filters.employeeNumber || undefined,
      status: filters.status || undefined,
    });
  }

  getByBusinessKey(key: PayrollBusinessKey): Observable<PayrollResponse> {
    return this.api.getPayrollByBusinessKey({
      ruleSystemCode: key.ruleSystemCode,
      employeeTypeCode: key.employeeTypeCode,
      employeeNumber: key.employeeNumber,
      payrollPeriodCode: key.payrollPeriodCode,
      payrollTypeCode: key.payrollTypeCode,
      presenceNumber: key.presenceNumber,
    });
  }

  /** Los pasos con los que el motor calculo este recibo, en orden de ejecucion. */
  listCalculationSteps(key: PayrollBusinessKey): Observable<Array<PayrollCalculationStepResponse>> {
    return this.api.listPayrollCalculationSteps({
      ruleSystemCode: key.ruleSystemCode,
      employeeTypeCode: key.employeeTypeCode,
      employeeNumber: key.employeeNumber,
      payrollPeriodCode: key.payrollPeriodCode,
      payrollTypeCode: key.payrollTypeCode,
      presenceNumber: key.presenceNumber,
    });
  }

  invalidate(key: PayrollBusinessKey): Observable<PayrollResponse> {
    return this.api.invalidatePayroll({
      ruleSystemCode: key.ruleSystemCode,
      employeeTypeCode: key.employeeTypeCode,
      employeeNumber: key.employeeNumber,
      payrollPeriodCode: key.payrollPeriodCode,
      payrollTypeCode: key.payrollTypeCode,
      presenceNumber: key.presenceNumber,
      invalidatePayrollRequest: { statusReasonCode: 'MANUAL_INVALIDATION' },
    });
  }

  validate(key: PayrollBusinessKey): Observable<PayrollResponse> {
    return this.api.validatePayroll({
      ruleSystemCode: key.ruleSystemCode,
      employeeTypeCode: key.employeeTypeCode,
      employeeNumber: key.employeeNumber,
      payrollPeriodCode: key.payrollPeriodCode,
      payrollTypeCode: key.payrollTypeCode,
      presenceNumber: key.presenceNumber,
    });
  }

  recalculate(key: PayrollBusinessKey): Observable<PayrollResponse> {
    return this.api.recalculatePayroll({
      ruleSystemCode: key.ruleSystemCode,
      employeeTypeCode: key.employeeTypeCode,
      employeeNumber: key.employeeNumber,
      payrollPeriodCode: key.payrollPeriodCode,
      payrollTypeCode: key.payrollTypeCode,
      presenceNumber: key.presenceNumber,
    });
  }
}
