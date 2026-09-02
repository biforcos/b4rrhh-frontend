import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeReadClient } from '../../../core/api/clients/employee-read.client';
import {
  EmployeeDetailReadModel,
  mapEmployeeReadApiToDetailModel,
} from '../../../core/api/mappers/employee-detail.mapper';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeDetailModel } from '../models/employee-detail.model';

@Injectable({
  providedIn: 'root',
})
export class EmployeeDetailReadGateway {
  private readonly employeeReadClient = inject(EmployeeReadClient);

  readEmployeeDetailByBusinessKey(
    key: EmployeeBusinessKey,
  ): Observable<EmployeeDetailModel | null> {
    return this.employeeReadClient.readEmployeeByBusinessKey(key).pipe(
      map((employee) => {
        if (!employee) {
          return null;
        }

        return this.toEmployeeDetailModel(mapEmployeeReadApiToDetailModel(employee));
      }),
    );
  }

  private toEmployeeDetailModel(source: EmployeeDetailReadModel): EmployeeDetailModel {
    return {
      id: source.id,
      ruleSystemCode: source.ruleSystemCode,
      employeeTypeCode: source.employeeTypeCode,
      employeeNumber: source.employeeNumber,
      firstName: source.firstName,
      lastName1: source.lastName1,
      lastName2: source.lastName2,
      preferredName: source.preferredName,
      displayName: source.displayName,
      statusLabel: source.statusLabel,
      workCenter: source.workCenter,
      photoUrl: source.photoUrl,
    };
  }
}
