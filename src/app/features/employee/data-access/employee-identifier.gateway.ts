import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeIdentifierReadClient } from '../../../core/api/clients/employee-identifier-read.client';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';
import {
  IdentifierDraft,
  mapIdentifierDraftToCreateIdentifierRequest,
  mapIdentifierDraftToUpdateIdentifierRequest,
} from './employee-identifier-edit.mapper';

@Injectable({
  providedIn: 'root',
})
export class EmployeeIdentifierGateway {
  private readonly identifierClient = inject(EmployeeIdentifierReadClient);

  createIdentifier(employeeKey: EmployeeBusinessKey, draft: IdentifierDraft): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.identifierClient
      .createIdentifierByBusinessKey(
        normalizedKey,
        mapIdentifierDraftToCreateIdentifierRequest(draft),
      )
      .pipe(map(() => undefined));
  }

  updateIdentifier(
    employeeKey: EmployeeBusinessKey,
    identifierTypeCode: string,
    draft: IdentifierDraft,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.identifierClient
      .updateIdentifierByBusinessKey(
        normalizedKey,
        identifierTypeCode.trim().toUpperCase(),
        mapIdentifierDraftToUpdateIdentifierRequest(draft),
      )
      .pipe(map(() => undefined));
  }

  deleteIdentifier(employeeKey: EmployeeBusinessKey, identifierTypeCode: string): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.identifierClient
      .deleteIdentifierByBusinessKey(normalizedKey, identifierTypeCode.trim().toUpperCase())
      .pipe(map(() => undefined));
  }
}
