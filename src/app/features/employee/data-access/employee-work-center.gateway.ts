import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeWorkCenterReadClient } from '../../../core/api/clients/employee-work-center-read.client';
import {
  EmployeeWorkCenterReadModel,
  mapEmployeeWorkCenterApiToReadModel,
} from '../../../core/api/mappers/employee-work-center.mapper';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeWorkCenterModel } from '../models/employee-work-center.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';
import {
  WorkCenterCorrectDraft,
  WorkCenterCreateDraft,
  mapWorkCenterCloseDateToRequest,
  mapWorkCenterCorrectDraftToRequest,
  mapWorkCenterCreateDraftToRequest,
} from './employee-work-center.mapper';

@Injectable({
  providedIn: 'root',
})
export class EmployeeWorkCenterGateway {
  private readonly workCenterClient = inject(EmployeeWorkCenterReadClient);

  readWorkCenters(
    employeeKey: EmployeeBusinessKey,
  ): Observable<ReadonlyArray<EmployeeWorkCenterModel>> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workCenterClient.readEmployeeWorkCentersByBusinessKey(normalizedKey).pipe(
      map((workCenters) =>
        workCenters
          .map((workCenter) => mapEmployeeWorkCenterApiToReadModel(workCenter))
          .filter((workCenter): workCenter is EmployeeWorkCenterReadModel => workCenter !== null)
          .map((workCenter) => this.toEmployeeWorkCenterModel(workCenter)),
      ),
    );
  }

  getWorkCenter(
    employeeKey: EmployeeBusinessKey,
    workCenterAssignmentNumber: number,
  ): Observable<EmployeeWorkCenterModel> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workCenterClient
      .readEmployeeWorkCenterByBusinessKey(normalizedKey, workCenterAssignmentNumber)
      .pipe(
        map((workCenter) => mapEmployeeWorkCenterApiToReadModel(workCenter)),
        map((workCenter) => {
          if (!workCenter) {
            throw new Error('invalid-work-center-response');
          }

          return this.toEmployeeWorkCenterModel(workCenter);
        }),
      );
  }

  createWorkCenter(
    employeeKey: EmployeeBusinessKey,
    draft: WorkCenterCreateDraft,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workCenterClient
      .createWorkCenterByBusinessKey(normalizedKey, mapWorkCenterCreateDraftToRequest(draft))
      .pipe(map(() => undefined));
  }

  closeWorkCenter(
    employeeKey: EmployeeBusinessKey,
    workCenterAssignmentNumber: number,
    endDate: string,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workCenterClient
      .closeWorkCenterByBusinessKey(
        normalizedKey,
        workCenterAssignmentNumber,
        mapWorkCenterCloseDateToRequest(endDate),
      )
      .pipe(map(() => undefined));
  }

  correctWorkCenter(
    employeeKey: EmployeeBusinessKey,
    workCenterAssignmentNumber: number,
    draft: WorkCenterCorrectDraft,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workCenterClient
      .updateWorkCenterByBusinessKey(
        normalizedKey,
        workCenterAssignmentNumber,
        mapWorkCenterCorrectDraftToRequest(draft),
      )
      .pipe(map(() => undefined));
  }

  deleteWorkCenter(
    employeeKey: EmployeeBusinessKey,
    workCenterAssignmentNumber: number,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.workCenterClient
      .deleteWorkCenterByBusinessKey(normalizedKey, workCenterAssignmentNumber)
      .pipe(map(() => undefined));
  }

  private toEmployeeWorkCenterModel(source: EmployeeWorkCenterReadModel): EmployeeWorkCenterModel {
    return {
      workCenterAssignmentNumber: source.workCenterAssignmentNumber,
      workCenterCode: source.workCenterCode,
      workCenterName: source.workCenterName,
      startDate: source.startDate,
      endDate: source.endDate,
      isActive: source.isActive,
      canDelete: source.canDelete,
      startsAtPresenceStart: source.startsAtPresenceStart,
      deleteForbiddenReason: source.deleteForbiddenReason,
    };
  }
}
