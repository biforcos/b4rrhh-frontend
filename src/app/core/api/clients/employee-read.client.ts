import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { EmployeeDirectoryService } from '../generated/api/employee-directory.service';
import {
  EmployeeDirectoryItemResponse,
  EmployeeDirectoryPageResponse,
  EmployeeResponse,
  UpdateEmployeeRequest,
} from '../generated/model/models';

export interface EmployeeBusinessKeyApiQuery {
  ruleSystemCode: string;
  employeeTypeCode: string;
  employeeNumber: string;
}

export interface EmployeeReadApiModel {
  id: number;
  ruleSystemCode: string;
  employeeTypeCode: string;
  employeeNumber: string;
  firstName: string;
  lastName1: string;
  lastName2: string | null;
  preferredName: string | null;
  displayName: string;
  status: string;
  photoUrl: string | null;
}

export interface EmployeeDirectoryApiModel {
  ruleSystemCode: string;
  employeeTypeCode: string;
  employeeNumber: string;
  displayName: string;
  status: string;
  workCenterCode: string | null;
}

/** Lo que se le pide al directorio: el filtro y la página. Filtra y pagina el servidor (frontend#27). */
export interface EmployeeDirectoryApiQuery {
  q: string | null;
  status: string | null;
  page: number;
  size: number;
}

/** Una página del directorio con el total que cumple el mismo filtro (backend#18). */
export interface EmployeeDirectoryPageApiModel {
  items: ReadonlyArray<EmployeeDirectoryApiModel>;
  page: number;
  size: number;
  total: number;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeReadClient {
  private readonly api = inject(EmployeeDirectoryService);

  readDirectory(query: EmployeeDirectoryApiQuery): Observable<EmployeeDirectoryPageApiModel> {
    return this.api
      .listEmployees({
        q: this.normalizeOptionalValue(query.q) ?? undefined,
        status: this.normalizeOptionalValue(query.status) ?? undefined,
        page: query.page,
        size: query.size,
      })
      .pipe(map((response) => this.toEmployeeDirectoryPageApiModel(response)));
  }

  readEmployeeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
  ): Observable<EmployeeReadApiModel | null> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.getEmployeeByBusinessKey(normalizedKey).pipe(
      map((employee) => this.toEmployeeReadApiModel(employee)),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(null);
        }

        return throwError(() => error);
      }),
    );
  }

  updateEmployeeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: UpdateEmployeeRequest,
  ): Observable<EmployeeReadApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .updateEmployeeByBusinessKey({
        ...normalizedKey,
        updateEmployeeRequest: {
          firstName: request.firstName.trim(),
          lastName1: request.lastName1.trim(),
          lastName2: this.normalizeOptionalValue(request.lastName2),
          preferredName: this.normalizeOptionalValue(request.preferredName),
        },
      })
      .pipe(map((employee) => this.toEmployeeReadApiModel(employee)));
  }

  private normalizeKey(key: EmployeeBusinessKeyApiQuery): EmployeeBusinessKeyApiQuery {
    return {
      ruleSystemCode: key.ruleSystemCode.trim(),
      employeeTypeCode: key.employeeTypeCode.trim(),
      employeeNumber: key.employeeNumber.trim(),
    };
  }

  private normalizeOptionalValue(value: string | null | undefined): string | null {
    const normalizedValue = value?.trim() ?? '';
    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toEmployeeDirectoryPageApiModel(
    source: EmployeeDirectoryPageResponse,
  ): EmployeeDirectoryPageApiModel {
    return {
      items: source.items.map((item) => this.toEmployeeDirectoryApiModel(item)),
      page: source.page,
      size: source.size,
      total: source.total,
    };
  }

  private toEmployeeDirectoryApiModel(
    source: EmployeeDirectoryItemResponse,
  ): EmployeeDirectoryApiModel {
    return {
      ruleSystemCode: source.ruleSystemCode,
      employeeTypeCode: source.employeeTypeCode,
      employeeNumber: source.employeeNumber,
      displayName: source.displayName,
      status: source.status,
      workCenterCode: source.workCenterCode ?? null,
    };
  }

  private toEmployeeReadApiModel(source: EmployeeResponse): EmployeeReadApiModel {
    return {
      id: source.id,
      ruleSystemCode: source.ruleSystemCode,
      employeeTypeCode: source.employeeTypeCode,
      employeeNumber: source.employeeNumber,
      firstName: source.firstName,
      lastName1: source.lastName1,
      lastName2: source.lastName2 ?? null,
      preferredName: source.preferredName ?? null,
      displayName: source.displayName,
      status: source.status,
      photoUrl: source.photoUrl ?? null,
    };
  }
}
