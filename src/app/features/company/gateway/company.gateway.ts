import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { CompanyClient } from '../client/company.client';
import { CompanyDetailModel } from '../models/company-detail.model';
import { CompanyListItemModel } from '../models/company-list-item.model';
import {
  mapCompanyFormValueToCreateRequest,
  mapCompanyFormValueToUpdateRequest,
} from '../mapper/company-form.mapper';
import {
  mapCompanyListItemResponseToModel,
  mapCompanyResponseToDetailModel,
} from '../mapper/company.mapper';
import { CompanyFormValue } from '../models/company-form-value.model';
import { CompanyBusinessKey } from '../models/company-ui-state.model';

@Injectable({
  providedIn: 'root',
})
export class CompanyGateway {
  private readonly client = inject(CompanyClient);

  listCompanies(): Observable<ReadonlyArray<CompanyListItemModel>> {
    return this.client
      .listCompanies()
      .pipe(map((items) => items.map((item) => mapCompanyListItemResponseToModel(item))));
  }

  getCompany(key: CompanyBusinessKey): Observable<CompanyDetailModel> {
    return this.client
      .getCompany(key)
      .pipe(map((response) => mapCompanyResponseToDetailModel(response)));
  }

  createCompany(formValue: CompanyFormValue): Observable<CompanyDetailModel> {
    const request = mapCompanyFormValueToCreateRequest(formValue);
    return this.client
      .createCompany(request)
      .pipe(map((response) => mapCompanyResponseToDetailModel(response)));
  }

  updateCompany(
    key: CompanyBusinessKey,
    formValue: CompanyFormValue,
  ): Observable<CompanyDetailModel> {
    const request = mapCompanyFormValueToUpdateRequest(formValue);
    return this.client
      .updateCompany(key, request)
      .pipe(map((response) => mapCompanyResponseToDetailModel(response)));
  }
}
