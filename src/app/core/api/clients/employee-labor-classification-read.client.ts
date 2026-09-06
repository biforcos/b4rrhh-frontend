import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { EmployeeLaborClassificationService } from '../generated/api/employee-labor-classification.service';
import {
  CloseLaborClassificationRequest,
  CreateLaborClassificationRequest,
  LaborClassificationPlanResponse,
  LaborClassificationResponse,
  PlanLaborClassificationChangeRequest,
  ReplaceLaborClassificationFromDateRequest,
  UpdateLaborClassificationRequest,
} from '../generated/model/models';
import { EmployeeBusinessKeyApiQuery } from './employee-read.client';

export interface EmployeeLaborClassificationApiModel {
  agreementCode: string;
  agreementName: string | null;
  agreementCategoryCode: string;
  agreementCategoryName: string | null;
  grupoCotizacionCode: string | null;
  startDate: string;
  endDate: string | null;
}

interface LaborClassificationResponseWithNames extends LaborClassificationResponse {
  agreementName?: string | null;
  agreementCategoryName?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeLaborClassificationReadClient {
  private readonly api = inject(EmployeeLaborClassificationService);

  readEmployeeLaborClassificationsByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
  ): Observable<ReadonlyArray<EmployeeLaborClassificationApiModel>> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.listEmployeeLaborClassificationsByBusinessKey(normalizedKey).pipe(
      map((classifications) =>
        classifications.map((classification) =>
          this.toEmployeeLaborClassificationApiModel(classification),
        ),
      ),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of([]);
        }

        return throwError(() => error);
      }),
    );
  }

  createLaborClassificationByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: CreateLaborClassificationRequest,
  ): Observable<EmployeeLaborClassificationApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .createLaborClassificationByBusinessKey({
        ...normalizedKey,
        createLaborClassificationRequest: {
          agreementCode: request.agreementCode.trim().toUpperCase(),
          agreementCategoryCode: request.agreementCategoryCode.trim().toUpperCase(),
          startDate: request.startDate.trim(),
          endDate: this.normalizeOptionalValue(request.endDate),
        },
      })
      .pipe(map((classification) => this.toEmployeeLaborClassificationApiModel(classification)));
  }

  updateLaborClassificationByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    startDate: string,
    request: UpdateLaborClassificationRequest,
  ): Observable<EmployeeLaborClassificationApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .updateLaborClassificationByBusinessKey({
        ...normalizedKey,
        startDate: startDate.trim(),
        updateLaborClassificationRequest: {
          // Las fechas corregidas viajan: la corrección de una clasificación son sus códigos y su
          // tramo (ADR-057). Dejarlas fuera hacía que cambiar el inicio no cambiara nada.
          startDate: this.normalizeOptionalValue(request.startDate),
          endDate: this.normalizeOptionalValue(request.endDate),
          agreementCode: request.agreementCode.trim().toUpperCase(),
          agreementCategoryCode: request.agreementCategoryCode.trim().toUpperCase(),
        },
      })
      .pipe(map((classification) => this.toEmployeeLaborClassificationApiModel(classification)));
  }

  /** Pide al backend qué haría un cambio a la serie sin aplicarlo (ADR-057). */
  planLaborClassificationChangeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: PlanLaborClassificationChangeRequest,
  ): Observable<LaborClassificationPlanResponse> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.planLaborClassificationChangeByBusinessKey({
      ...normalizedKey,
      planLaborClassificationChangeRequest: request,
    });
  }

  closeLaborClassificationByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    startDate: string,
    request: CloseLaborClassificationRequest,
  ): Observable<EmployeeLaborClassificationApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .closeLaborClassificationByBusinessKey({
        ...normalizedKey,
        startDate: startDate.trim(),
        closeLaborClassificationRequest: {
          endDate: request.endDate.trim(),
        },
      })
      .pipe(map((classification) => this.toEmployeeLaborClassificationApiModel(classification)));
  }

  replaceLaborClassificationFromDateByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: ReplaceLaborClassificationFromDateRequest,
  ): Observable<EmployeeLaborClassificationApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .replaceLaborClassificationFromDateByBusinessKey({
        ...normalizedKey,
        replaceLaborClassificationFromDateRequest: {
          effectiveDate: request.effectiveDate.trim(),
          agreementCode: request.agreementCode.trim().toUpperCase(),
          agreementCategoryCode: request.agreementCategoryCode.trim().toUpperCase(),
        },
      })
      .pipe(map((classification) => this.toEmployeeLaborClassificationApiModel(classification)));
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

  private toEmployeeLaborClassificationApiModel(
    source: LaborClassificationResponse,
  ): EmployeeLaborClassificationApiModel {
    const sourceWithNames = source as LaborClassificationResponseWithNames;

    return {
      agreementCode: source.agreementCode,
      agreementName: this.normalizeOptionalValue(sourceWithNames.agreementName),
      agreementCategoryCode: source.agreementCategoryCode,
      agreementCategoryName: this.normalizeOptionalValue(sourceWithNames.agreementCategoryName),
      grupoCotizacionCode: this.normalizeOptionalValue(source.grupoCotizacionCode),
      startDate: source.startDate,
      endDate: source.endDate ?? null,
    };
  }
}
