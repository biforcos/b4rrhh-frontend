import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CompanyService } from '../../../core/api/generated/api/company.service';
import { CompanyListItemResponse } from '../../../core/api/generated/model/company-list-item-response';
import { CompanyResponse } from '../../../core/api/generated/model/company-response';
import { CreateCompanyRequest } from '../../../core/api/generated/model/create-company-request';
import { UpdateCompanyRequest } from '../../../core/api/generated/model/update-company-request';
import { CompanyBusinessKey } from '../models/company-ui-state.model';

@Injectable({
  providedIn: 'root',
})
export class CompanyClient {
  private readonly api = inject(CompanyService);

  listCompanies(): Observable<Array<CompanyListItemResponse>> {
    return this.api.listCompanies();
  }

  createCompany(request: CreateCompanyRequest): Observable<CompanyResponse> {
    return this.api.createCompany({ createCompanyRequest: request });
  }

  getCompany(key: CompanyBusinessKey): Observable<CompanyResponse> {
    return this.api.getCompany({
      ruleSystemCode: key.ruleSystemCode,
      companyCode: key.companyCode,
    });
  }

  updateCompany(
    key: CompanyBusinessKey,
    request: UpdateCompanyRequest,
  ): Observable<CompanyResponse> {
    return this.api.updateCompany({
      ruleSystemCode: key.ruleSystemCode,
      companyCode: key.companyCode,
      updateCompanyRequest: request,
    });
  }
}
