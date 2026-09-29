import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { EmployeeLifecycleService } from '../../../core/api/generated/api/employee-lifecycle.service';
import {
  HireEmployeeDraft,
  HireEmployeeResult,
  HireIdentifierOwner,
} from '../models/employee-hiring.model';
import { mapDraftToHireRequest, mapResponseToResult } from './employee-hiring.mapper';

@Injectable({
  providedIn: 'root',
})
export class EmployeeHiringGateway {
  private readonly api = inject(EmployeeLifecycleService);

  hire(draft: HireEmployeeDraft): Observable<HireEmployeeResult> {
    return this.api
      .hireEmployee({
        hireEmployeeRequest: mapDraftToHireRequest(draft),
      })
      .pipe(map((response) => mapResponseToResult(response)));
  }

  /**
   * Quién tiene ya este documento en el sistema de reglas (`b4rrhh/backend#149`), o `null` si está
   * libre (el servidor responde 204 sin cuerpo). Es el mismo dueño que nombraría el 409 del alta.
   */
  findIdentifierOwner(
    ruleSystemCode: string,
    identifierTypeCode: string,
    identifierValue: string,
  ): Observable<HireIdentifierOwner | null> {
    return this.api
      .findIdentifierOwner({ ruleSystemCode, identifierTypeCode, identifierValue })
      .pipe(
        map((owner) =>
          owner
            ? {
                employeeKey: {
                  ruleSystemCode,
                  employeeTypeCode: owner.employeeTypeCode,
                  employeeNumber: owner.employeeNumber,
                },
                active: owner.active,
                ceasedOn: owner.ceasedOn ?? null,
                message: owner.message,
              }
            : null,
        ),
      );
  }
}
