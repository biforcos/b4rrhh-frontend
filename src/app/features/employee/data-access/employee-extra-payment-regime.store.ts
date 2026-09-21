import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeExtraPaymentRegimeModel } from '../models/employee-extra-payment-regime.model';
import {
  EmployeeExtraPaymentRegimeConflictModel,
  EmployeeExtraPaymentRegimePlanModel,
} from '../models/employee-extra-payment-regime-plan.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import {
  EmployeeExtraPaymentRegimeErrorCode,
  mapEmployeeExtraPaymentRegimeConflict,
  mapEmployeeExtraPaymentRegimeErrorCode,
} from './employee-extra-payment-regime-error.mapper';
import {
  ExtraPaymentRegimeCreateDraft,
  ExtraPaymentRegimePlanDraft,
  ExtraPaymentRegimeUpdateDraft,
} from './employee-extra-payment-regime.mapper';
import { EmployeeExtraPaymentRegimeGateway } from './employee-extra-payment-regime.gateway';

@Injectable({
  providedIn: 'root',
})
export class EmployeeExtraPaymentRegimeStore {
  private readonly employeeExtraPaymentRegimeGateway = inject(EmployeeExtraPaymentRegimeGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly extraPaymentRegimesState = signal<
    ReadonlyArray<EmployeeExtraPaymentRegimeModel>
  >([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<EmployeeExtraPaymentRegimeErrorCode | null>(null);
  private readonly errorConflictState = signal<EmployeeExtraPaymentRegimeConflictModel | null>(
    null,
  );
  private readonly successState = signal<'created' | 'updated' | 'deleted' | null>(null);
  private readonly planState = signal<EmployeeExtraPaymentRegimePlanModel | null>(null);
  private readonly planningState = signal(false);
  private requestId = 0;
  private planRequestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly extraPaymentRegimes = this.extraPaymentRegimesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Las fechas que acompañan al último error de invariante; null si el error no las trae. */
  readonly errorConflict = this.errorConflictState.asReadonly();
  readonly success = this.successState.asReadonly();
  /** El plan del cambio que la pantalla está preparando; null mientras se pide o si no hay ninguno. */
  readonly plan = this.planState.asReadonly();
  readonly planning = this.planningState.asReadonly();

  clearFeedback(): void {
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);
  }

  /**
   * Pide al backend qué haría el cambio sin aplicarlo (ADR-057). Cada petición invalida la
   * anterior: mientras llega la respuesta no hay plan, para que nadie confirme contra uno viejo.
   */
  planChange(employeeKey: EmployeeBusinessKey, draft: ExtraPaymentRegimePlanDraft): void {
    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    const planRequestId = ++this.planRequestId;

    this.planState.set(null);
    this.planningState.set(true);

    this.employeeExtraPaymentRegimeGateway
      .planEmployeeExtraPaymentRegimeChange(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: (plan) => {
          if (planRequestId !== this.planRequestId) {
            return;
          }

          this.planState.set(plan);
          this.planningState.set(false);
        },
        error: (error) => {
          if (planRequestId !== this.planRequestId) {
            return;
          }

          this.planningState.set(false);
          this.failWith(error);
        },
      });
  }

  clearPlan(): void {
    this.planRequestId += 1;
    this.planState.set(null);
    this.planningState.set(false);
  }

  loadExtraPaymentRegimesByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadExtraPaymentRegimesByBusinessKeyInternal(key, false);
  }

  createExtraPaymentRegime(
    employeeKey: EmployeeBusinessKey,
    draft: ExtraPaymentRegimeCreateDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeExtraPaymentRegimeGateway
      .createEmployeeExtraPaymentRegime(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('created');
          this.loadExtraPaymentRegimesByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  updateExtraPaymentRegime(
    employeeKey: EmployeeBusinessKey,
    extraPaymentRegimeNumber: number,
    draft: ExtraPaymentRegimeUpdateDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeExtraPaymentRegimeGateway
      .updateEmployeeExtraPaymentRegime(normalizedEmployeeKey, extraPaymentRegimeNumber, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('updated');
          this.loadExtraPaymentRegimesByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  deleteExtraPaymentRegime(
    employeeKey: EmployeeBusinessKey,
    extraPaymentRegimeNumber: number,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeExtraPaymentRegimeGateway
      .deleteEmployeeExtraPaymentRegime(normalizedEmployeeKey, extraPaymentRegimeNumber)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('deleted');
          this.loadExtraPaymentRegimesByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  private failWith(error: unknown): void {
    this.errorState.set(mapEmployeeExtraPaymentRegimeErrorCode(error));
    this.errorConflictState.set(mapEmployeeExtraPaymentRegimeConflict(error));
  }

  private loadExtraPaymentRegimesByBusinessKeyInternal(
    key: EmployeeBusinessKey | null,
    forceReload: boolean,
  ): void {
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
      this.extraPaymentRegimesState.set([]);
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    if (hasKeyChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.employeeExtraPaymentRegimeGateway
      .getEmployeeExtraPaymentRegimes(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (extraPaymentRegimes) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.extraPaymentRegimesState.set(extraPaymentRegimes);
          this.loadingState.set(false);
        },
        error: (error) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loadingState.set(false);
          this.errorState.set(mapEmployeeExtraPaymentRegimeErrorCode(error));
        },
      });
  }

  private resetState(): void {
    this.requestId += 1;
    this.clearPlan();
    this.selectedEmployeeKeyState.set(null);
    this.extraPaymentRegimesState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);
  }
}
