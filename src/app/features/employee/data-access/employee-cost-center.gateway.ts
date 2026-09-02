import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';

import { EmployeeCostCenterService } from '../../../core/api/generated/api/employee-cost-center.service';
import { CostCenterDistributionWindowResponse } from '../../../core/api/generated/model/models';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import {
  EmployeeCostCenterHistoryModel,
  EmployeeCostCenterWindowModel,
} from '../models/employee-cost-center.model';
import {
  CostCenterDistributionCreateDraft,
  CostCenterDistributionReplaceDraft,
  mapCostCenterDistributionCloseDateToRequest,
  mapCostCenterDistributionCreateDraftToRequests,
  mapCostCenterDistributionReplaceDraftToRequests,
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

  replaceDistribution(
    key: EmployeeBusinessKey,
    draft: CostCenterDistributionReplaceDraft,
  ): Observable<EmployeeCostCenterWindowModel> {
    if (!draft.items.length) {
      return throwError(() => new Error('Cost center distribution requires at least one item.'));
    }

    return this.personnelApiService
      .replaceCostCenterDistributionFromDate({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
        replaceCostCenterDistributionFromDateRequest:
          mapCostCenterDistributionReplaceDraftToRequests(draft),
      })
      .pipe(map((response) => mapCostCenterResponsesToWindowModel(response)));
  }

  closeDistribution(
    key: EmployeeBusinessKey,
    startDate: string,
    endDate: string,
  ): Observable<EmployeeCostCenterWindowModel> {
    return this.personnelApiService
      .closeCostCenterDistribution({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
        startDate,
        closeCostCenterDistributionRequest: mapCostCenterDistributionCloseDateToRequest(endDate),
      })
      .pipe(
        map((response: CostCenterDistributionWindowResponse) =>
          mapCostCenterResponsesToWindowModel(response),
        ),
      );
  }
}
