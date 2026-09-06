import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';

import { EmployeeCostCenterService } from '../../../core/api/generated/api/employee-cost-center.service';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeCostCenterPlanModel } from '../models/employee-cost-center-plan.model';
import {
  EmployeeCostCenterHistoryModel,
  EmployeeCostCenterWindowModel,
} from '../models/employee-cost-center.model';
import {
  CostCenterDistributionCorrectDraft,
  CostCenterDistributionCreateDraft,
  CostCenterPlanDraft,
  mapCostCenterDistributionCorrectDraftToRequest,
  mapCostCenterDistributionCreateDraftToRequests,
  mapCostCenterPlanDraftToRequest,
  mapCostCenterPlanResponseToModel,
  mapCostCenterResponsesToHistoryModel,
  mapCostCenterResponsesToWindowModel,
} from './employee-cost-center.mapper';

@Injectable({
  providedIn: 'root',
})
export class EmployeeCostCenterGateway {
  private readonly personnelApiService = inject(EmployeeCostCenterService);

  readCurrentDistribution(
    key: EmployeeBusinessKey,
  ): Observable<EmployeeCostCenterWindowModel | null> {
    return this.personnelApiService
      .getCurrentCostCenterDistribution({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
      })
      .pipe(
        map((response) =>
          response.currentDistribution
            ? mapCostCenterResponsesToWindowModel(response.currentDistribution)
            : null,
        ),
      );
  }

  readDistributionHistory(key: EmployeeBusinessKey): Observable<EmployeeCostCenterHistoryModel> {
    return this.personnelApiService
      .listCostCenterDistributionHistory({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
      })
      .pipe(map((response) => mapCostCenterResponsesToHistoryModel(response.windows)));
  }

  createDistribution(
    key: EmployeeBusinessKey,
    draft: CostCenterDistributionCreateDraft,
  ): Observable<EmployeeCostCenterWindowModel> {
    if (!draft.items.length) {
      return throwError(() => new Error('Cost center distribution requires at least one item.'));
    }

    return this.personnelApiService
      .createCostCenterDistribution({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
        createCostCenterDistributionRequest: mapCostCenterDistributionCreateDraftToRequests(draft),
      })
      .pipe(map((response) => mapCostCenterResponsesToWindowModel(response)));
  }

  /** Pide al backend qué haría un cambio a la serie sin aplicarlo (ADR-057). */
  planDistributionChange(
    key: EmployeeBusinessKey,
    draft: CostCenterPlanDraft,
  ): Observable<EmployeeCostCenterPlanModel> {
    return this.personnelApiService
      .planCostCenterDistributionChange({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
        planCostCenterDistributionChangeRequest: mapCostCenterPlanDraftToRequest(draft),
      })
      .pipe(map((plan) => mapCostCenterPlanResponseToModel(plan)));
  }

  correctDistribution(
    key: EmployeeBusinessKey,
    windowStartDate: string,
    draft: CostCenterDistributionCorrectDraft,
  ): Observable<EmployeeCostCenterWindowModel> {
    if (!draft.items.length) {
      return throwError(() => new Error('Cost center distribution requires at least one item.'));
    }

    return this.personnelApiService
      .updateCostCenterDistribution({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
        startDate: windowStartDate,
        updateCostCenterDistributionRequest: mapCostCenterDistributionCorrectDraftToRequest(draft),
      })
      .pipe(map((response) => mapCostCenterResponsesToWindowModel(response)));
  }

  deleteDistribution(key: EmployeeBusinessKey, windowStartDate: string): Observable<void> {
    return this.personnelApiService
      .deleteCostCenterDistribution({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
        startDate: windowStartDate,
      })
      .pipe(map(() => undefined));
  }
}
