import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeWorkingTimeReadClient } from '../../../core/api/clients/employee-working-time-read.client';
import {
  EmployeeWorkingTimeReadModel,
  mapEmployeeWorkingTimeApiToReadModel,
} from '../../../core/api/mappers/employee-working-time.mapper';
import { sortByTimelineRecency } from '../../../shared/utils/period-order.util';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeWorkingTimeModel } from '../models/employee-working-time.model';
import { EmployeeWorkingTimePlanModel } from '../models/employee-working-time-plan.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';
import {
  WorkingTimeCreateDraft,
  WorkingTimePlanDraft,
  WorkingTimeUpdateDraft,
  mapWorkingTimeCreateDraftToRequest,
  mapWorkingTimePlanDraftToRequest,
  mapWorkingTimePlanResponseToModel,
  mapWorkingTimeUpdateDraftToRequest,
} from './employee-working-time.mapper';

@Injectable({
  providedIn: 'root',
})
export class EmployeeWorkingTimeGateway {
  private readonly workingTimeClient = inject(EmployeeWorkingTimeReadClient);

  getEmployeeWorkingTimes(
    employeeKey: EmployeeBusinessKey,
  ): Observable<ReadonlyArray<EmployeeWorkingTimeModel>> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workingTimeClient.readEmployeeWorkingTimesByBusinessKey(normalizedKey).pipe(
      map((items) =>
        items
          .map((item) => mapEmployeeWorkingTimeApiToReadModel(item))
          .filter((item): item is EmployeeWorkingTimeReadModel => item !== null)
          .map((item) => this.toEmployeeWorkingTimeModel(item)),
      ),
      map((items) => this.sortByTimelineRecency(items)),
    );
  }

  createEmployeeWorkingTime(
    employeeKey: EmployeeBusinessKey,
    draft: WorkingTimeCreateDraft,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workingTimeClient
      .createWorkingTimeByBusinessKey(normalizedKey, mapWorkingTimeCreateDraftToRequest(draft))
      .pipe(map(() => undefined));
  }

  updateEmployeeWorkingTime(
    employeeKey: EmployeeBusinessKey,
    workingTimeNumber: number,
    draft: WorkingTimeUpdateDraft,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workingTimeClient
      .updateWorkingTimeByBusinessKey(
        normalizedKey,
        workingTimeNumber,
        mapWorkingTimeUpdateDraftToRequest(draft),
      )
      .pipe(map(() => undefined));
  }

  deleteEmployeeWorkingTime(
    employeeKey: EmployeeBusinessKey,
    workingTimeNumber: number,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workingTimeClient.deleteWorkingTimeByBusinessKey(normalizedKey, workingTimeNumber);
  }

  planEmployeeWorkingTimeChange(
    employeeKey: EmployeeBusinessKey,
    draft: WorkingTimePlanDraft,
  ): Observable<EmployeeWorkingTimePlanModel> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workingTimeClient
      .planWorkingTimeChangeByBusinessKey(normalizedKey, mapWorkingTimePlanDraftToRequest(draft))
      .pipe(map((plan) => mapWorkingTimePlanResponseToModel(plan)));
  }

  private sortByTimelineRecency(
    items: ReadonlyArray<EmployeeWorkingTimeModel>,
  ): ReadonlyArray<EmployeeWorkingTimeModel> {
    return sortByTimelineRecency(
      items,
      (left, right) => right.workingTimeNumber - left.workingTimeNumber,
    );
  }

  private toEmployeeWorkingTimeModel(
    source: EmployeeWorkingTimeReadModel,
  ): EmployeeWorkingTimeModel {
    return {
      workingTimeNumber: source.workingTimeNumber,
      startDate: source.startDate,
      endDate: source.endDate,
      workingTimePercentage: source.workingTimePercentage,
      weeklyHours: source.weeklyHours,
      dailyHours: source.dailyHours,
      monthlyHours: source.monthlyHours,
      isActive: source.isActive,
    };
  }
}
