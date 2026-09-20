import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PayrollService } from '../../../../core/api/generated/api/payroll.service';
import { PayrollEngineService } from '../../../../core/api/generated/api/payroll-engine.service';
import { PayslipSectionResponse } from '../../../../core/api/generated/model/payslip-section-response';
import { PayrollSummaryResponse } from '../../../../core/api/generated/model/payroll-summary-response';
import { PayrollResponse } from '../../../../core/api/generated/model/payroll-response';
import { PayrollCalculationStepResponse } from '../../../../core/api/generated/model/payroll-calculation-step-response';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { RecibosFilters } from '../models/recibos-filters.model';

@Injectable({ providedIn: 'root' })
export class RecibosClient {
  private readonly api = inject(PayrollService);
  private readonly engineApi = inject(PayrollEngineService);

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

  /**
   * Cerrar el recibo: el acto humano del ADR-059, y el único que no se deshace.
   *
   * La operación estaba servida desde marzo y no la llamaba nadie (`backend#90`). El motor decía
   * si un recibo era válido y las personas no podían decir que estuviera cerrado, que es la mitad
   * que da nombre al ADR.
   */
  finalize(key: PayrollBusinessKey): Observable<PayrollResponse> {
    return this.api.finalizePayroll({
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

  /**
   * Los bloques del modelo oficial de recibo, declarados en el catálogo (`b4rrhh/backend#109`).
   *
   * Va contra `PayrollEngineService` y no contra `PayrollService` porque las secciones son del
   * catálogo y no del recibo: un recibo trae el código del bloque en el que salió cada línea, y
   * esto es lo que le pone nombre y sitio a ese código.
   */
  listPayslipSections(ruleSystemCode: string): Observable<Array<PayslipSectionResponse>> {
    return this.engineApi.listPayslipSections({ ruleSystemCode });
  }
}
