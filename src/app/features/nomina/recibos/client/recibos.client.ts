import { HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PayrollService } from '../../../../core/api/generated/api/payroll.service';
import { PayrollEngineService } from '../../../../core/api/generated/api/payroll-engine.service';
import { PayslipSectionResponse } from '../../../../core/api/generated/model/payslip-section-response';
import { PayrollSearchPageResponse } from '../../../../core/api/generated/model/payroll-search-page-response';
import { PayrollResponse } from '../../../../core/api/generated/model/payroll-response';
import { PayrollCalculationStepResponse } from '../../../../core/api/generated/model/payroll-calculation-step-response';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { RecibosFilters } from '../models/recibos-filters.model';
import { ArrearExplanationResponse } from '../../../../core/api/generated/model/arrear-explanation-response';

@Injectable({ providedIn: 'root' })
export class RecibosClient {
  private readonly api = inject(PayrollService);
  private readonly engineApi = inject(PayrollEngineService);

  /** Una página de la búsqueda, con el total (`b4rrhh/frontend#93`). */
  search(
    filters: RecibosFilters,
    page: number,
    size: number,
  ): Observable<PayrollSearchPageResponse> {
    return this.api.searchPayrolls({
      payrollPeriodCode: filters.payrollPeriodCode || undefined,
      employeeNumber: filters.employeeNumber || undefined,
      status: filters.status || undefined,
      page,
      size,
    });
  }

  /** De dónde sale cada línea de atraso del recibo (`backend#134`). */
  explainArrears(key: PayrollBusinessKey): Observable<Array<ArrearExplanationResponse>> {
    return this.api.explainPayrollArrears({
      ruleSystemCode: key.ruleSystemCode,
      employeeTypeCode: key.employeeTypeCode,
      employeeNumber: key.employeeNumber,
      payrollPeriodCode: key.payrollPeriodCode,
      payrollTypeCode: key.payrollTypeCode,
      presenceNumber: key.presenceNumber,
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

  /**
   * El documento del recibo, con su respuesta entera (`b4rrhh/frontend#78`).
   *
   * **`observe: 'response'` y no el cuerpo a secas**, que es lo único que este método hace de
   * distinto y la razón de que exista. Lo que el backend sirve no se entiende sólo con los bytes:
   * `X-Payslip-Document-Definitive` dice cuál de los dos regímenes ha contestado y
   * `Content-Disposition` dice con qué nombre se guarda. Pedir sólo el cuerpo obligaría a la
   * pantalla a deducir las dos cosas, que es justo lo que el issue prohíbe.
   */
  getDocument(key: PayrollBusinessKey): Observable<HttpResponse<Blob>> {
    return this.api.getPayslipDocument(
      {
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
        payrollPeriodCode: key.payrollPeriodCode,
        payrollTypeCode: key.payrollTypeCode,
        presenceNumber: key.presenceNumber,
      },
      'response',
    );
  }

  invalidate(key: PayrollBusinessKey): Observable<PayrollResponse> {
    return this.api.invalidatePayroll({
      ruleSystemCode: key.ruleSystemCode,
      employeeTypeCode: key.employeeTypeCode,
      employeeNumber: key.employeeNumber,
      payrollPeriodCode: key.payrollPeriodCode,
      payrollTypeCode: key.payrollTypeCode,
      presenceNumber: key.presenceNumber,
      // Sin motivo (b4rrhh/backend#150): el recibo guarda MANUAL_INVALIDATION y lo pone el servidor.
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
