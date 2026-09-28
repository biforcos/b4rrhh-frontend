import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import {
  EmployeePayrollInputGateway,
  PayrollInputCreateDraft,
  PayrollInputItem,
} from './employee-payroll-input.gateway';
import { HttpFailure, toHttpFailure } from '../../../shared/utils/http-failure.util';

export type PayrollInputErrorCode = 'request-failed' | 'duplicate' | 'not-found';

@Injectable({ providedIn: 'root' })
export class EmployeePayrollInputStore {
  private readonly gateway = inject(EmployeePayrollInputGateway);
  private readonly selectedKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly selectedPeriodState = signal<number | null>(null);
  private readonly inputsState = signal<ReadonlyArray<PayrollInputItem>>([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<PayrollInputErrorCode | null>(null);
  private readonly failureState = signal<HttpFailure | null>(null);
  private readonly successState = signal<'created' | 'updated' | 'deleted' | null>(null);
  private requestId = 0;

  readonly inputs = this.inputsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Lo que se sabe del último fallo, para contarlo y no sólo clasificarlo (`b4rrhh/frontend#92`). */
  readonly failure = this.failureState.asReadonly();
  readonly success = this.successState.asReadonly();

  clearFeedback(): void {
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);
  }

  loadInputs(key: EmployeeBusinessKey | null, period: number | null): void {
    this.loadInputsInternal(key, period, false);
  }

  createInput(key: EmployeeBusinessKey, draft: PayrollInputCreateDraft): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(key);
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);

    this.gateway
      .createInput(normalizedKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('created');
          this.loadInputsInternal(normalizedKey, this.selectedPeriodState(), true);
        },
        error: (err: HttpErrorResponse) => {
          this.failureState.set(toHttpFailure(err));
          this.mutatingState.set(false);
          this.errorState.set(err.status === 409 ? 'duplicate' : 'request-failed');
        },
      });
  }

  updateInput(
    key: EmployeeBusinessKey,
    conceptCode: string,
    period: number,
    quantity: number,
  ): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(key);
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);

    this.gateway
      .updateInput(normalizedKey, conceptCode, period, quantity)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('updated');
          this.loadInputsInternal(normalizedKey, this.selectedPeriodState(), true);
        },
        error: (err: HttpErrorResponse) => {
          this.failureState.set(toHttpFailure(err));
          this.mutatingState.set(false);
          this.errorState.set(err.status === 404 ? 'not-found' : 'request-failed');
        },
      });
  }

  deleteInput(key: EmployeeBusinessKey, conceptCode: string, period: number): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(key);
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);

    this.gateway
      .deleteInput(normalizedKey, conceptCode, period)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('deleted');
          this.loadInputsInternal(normalizedKey, this.selectedPeriodState(), true);
        },
        error: (err: HttpErrorResponse) => {
          this.failureState.set(toHttpFailure(err));
          this.mutatingState.set(false);
          this.errorState.set(err.status === 404 ? 'not-found' : 'request-failed');
        },
      });
  }

  private loadInputsInternal(
    key: EmployeeBusinessKey | null,
    period: number | null,
    forceReload: boolean,
  ): void {
    if (!key || !period) {
      this.resetState();
      return;
    }

    const normalizedKey = toEmployeeBusinessKey(key);
    const isSameKey = areEmployeeBusinessKeysEqual(this.selectedKeyState(), normalizedKey);
    const isSamePeriod = this.selectedPeriodState() === period;

    if (
      !forceReload &&
      isSameKey &&
      isSamePeriod &&
      (this.loadingState() || this.errorState() === null)
    ) {
      return;
    }

    const hasContextChanged = !isSameKey || !isSamePeriod;

    this.selectedKeyState.set(normalizedKey);
    this.selectedPeriodState.set(period);
    if (hasContextChanged) {
      this.inputsState.set([]);
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    if (hasContextChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.gateway
      .listInputs(normalizedKey, period)
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          if (requestId !== this.requestId) return;
          this.inputsState.set(items);
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
    this.selectedKeyState.set(null);
    this.selectedPeriodState.set(null);
    this.inputsState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);
  }
}
