import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { WorkCenterService } from '../../../core/api/generated/api/work-center.service';
import { CreateWorkCenterRequest } from '../../../core/api/generated/model/create-work-center-request';
import { UpdateWorkCenterRequest } from '../../../core/api/generated/model/update-work-center-request';
import { WorkCenterListItemResponse } from '../../../core/api/generated/model/work-center-list-item-response';
import { WorkCenterResponse } from '../../../core/api/generated/model/work-center-response';
import { WorkCenterBusinessKey } from '../models/work-center-ui-state.model';

@Injectable({
  providedIn: 'root',
})
export class WorkCenterClient {
  private readonly api = inject(WorkCenterService);

  listWorkCenters(): Observable<Array<WorkCenterListItemResponse>> {
    return this.api.listWorkCenters();
  }

  createWorkCenter(request: CreateWorkCenterRequest): Observable<WorkCenterResponse> {
    return this.api.createWorkCenter({ createWorkCenterRequest: request });
  }

  getWorkCenter(key: WorkCenterBusinessKey): Observable<WorkCenterResponse> {
    return this.api.getWorkCenter({
      ruleSystemCode: key.ruleSystemCode,
      workCenterCode: key.workCenterCode,
    });
  }

  updateWorkCenter(
    key: WorkCenterBusinessKey,
    request: UpdateWorkCenterRequest,
  ): Observable<WorkCenterResponse> {
    return this.api.updateWorkCenter({
      ruleSystemCode: key.ruleSystemCode,
      workCenterCode: key.workCenterCode,
      updateWorkCenterRequest: request,
    });
  }
}
