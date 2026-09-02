import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeReadClient } from '../../../core/api/clients/employee-read.client';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeCoreIdentityDraft } from '../models/employee-core-identity-draft.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';
import { mapEmployeeCoreIdentityDraftToUpdateRequest } from './employee-detail-edit.mapper';

@Injectable({
  providedIn: 'root',
})
export class EmployeeDetailGateway {
  private readonly employeeReadClient = inject(EmployeeReadClient);

  updateEmployeeCoreIdentity(
    employeeKey: EmployeeBusinessKey,
    draft: EmployeeCoreIdentityDraft,
  ): Observable<void> {
    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    return this.employeeReadClient
      .updateEmployeeByBusinessKey(
        normalizedEmployeeKey,
        mapEmployeeCoreIdentityDraftToUpdateRequest(draft),
      )
      .pipe(map(() => undefined));
  }
}
