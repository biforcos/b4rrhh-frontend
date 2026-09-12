import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { PayrollCalculationRunService } from '../../../../core/api/generated/api/payroll-calculation-run.service';
import { PayrollService } from '../../../../core/api/generated/api/payroll.service';
import {
  BulkInvalidatePayrollRequest,
  BulkInvalidatePayrollRequestPayrollTypeCodeEnum,
} from '../../../../core/api/generated/model/bulk-invalidate-payroll-request';
import {
  LaunchPayrollCalculationRequest,
  LaunchPayrollCalculationRequestPayrollTypeCodeEnum,
} from '../../../../core/api/generated/model/launch-payroll-calculation-request';
import { BulkInvalidateResult } from '../models/bulk-invalidate-result.model';
import { CalculationRunMessage } from '../models/calculation-run-message.model';
import { CalculationRun } from '../models/calculation-run.model';
import { TargetSelectionPayload } from '../models/target-selection.model';

type PayrollTypeCode = 'NORMAL' | 'EXTRA';

@Injectable({ providedIn: 'root' })
export class OperacionesGateway {
  private readonly payrollApi = inject(PayrollService);
  private readonly calculationRunApi = inject(PayrollCalculationRunService);

  launchCalculation(params: {
    ruleSystemCode: string;
    payrollPeriodCode: string;
    payrollTypeCode: PayrollTypeCode;
    calculationEngineCode: string;
    calculationEngineVersion: string;
    targetSelection: TargetSelectionPayload;
  }): Observable<CalculationRun> {
    const request = {
      ...params,
      payrollTypeCode: params.payrollTypeCode as LaunchPayrollCalculationRequestPayrollTypeCodeEnum,
    } as LaunchPayrollCalculationRequest;
    return this.calculationRunApi
      .launchPayrollCalculation({ launchPayrollCalculationRequest: request })
      .pipe(map(this.mapRun));
  }

  getCalculationRun(runId: number): Observable<CalculationRun> {
    return this.calculationRunApi.getPayrollCalculationRun({ runId }).pipe(map(this.mapRun));
  }

  listCalculationRunMessages(runId: number): Observable<CalculationRunMessage[]> {
    return this.calculationRunApi
      .listPayrollCalculationRunMessages({ runId })
      .pipe(map((r) => (r.items ?? []).map(this.mapMessage)));
  }

  bulkInvalidate(params: {
    ruleSystemCode: string;
    payrollPeriodCode: string;
    payrollTypeCode: PayrollTypeCode;
    statusReasonCode: string;
    targetSelection: TargetSelectionPayload;
  }): Observable<BulkInvalidateResult> {
    const request = {
      ...params,
      payrollTypeCode: params.payrollTypeCode as BulkInvalidatePayrollRequestPayrollTypeCodeEnum,
    } as BulkInvalidatePayrollRequest;
    return this.payrollApi.bulkInvalidatePayroll({ bulkInvalidatePayrollRequest: request }).pipe(
      map((r) => ({
        totalCandidates: r.totalCandidates ?? 0,
        totalFound: r.totalFound ?? 0,
        totalInvalidated: r.totalInvalidated ?? 0,
        totalSkippedAlreadyNotValid: r.totalSkippedAlreadyNotValid ?? 0,
        totalSkippedProtected: r.totalSkippedProtected ?? 0,
        totalSkippedNotFound: r.totalSkippedNotFound ?? 0,
      })),
    );
  }

  private mapRun = (r: any): CalculationRun => ({
    runId: r.runId,
    status: r.status,
    ruleSystemCode: r.ruleSystemCode,
    payrollPeriodCode: r.payrollPeriodCode,
    payrollTypeCode: r.payrollTypeCode ?? '',
    calculationEngineCode: r.calculationEngineCode ?? '',
    calculationEngineVersion: r.calculationEngineVersion ?? '',
    totalCandidates: r.totalCandidates ?? 0,
    totalEligible: r.totalEligible ?? 0,
    totalClaimed: r.totalClaimed ?? 0,
    totalSkippedNotEligible: r.totalSkippedNotEligible ?? 0,
    totalSkippedAlreadyClaimed: r.totalSkippedAlreadyClaimed ?? 0,
    totalCalculated: r.totalCalculated ?? 0,
    totalNotValid: r.totalNotValid ?? 0,
    totalErrors: r.totalErrors ?? 0,
    requestedAt: r.requestedAt,
    startedAt: r.startedAt ?? null,
    finishedAt: r.finishedAt ?? null,
  });

  private mapMessage = (m: any): CalculationRunMessage => ({
    messageCode: m.messageCode,
    severityCode: m.severityCode,
    message: m.message,
    detailsJson: m.detailsJson ?? null,
    ruleSystemCode: m.ruleSystemCode ?? null,
    employeeTypeCode: m.employeeTypeCode ?? null,
    employeeNumber: m.employeeNumber ?? null,
    payrollPeriodCode: m.payrollPeriodCode ?? null,
    payrollTypeCode: m.payrollTypeCode ?? null,
    presenceNumber: m.presenceNumber ?? null,
    createdAt: m.createdAt,
  });
}
