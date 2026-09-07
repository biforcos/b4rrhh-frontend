import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { EmployeeContractService } from '../generated/api/employee-contract.service';
import {
  ContractPlanResponse,
  ContractResponse,
  CreateContractRequest,
  PlanContractChangeRequest,
  UpdateContractRequest,
} from '../generated/model/models';
import { EmployeeBusinessKeyApiQuery } from './employee-read.client';

export interface EmployeeContractApiModel {
  contractCode: string;
  contractTypeName?: string | null;
  contractSubtypeCode: string;
  contractSubtypeName?: string | null;
  startDate: string;
  endDate: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeContractReadClient {
  private readonly api = inject(EmployeeContractService);

  readEmployeeContractsByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
  ): Observable<ReadonlyArray<EmployeeContractApiModel>> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.listEmployeeContractsByBusinessKey(normalizedKey).pipe(
      map((contracts) => contracts.map((contract) => this.toEmployeeContractApiModel(contract))),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of([]);
        }

        return throwError(() => error);
      }),
    );
  }

  createContractByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: CreateContractRequest,
  ): Observable<EmployeeContractApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .createContractByBusinessKey({
        ...normalizedKey,
        createContractRequest: {
          contractCode: request.contractCode.trim().toUpperCase(),
          contractSubtypeCode: request.contractSubtypeCode.trim().toUpperCase(),
          startDate: request.startDate.trim(),
          endDate: this.normalizeOptionalValue(request.endDate),
        },
      })
      .pipe(map((contract) => this.toEmployeeContractApiModel(contract)));
  }

  updateContractByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    startDate: string,
    request: UpdateContractRequest,
  ): Observable<EmployeeContractApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .updateContractByBusinessKey({
        ...normalizedKey,
        startDate: startDate.trim(),
        updateContractRequest: {
          // Las fechas corregidas viajan: la corrección de un contrato son sus códigos y su
          // tramo (ADR-057). Dejarlas fuera hacía que cambiar el inicio no cambiara nada, y
          // desde el backend#69 el inicio es obligatorio: omitirlo es un 400.
          startDate: request.startDate.trim(),
          endDate: this.normalizeOptionalValue(request.endDate),
          contractCode: request.contractCode.trim().toUpperCase(),
          contractSubtypeCode: request.contractSubtypeCode.trim().toUpperCase(),
        },
      })
      .pipe(map((contract) => this.toEmployeeContractApiModel(contract)));
  }

  /** Pide al backend qué haría un cambio a la serie sin aplicarlo (ADR-057). */
  planContractChangeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: PlanContractChangeRequest,
  ): Observable<ContractPlanResponse> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.planContractChangeByBusinessKey({
      ...normalizedKey,
      planContractChangeRequest: request,
    });
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

  private toEmployeeContractApiModel(source: ContractResponse): EmployeeContractApiModel {
    return {
      contractCode: source.contractCode,
      contractTypeName: source.contractTypeName ?? null,
      contractSubtypeCode: source.contractSubtypeCode,
      contractSubtypeName: source.contractSubtypeName ?? null,
      startDate: source.startDate,
      endDate: source.endDate ?? null,
    };
  }
}
