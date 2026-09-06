import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { EmployeeWorkCenterService } from '../generated/api/employee-work-center.service';
import {
  EmployeeCreateWorkCenterRequest,
  EmployeeUpdateWorkCenterRequest,
  EmployeeWorkCenterAssignmentResponse,
  EmployeeWorkCenterPlanResponse,
  PlanWorkCenterChangeRequest,
} from '../generated/model/models';
import { EmployeeBusinessKeyApiQuery } from './employee-read.client';

export interface EmployeeWorkCenterApiModel {
  workCenterAssignmentNumber: number;
  workCenterCode: string;
  workCenterName: string | null;
  startDate: string;
  endDate: string | null;
  canDelete?: boolean;
  startsAtPresenceStart?: boolean;
  deleteForbiddenReason?: string | null;
}

interface WorkCenterResponseWithDeleteCapabilities extends EmployeeWorkCenterAssignmentResponse {
  canDelete?: boolean;
  startsAtPresenceStart?: boolean;
  deleteForbiddenReason?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeWorkCenterReadClient {
  private readonly api = inject(EmployeeWorkCenterService);

  readEmployeeWorkCentersByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
  ): Observable<ReadonlyArray<EmployeeWorkCenterApiModel>> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.listEmployeeWorkCentersByBusinessKey(normalizedKey).pipe(
      map((workCenters) =>
        workCenters.map((workCenter) => this.toEmployeeWorkCenterApiModel(workCenter)),
      ),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of([]);
        }

        return throwError(() => error);
      }),
    );
  }

  readEmployeeWorkCenterByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    workCenterAssignmentNumber: number,
  ): Observable<EmployeeWorkCenterApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .getWorkCenterByBusinessKey({
        ...normalizedKey,
        workCenterAssignmentNumber,
      })
      .pipe(map((workCenter) => this.toEmployeeWorkCenterApiModel(workCenter)));
  }

  createWorkCenterByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: EmployeeCreateWorkCenterRequest,
  ): Observable<EmployeeWorkCenterApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .createWorkCenterByBusinessKey({
        ...normalizedKey,
        employeeCreateWorkCenterRequest: {
          workCenterCode: request.workCenterCode.trim().toUpperCase(),
          startDate: request.startDate.trim(),
          endDate: this.normalizeOptionalValue(request.endDate),
        },
      })
      .pipe(map((workCenter) => this.toEmployeeWorkCenterApiModel(workCenter)));
  }

  /** Pide al backend qué haría un cambio a la serie sin aplicarlo (ADR-057). */
  planWorkCenterChangeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: PlanWorkCenterChangeRequest,
  ): Observable<EmployeeWorkCenterPlanResponse> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.planWorkCenterChangeByBusinessKey({
      ...normalizedKey,
      planWorkCenterChangeRequest: request,
    });
  }

  updateWorkCenterByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    workCenterAssignmentNumber: number,
    request: EmployeeUpdateWorkCenterRequest,
  ): Observable<EmployeeWorkCenterApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .updateWorkCenterByBusinessKey({
        ...normalizedKey,
        workCenterAssignmentNumber,
        employeeUpdateWorkCenterRequest: {
          workCenterCode: request.workCenterCode.trim().toUpperCase(),
          startDate: request.startDate.trim(),
          endDate: this.normalizeOptionalValue(request.endDate),
        },
      })
      .pipe(map((workCenter) => this.toEmployeeWorkCenterApiModel(workCenter)));
  }

  deleteWorkCenterByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    workCenterAssignmentNumber: number,
  ): Observable<void> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .deleteWorkCenterByBusinessKey({
        ...normalizedKey,
        workCenterAssignmentNumber,
      })
      .pipe(map(() => undefined));
  }

  private normalizeKey(key: EmployeeBusinessKeyApiQuery): EmployeeBusinessKeyApiQuery {
    return {
      ruleSystemCode: key.ruleSystemCode.trim(),
      employeeTypeCode: key.employeeTypeCode.trim(),
      employeeNumber: key.employeeNumber.trim(),
    };
  }

  private normalizeOptionalValue(value: string | null | undefined): string | null {
    const normalizedValue = value?.trim() ?? '';
    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toEmployeeWorkCenterApiModel(
    source: EmployeeWorkCenterAssignmentResponse,
  ): EmployeeWorkCenterApiModel {
    const extended = source as WorkCenterResponseWithDeleteCapabilities;

    return {
      workCenterAssignmentNumber: source.workCenterAssignmentNumber,
      workCenterCode: source.workCenterCode,
      workCenterName: this.normalizeOptionalValue(source.workCenterName),
      startDate: source.startDate,
      endDate: source.endDate ?? null,
      canDelete: extended.canDelete,
      startsAtPresenceStart: extended.startsAtPresenceStart,
      deleteForbiddenReason: extended.deleteForbiddenReason ?? null,
    };
  }
}
