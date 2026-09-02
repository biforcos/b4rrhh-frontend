import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { WorkCenterContactService } from '../../../core/api/generated/api/work-center-contact.service';
import { CreateWorkCenterContactRequest } from '../../../core/api/generated/model/create-work-center-contact-request';
import { UpdateWorkCenterContactRequest } from '../../../core/api/generated/model/update-work-center-contact-request';
import { WorkCenterContactResponse } from '../../../core/api/generated/model/work-center-contact-response';
import { WorkCenterBusinessKey } from '../models/work-center-ui-state.model';

@Injectable({
  providedIn: 'root',
})
export class WorkCenterContactClient {
  private readonly api = inject(WorkCenterContactService);

  listContacts(key: WorkCenterBusinessKey): Observable<Array<WorkCenterContactResponse>> {
    return this.api.listWorkCenterContacts({
      ruleSystemCode: key.ruleSystemCode,
      workCenterCode: key.workCenterCode,
    });
  }

  createContact(
    key: WorkCenterBusinessKey,
    request: CreateWorkCenterContactRequest,
  ): Observable<WorkCenterContactResponse> {
    return this.api.createWorkCenterContact({
      ruleSystemCode: key.ruleSystemCode,
      workCenterCode: key.workCenterCode,
      createWorkCenterContactRequest: request,
    });
  }

  updateContact(
    key: WorkCenterBusinessKey,
    contactNumber: number,
    request: UpdateWorkCenterContactRequest,
  ): Observable<WorkCenterContactResponse> {
    return this.api.updateWorkCenterContact({
      ruleSystemCode: key.ruleSystemCode,
      workCenterCode: key.workCenterCode,
      contactNumber,
      updateWorkCenterContactRequest: request,
    });
  }

  deleteContact(key: WorkCenterBusinessKey, contactNumber: number): Observable<void> {
    return this.api.deleteWorkCenterContact({
      ruleSystemCode: key.ruleSystemCode,
      workCenterCode: key.workCenterCode,
      contactNumber,
    });
  }
}
