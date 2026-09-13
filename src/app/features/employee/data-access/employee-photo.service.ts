import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';

import { DefaultService } from '../../../core/api/generated/api/default.service';
import { EmployeeReadApiModel } from '../../../core/api/clients/employee-read.client';
import { EmployeeResponse } from '../../../core/api/generated/model/employee-response';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';

@Injectable({ providedIn: 'root' })
export class EmployeePhotoService {
  private readonly api = inject(DefaultService);
  private readonly http = inject(HttpClient);

  uploadPhoto(key: EmployeeBusinessKey, blob: Blob): Observable<EmployeeReadApiModel> {
    return this.api
      .generatePhotoUploadUrl({
        ruleSystemCode: key.ruleSystemCode,
        employeeTypeCode: key.employeeTypeCode,
        employeeNumber: key.employeeNumber,
      })
      .pipe(
        switchMap(({ uploadUrl, objectKey }) =>
          this.http.put(uploadUrl!, blob, { headers: { 'Content-Type': 'image/jpeg' } }).pipe(
            switchMap(() =>
              this.api
                .confirmEmployeePhoto({
                  ruleSystemCode: key.ruleSystemCode,
                  employeeTypeCode: key.employeeTypeCode,
                  employeeNumber: key.employeeNumber,
                  confirmEmployeePhotoRequest: { objectKey: objectKey! },
                })
                .pipe(map((r) => this.toApiModel(r))),
            ),
          ),
        ),
      );
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
      photoUrl: source.photoUrl ?? null,
    };
  }
}
