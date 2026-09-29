import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { PayrollCalculationRunService } from '../../../../core/api/generated/api/payroll-calculation-run.service';
import { PayrollService } from '../../../../core/api/generated/api/payroll.service';
import { RuleEntitiesService } from '../../../../core/api/generated/api/rule-entities.service';
import {
  BulkFinalizePayrollRequest,
  BulkFinalizePayrollRequestPayrollTypeCodeEnum,
} from '../../../../core/api/generated/model/bulk-finalize-payroll-request';
import {
  BulkInvalidatePayrollRequest,
  BulkInvalidatePayrollRequestPayrollTypeCodeEnum,
} from '../../../../core/api/generated/model/bulk-invalidate-payroll-request';
import {
  LaunchPayrollCalculationRequest,
  LaunchPayrollCalculationRequestPayrollTypeCodeEnum,
} from '../../../../core/api/generated/model/launch-payroll-calculation-request';
import { BulkFinalizeResult } from '../models/bulk-finalize-result.model';
import { BulkInvalidateResult } from '../models/bulk-invalidate-result.model';
import { CalculationRunMessage } from '../models/calculation-run-message.model';
import { CalculationRun } from '../models/calculation-run.model';
import { TargetSelectionPayload } from '../models/target-selection.model';

type PayrollTypeCode = 'NORMAL' | 'EXTRA';

@Injectable({ providedIn: 'root' })
export class OperacionesGateway {
  private readonly payrollApi = inject(PayrollService);
  private readonly calculationRunApi = inject(PayrollCalculationRunService);
  private readonly ruleEntitiesApi = inject(RuleEntitiesService);

  /**
   * Los tipos de empleado del sistema de reglas, para elegir en vez de escribir
   * (`b4rrhh/frontend#88`). Los activos, por código.
   */
  listEmployeeTypes(ruleSystemCode: string): Observable<string[]> {
    return this.ruleEntitiesApi
      .listRuleEntities({ ruleSystemCode, ruleEntityTypeCode: 'EMPLOYEE_TYPE', active: true })
      .pipe(
        map((tipos) =>
          [...new Set(tipos.map((t) => t.code).filter((c): c is string => !!c))].sort(),
        ),
      );
  }

  /**
   * Los dos parametros de la retro van en la **peticion** (`b4rrhh/backend#132`).
   *
   * `retroFloorPeriodCode` viaja como `null` y no se omite cuando no hay suelo: el contrato lo
   * declara anulable, y mandar null dice «sin suelo» donde omitirlo diria «no te he contado nada de
   * esto». Con un solo campo da igual; con dos que se validan el uno contra el otro, no.
   */
  launchCalculation(params: {
    ruleSystemCode: string;
    payrollPeriodCode: string;
    payrollTypeCode: PayrollTypeCode;
    calculationEngineCode: string;
    calculationEngineVersion: string;
    targetSelection: TargetSelectionPayload;
    retroLimitPeriodCode: string;
    retroFloorPeriodCode: string | null;
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

  /**
   * El tercer verbo del periodo (`b4rrhh/backend#102`). No lleva `statusReasonCode` y la ausencia es
   * del contrato: cerrar no da un motivo, conserva el que el recibo tuviera. Invalidar tampoco lo
   * pide desde el `b4rrhh/backend#150`: el servidor guarda qué camino invalidó, no un texto libre.
   */
  bulkFinalize(params: {
    ruleSystemCode: string;
    payrollPeriodCode: string;
    payrollTypeCode: PayrollTypeCode;
    targetSelection: TargetSelectionPayload;
  }): Observable<BulkFinalizeResult> {
    const request = {
      ...params,
      payrollTypeCode: params.payrollTypeCode as BulkFinalizePayrollRequestPayrollTypeCodeEnum,
    } as BulkFinalizePayrollRequest;
    return this.payrollApi.bulkFinalizePayroll({ bulkFinalizePayrollRequest: request }).pipe(
      map((r) => ({
        totalCandidates: r.totalCandidates ?? 0,
        totalFound: r.totalFound ?? 0,
        totalFinalized: r.totalFinalized ?? 0,
        totalSkippedAlreadyDefinitive: r.totalSkippedAlreadyDefinitive ?? 0,
        totalSkippedNotEligibleByStatus: r.totalSkippedNotEligibleByStatus ?? 0,
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
    totalSkippedMissingInput: r.totalSkippedMissingInput ?? 0,
    totalCalculated: r.totalCalculated ?? 0,
    totalNotValid: r.totalNotValid ?? 0,
    totalErrors: r.totalErrors ?? 0,
    retroLimitPeriodCode: r.retroLimitPeriodCode ?? null,
    retroFloorPeriodCode: r.retroFloorPeriodCode ?? null,
    totalRetroUnits: r.totalRetroUnits ?? 0,
    totalRetroRecalculated: r.totalRetroRecalculated ?? 0,
    totalRetroNotRecalculated: r.totalRetroNotRecalculated ?? 0,
    requestedAt: r.requestedAt,
    startedAt: r.startedAt ?? null,
    finishedAt: r.finishedAt ?? null,
  });

  private mapMessage = (m: any): CalculationRunMessage => ({
    messageCode: m.messageCode,
    messageCodeName: m.messageCodeName ?? null,
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
