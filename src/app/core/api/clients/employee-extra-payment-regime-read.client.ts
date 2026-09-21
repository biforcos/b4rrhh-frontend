import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { EmployeeExtraPaymentRegimeService } from '../generated/api/employee-extra-payment-regime.service';
import {
  CreateExtraPaymentRegimeRequest,
  PlanExtraPaymentRegimeChangeRequest,
  UpdateExtraPaymentRegimeRequest,
  ExtraPaymentRegimePlanResponse,
  ExtraPaymentRegimeResponse,
} from '../generated/model/models';
import { EmployeeBusinessKeyApiQuery } from './employee-read.client';

export interface EmployeeExtraPaymentRegimeApiModel {
  extraPaymentRegimeNumber: number;
  startDate: string;
  endDate: string | null;
  prorated: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeExtraPaymentRegimeReadClient {
  private readonly api = inject(EmployeeExtraPaymentRegimeService);

  readEmployeeExtraPaymentRegimesByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
  ): Observable<ReadonlyArray<EmployeeExtraPaymentRegimeApiModel>> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.listEmployeeExtraPaymentRegimesByBusinessKey(normalizedKey).pipe(
      map((items: Array<ExtraPaymentRegimeResponse>) =>
        items.map((item: ExtraPaymentRegimeResponse) =>
          this.toEmployeeExtraPaymentRegimeApiModel(item),
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

  createExtraPaymentRegimeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: CreateExtraPaymentRegimeRequest,
  ): Observable<EmployeeExtraPaymentRegimeApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .createExtraPaymentRegimeByBusinessKey({
        ...normalizedKey,
        createExtraPaymentRegimeRequest: {
          startDate: request.startDate.trim(),
          endDate: request.endDate?.trim() || null,
          prorated: request.prorated,
        },
      })
      .pipe(
        map((item: ExtraPaymentRegimeResponse) => this.toEmployeeExtraPaymentRegimeApiModel(item)),
      );
  }

  deleteExtraPaymentRegimeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    extraPaymentRegimeNumber: number,
  ): Observable<void> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .deleteExtraPaymentRegimeByBusinessKey({ ...normalizedKey, extraPaymentRegimeNumber })
      .pipe(map(() => undefined));
  }

  /** Pide al backend qué haría un cambio a la serie sin aplicarlo (ADR-057). */
  planExtraPaymentRegimeChangeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: PlanExtraPaymentRegimeChangeRequest,
  ): Observable<ExtraPaymentRegimePlanResponse> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.planExtraPaymentRegimeChangeByBusinessKey({
      ...normalizedKey,
      planExtraPaymentRegimeChangeRequest: request,
    });
  }

  updateExtraPaymentRegimeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    extraPaymentRegimeNumber: number,
    request: UpdateExtraPaymentRegimeRequest,
  ): Observable<EmployeeExtraPaymentRegimeApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .updateExtraPaymentRegimeByBusinessKey({
        ...normalizedKey,
        extraPaymentRegimeNumber,
        updateExtraPaymentRegimeRequest: request,
      })
      .pipe(
        map((item: ExtraPaymentRegimeResponse) => this.toEmployeeExtraPaymentRegimeApiModel(item)),
      );
  }

  private normalizeKey(key: EmployeeBusinessKeyApiQuery): EmployeeBusinessKeyApiQuery {
    return {
      ruleSystemCode: key.ruleSystemCode.trim(),
      employeeTypeCode: key.employeeTypeCode.trim(),
      employeeNumber: key.employeeNumber.trim(),
    };
  }

  private toEmployeeExtraPaymentRegimeApiModel(
    source: ExtraPaymentRegimeResponse,
  ): EmployeeExtraPaymentRegimeApiModel {
    return {
      extraPaymentRegimeNumber: source.extraPaymentRegimeNumber,
      startDate: source.startDate,
      endDate: source.endDate ?? null,
      prorated: source.prorated,
    };
  }
}
