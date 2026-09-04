import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { EmployeeWorkingTimeService } from '../generated/api/employee-working-time.service';
import {
  CreateWorkingTimeRequest,
  PlanWorkingTimeChangeRequest,
  UpdateWorkingTimeRequest,
  WorkingTimePlanResponse,
  WorkingTimeResponse,
} from '../generated/model/models';
import { EmployeeBusinessKeyApiQuery } from './employee-read.client';

export interface EmployeeWorkingTimeApiModel {
  workingTimeNumber: number;
  startDate: string;
  endDate: string | null;
  workingTimePercentage: number;
  weeklyHours: number;
  dailyHours: number;
  monthlyHours: number;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeWorkingTimeReadClient {
  private readonly api = inject(EmployeeWorkingTimeService);

  readEmployeeWorkingTimesByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
  ): Observable<ReadonlyArray<EmployeeWorkingTimeApiModel>> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.listEmployeeWorkingTimesByBusinessKey(normalizedKey).pipe(
      map((items: Array<WorkingTimeResponse>) =>
        items.map((item: WorkingTimeResponse) => this.toEmployeeWorkingTimeApiModel(item)),
      ),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of([]);
        }

        return throwError(() => error);
      }),
    );
  }

  createWorkingTimeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: CreateWorkingTimeRequest,
  ): Observable<EmployeeWorkingTimeApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .createWorkingTimeByBusinessKey({
        ...normalizedKey,
        createWorkingTimeRequest: {
          startDate: request.startDate.trim(),
          endDate: request.endDate?.trim() || null,
          workingTimePercentage: request.workingTimePercentage,
        },
      })
      .pipe(map((item: WorkingTimeResponse) => this.toEmployeeWorkingTimeApiModel(item)));
  }

  deleteWorkingTimeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    workingTimeNumber: number,
  ): Observable<void> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .deleteWorkingTimeByBusinessKey({ ...normalizedKey, workingTimeNumber })
      .pipe(map(() => undefined));
  }

  /** Pide al backend qué haría un cambio a la serie sin aplicarlo (ADR-057). */
  planWorkingTimeChangeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: PlanWorkingTimeChangeRequest,
  ): Observable<WorkingTimePlanResponse> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.planWorkingTimeChangeByBusinessKey({
      ...normalizedKey,
      planWorkingTimeChangeRequest: request,
    });
  }

  updateWorkingTimeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    workingTimeNumber: number,
    request: UpdateWorkingTimeRequest,
  ): Observable<EmployeeWorkingTimeApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .updateWorkingTimeByBusinessKey({
        ...normalizedKey,
        workingTimeNumber,
        updateWorkingTimeRequest: request,
      })
      .pipe(map((item: WorkingTimeResponse) => this.toEmployeeWorkingTimeApiModel(item)));
  }

  private normalizeKey(key: EmployeeBusinessKeyApiQuery): EmployeeBusinessKeyApiQuery {
    return {
      ruleSystemCode: key.ruleSystemCode.trim(),
      employeeTypeCode: key.employeeTypeCode.trim(),
      employeeNumber: key.employeeNumber.trim(),
    };
  }

  private toEmployeeWorkingTimeApiModel(source: WorkingTimeResponse): EmployeeWorkingTimeApiModel {
    return {
      workingTimeNumber: source.workingTimeNumber,
      startDate: source.startDate,
      endDate: source.endDate ?? null,
      workingTimePercentage: source.workingTimePercentage,
      weeklyHours: source.weeklyHours,
      dailyHours: source.dailyHours,
      monthlyHours: source.monthlyHours,
    };
  }
}
