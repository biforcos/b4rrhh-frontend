import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeExtraPaymentRegimeReadClient } from '../../../core/api/clients/employee-extra-payment-regime-read.client';
import {
  EmployeeExtraPaymentRegimeReadModel,
  mapEmployeeExtraPaymentRegimeApiToReadModel,
} from '../../../core/api/mappers/employee-extra-payment-regime.mapper';
import { sortByTimelineRecency } from '../../../shared/utils/period-order.util';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeExtraPaymentRegimeModel } from '../models/employee-extra-payment-regime.model';
import { EmployeeExtraPaymentRegimePlanModel } from '../models/employee-extra-payment-regime-plan.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';
import {
  ExtraPaymentRegimeCreateDraft,
  ExtraPaymentRegimePlanDraft,
  ExtraPaymentRegimeUpdateDraft,
  mapExtraPaymentRegimeCreateDraftToRequest,
  mapExtraPaymentRegimePlanDraftToRequest,
  mapExtraPaymentRegimePlanResponseToModel,
  mapExtraPaymentRegimeUpdateDraftToRequest,
} from './employee-extra-payment-regime.mapper';

@Injectable({
  providedIn: 'root',
})
export class EmployeeExtraPaymentRegimeGateway {
  private readonly extraPaymentRegimeClient = inject(EmployeeExtraPaymentRegimeReadClient);

  getEmployeeExtraPaymentRegimes(
    employeeKey: EmployeeBusinessKey,
  ): Observable<ReadonlyArray<EmployeeExtraPaymentRegimeModel>> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.extraPaymentRegimeClient
      .readEmployeeExtraPaymentRegimesByBusinessKey(normalizedKey)
      .pipe(
        map((items) =>
          items
            .map((item) => mapEmployeeExtraPaymentRegimeApiToReadModel(item))
            .filter((item): item is EmployeeExtraPaymentRegimeReadModel => item !== null)
            .map((item) => this.toEmployeeExtraPaymentRegimeModel(item)),
        ),
        map((items) => this.sortByTimelineRecency(items)),
      );
  }

  createEmployeeExtraPaymentRegime(
    employeeKey: EmployeeBusinessKey,
    draft: ExtraPaymentRegimeCreateDraft,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.extraPaymentRegimeClient
      .createExtraPaymentRegimeByBusinessKey(
        normalizedKey,
        mapExtraPaymentRegimeCreateDraftToRequest(draft),
      )
      .pipe(map(() => undefined));
  }

  updateEmployeeExtraPaymentRegime(
    employeeKey: EmployeeBusinessKey,
    extraPaymentRegimeNumber: number,
    draft: ExtraPaymentRegimeUpdateDraft,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.extraPaymentRegimeClient
      .updateExtraPaymentRegimeByBusinessKey(
        normalizedKey,
        extraPaymentRegimeNumber,
        mapExtraPaymentRegimeUpdateDraftToRequest(draft),
      )
      .pipe(map(() => undefined));
  }

  deleteEmployeeExtraPaymentRegime(
    employeeKey: EmployeeBusinessKey,
    extraPaymentRegimeNumber: number,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.extraPaymentRegimeClient.deleteExtraPaymentRegimeByBusinessKey(
      normalizedKey,
      extraPaymentRegimeNumber,
    );
  }

  planEmployeeExtraPaymentRegimeChange(
    employeeKey: EmployeeBusinessKey,
    draft: ExtraPaymentRegimePlanDraft,
  ): Observable<EmployeeExtraPaymentRegimePlanModel> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.extraPaymentRegimeClient
      .planExtraPaymentRegimeChangeByBusinessKey(
        normalizedKey,
        mapExtraPaymentRegimePlanDraftToRequest(draft),
      )
      .pipe(map((plan) => mapExtraPaymentRegimePlanResponseToModel(plan)));
  }

  private sortByTimelineRecency(
    items: ReadonlyArray<EmployeeExtraPaymentRegimeModel>,
  ): ReadonlyArray<EmployeeExtraPaymentRegimeModel> {
    return sortByTimelineRecency(
      items,
      (left, right) => right.extraPaymentRegimeNumber - left.extraPaymentRegimeNumber,
    );
  }

  private toEmployeeExtraPaymentRegimeModel(
    source: EmployeeExtraPaymentRegimeReadModel,
  ): EmployeeExtraPaymentRegimeModel {
    return {
      extraPaymentRegimeNumber: source.extraPaymentRegimeNumber,
      startDate: source.startDate,
      endDate: source.endDate,
      prorated: source.prorated,
      isActive: source.isActive,
    };
  }
}
