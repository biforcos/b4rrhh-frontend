import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { EmployeeLifecycleService } from '../../../core/api/generated/api/employee-lifecycle.service';
import {
  HireEmployeeDraft,
  HireEmployeeResult,
  HireIdentifierCheck,
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
   * Si el documento está bien escrito y quién lo tiene ya en el sistema de reglas
   * (`b4rrhh/backend#149`, `b4rrhh/backend#171`). El dueño es el mismo que nombraría el 409 del alta,
   * y el motivo, el mismo con que el alta lo rechazaría.
   */
  checkIdentifier(
    ruleSystemCode: string,
    identifierTypeCode: string,
    identifierValue: string,
    issuingCountryCode: string | null,
  ): Observable<HireIdentifierCheck> {
    return this.api
      .findIdentifierOwner({
        ruleSystemCode,
        identifierTypeCode,
        identifierValue,
        ...(issuingCountryCode ? { issuingCountryCode } : {}),
      })
      .pipe(
        map((check) => ({
          valid: check.valid,
          reason: check.reason ?? null,
          owner:
            check.employeeTypeCode && check.employeeNumber
              ? {
                  employeeKey: {
                    ruleSystemCode,
                    employeeTypeCode: check.employeeTypeCode,
                    employeeNumber: check.employeeNumber,
                  },
                  active: check.active === true,
                  ceasedOn: check.ceasedOn ?? null,
                  message: check.message ?? '',
                }
              : null,
        })),
      );
  }
}
