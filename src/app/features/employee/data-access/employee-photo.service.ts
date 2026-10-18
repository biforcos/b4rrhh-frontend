import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DefaultService } from '../../../core/api/generated/api/default.service';
import { EmployeeReadApiModel } from '../../../core/api/clients/employee-read.client';
import { EmployeeResponse } from '../../../core/api/generated/model/employee-response';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';

@Injectable({ providedIn: 'root' })
export class EmployeePhotoService {
  private readonly api = inject(DefaultService);

  /**
   * One request to the API, which stores the JPEG and answers with the employee and its new photoUrl
   * (backend#177). It used to be three: a presigned URL, a direct PUT to the store and a
   * confirmation, and the presigned URL named a store host that no browser outside the backend's
   * machine could reach.
   */
  uploadPhoto(key: EmployeeBusinessKey, blob: Blob): Observable<EmployeeReadApiModel> {
    return this.api
      .uploadEmployeePhoto({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
        body: blob,
      })
      .pipe(map((r) => this.toApiModel(r)));
  }

  deletePhoto(key: EmployeeBusinessKey): Observable<void> {
    return this.api
      .deleteEmployeePhoto({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
      })
      .pipe(map(() => undefined));
  }

  private toApiModel(source: EmployeeResponse): EmployeeReadApiModel {
    return {
      ruleSystemCode: source.ruleSystemCode!,
      employeeTypeCode: source.employeeTypeCode!,
      employeeNumber: source.employeeNumber!,
      firstName: source.firstName!,
      lastName1: source.lastName1!,
      lastName2: source.lastName2 ?? null,
      preferredName: source.preferredName ?? null,
      displayName: source.displayName!,
      status: source.status!,
      statusSince: source.statusSince ?? null,
      plannedTerminationDate: source.plannedTerminationDate ?? null,
      plannedHireDate: source.plannedHireDate ?? null,
      photoUrl: source.photoUrl ?? null,
    };
  }
}
