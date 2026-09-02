import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { WorkCenterClient } from '../client/work-center.client';
import { WorkCenterContactClient } from '../client/work-center-contact.client';
import {
  mapWorkCenterContactFormValueToCreateRequest,
  mapWorkCenterContactFormValueToUpdateRequest,
  mapWorkCenterContactResponseToModel,
} from '../mapper/work-center-contact.mapper';
import {
  mapWorkCenterFormValueToCreateRequest,
  mapWorkCenterFormValueToUpdateRequest,
} from '../mapper/work-center-form.mapper';
import {
  mapWorkCenterListItemResponseToModel,
  mapWorkCenterResponseToDetailModel,
} from '../mapper/work-center.mapper';
import { WorkCenterContactFormValue } from '../models/work-center-contact-form-value.model';
import { WorkCenterContactModel } from '../models/work-center-contact.model';
import { WorkCenterDetailModel } from '../models/work-center-detail.model';
import { WorkCenterFormValue } from '../models/work-center-form-value.model';
import { WorkCenterListItemModel } from '../models/work-center-list-item.model';
import { WorkCenterBusinessKey } from '../models/work-center-ui-state.model';

@Injectable({
  providedIn: 'root',
})
export class WorkCenterGateway {
  private readonly client = inject(WorkCenterClient);
  private readonly contactClient = inject(WorkCenterContactClient);

  listWorkCenters(): Observable<ReadonlyArray<WorkCenterListItemModel>> {
    return this.client
      .listWorkCenters()
      .pipe(map((items) => items.map((item) => mapWorkCenterListItemResponseToModel(item))));
  }

  getWorkCenter(key: WorkCenterBusinessKey): Observable<WorkCenterDetailModel> {
    return this.client
      .getWorkCenter(key)
      .pipe(map((response) => mapWorkCenterResponseToDetailModel(response)));
  }

  createWorkCenter(formValue: WorkCenterFormValue): Observable<WorkCenterDetailModel> {
    return this.client
      .createWorkCenter(mapWorkCenterFormValueToCreateRequest(formValue))
      .pipe(map((response) => mapWorkCenterResponseToDetailModel(response)));
  }

  updateWorkCenter(
    key: WorkCenterBusinessKey,
    formValue: WorkCenterFormValue,
  ): Observable<WorkCenterDetailModel> {
    return this.client
      .updateWorkCenter(key, mapWorkCenterFormValueToUpdateRequest(formValue))
      .pipe(map((response) => mapWorkCenterResponseToDetailModel(response)));
  }

  listContacts(key: WorkCenterBusinessKey): Observable<ReadonlyArray<WorkCenterContactModel>> {
    return this.contactClient
      .listContacts(key)
      .pipe(map((items) => items.map((item) => mapWorkCenterContactResponseToModel(item))));
  }

  createContact(
    key: WorkCenterBusinessKey,
    formValue: WorkCenterContactFormValue,
  ): Observable<WorkCenterContactModel> {
    return this.contactClient
      .createContact(key, mapWorkCenterContactFormValueToCreateRequest(formValue))
      .pipe(map((response) => mapWorkCenterContactResponseToModel(response)));
  }

  updateContact(
    key: WorkCenterBusinessKey,
    contactNumber: number,
    formValue: WorkCenterContactFormValue,
  ): Observable<WorkCenterContactModel> {
    return this.contactClient
      .updateContact(key, contactNumber, mapWorkCenterContactFormValueToUpdateRequest(formValue))
      .pipe(map((response) => mapWorkCenterContactResponseToModel(response)));
  }

  deleteContact(key: WorkCenterBusinessKey, contactNumber: number): Observable<void> {
    return this.contactClient.deleteContact(key, contactNumber);
  }
}
