import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import {
  CorrectEmployeeTaxInformationRequest,
  CreateEmployeeTaxInformationRequest,
} from '../../../core/api/clients/employee-tax-information.client';
import { EmployeeTaxInformationModel } from '../models/employee-tax-information.model';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { EmployeeTaxInformationGateway } from './employee-tax-information.gateway';
import { HttpFailure, toHttpFailure } from '../../../shared/utils/http-failure.util';

export type TaxInformationErrorCode = 'request-failed' | 'conflict' | 'not-found';

@Injectable({ providedIn: 'root' })
export class EmployeeTaxInformationStore {
  private readonly gateway = inject(EmployeeTaxInformationGateway);

  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  private readonly recordsState = signal<ReadonlyArray<EmployeeTaxInformationModel>>([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<TaxInformationErrorCode | null>(null);
  private readonly failureState = signal<HttpFailure | null>(null);
  private readonly successState = signal<'created' | 'corrected' | 'deleted' | null>(null);
  private requestId = 0;

  readonly records = this.recordsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Lo que se sabe del último fallo, para contarlo y no sólo clasificarlo (`b4rrhh/frontend#92`). */
  readonly failure = this.failureState.asReadonly();
  readonly success = this.successState.asReadonly();
  readonly latest = computed(() => this.recordsState()[0] ?? null);

  clearFeedback(): void {
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);
  }

  load(key: EmployeeBusinessKey | null): void {
    this.loadInternal(key, false);
  }

  create(key: EmployeeBusinessKey, req: CreateEmployeeTaxInformationRequest): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(key);
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);

    this.gateway
      .create(normalizedKey, req)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('created');
          this.loadInternal(normalizedKey, true);
        },
        error: (err: HttpErrorResponse) => {
          this.failureState.set(toHttpFailure(err));
          this.mutatingState.set(false);
          this.errorState.set(err.status === 409 ? 'conflict' : 'request-failed');
        },
      });
  }

  correct(
    key: EmployeeBusinessKey,
    validFrom: string,
    req: CorrectEmployeeTaxInformationRequest,
  ): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(key);
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);

    this.gateway
      .correct(normalizedKey, validFrom, req)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('corrected');
          this.loadInternal(normalizedKey, true);
        },
        error: (err: HttpErrorResponse) => {
          this.failureState.set(toHttpFailure(err));
          this.mutatingState.set(false);
          this.errorState.set(err.status === 404 ? 'not-found' : 'request-failed');
        },
      });
  }

  delete(key: EmployeeBusinessKey, validFrom: string): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(key);
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);

    this.gateway
      .delete(normalizedKey, validFrom)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('deleted');
          this.loadInternal(normalizedKey, true);
        },
        error: (err: HttpErrorResponse) => {
          this.failureState.set(toHttpFailure(err));
          this.mutatingState.set(false);
          this.errorState.set(err.status === 404 ? 'not-found' : 'request-failed');
        },
      });
  }

  private loadInternal(key: EmployeeBusinessKey | null, forceReload: boolean): void {
    if (!key) {
      this.resetState();
      return;
    }

    const normalizedKey = toEmployeeBusinessKey(key);
    const isSameKey = areEmployeeBusinessKeysEqual(this.selectedEmployeeKeyState(), normalizedKey);

    if (!forceReload && isSameKey && (this.loadingState() || this.errorState() === null)) {
      return;
    }

    const hasKeyChanged = !isSameKey;
    this.selectedEmployeeKeyState.set(normalizedKey);
    if (hasKeyChanged) {
      this.recordsState.set([]);
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    if (hasKeyChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.gateway
      .list(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (records) => {
          if (requestId !== this.requestId) return;
          this.recordsState.set(records);
          this.loadingState.set(false);
        },
        error: (err: unknown) => {
          this.failureState.set(toHttpFailure(err));
          if (requestId !== this.requestId) return;
          this.loadingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  private resetState(): void {
    this.requestId += 1;
    this.selectedEmployeeKeyState.set(null);
    this.recordsState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);
  }
}
