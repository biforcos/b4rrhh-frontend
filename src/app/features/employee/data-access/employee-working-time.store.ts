import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeWorkingTimeModel } from '../models/employee-working-time.model';
import {
  EmployeeWorkingTimeConflictModel,
  EmployeeWorkingTimePlanModel,
} from '../models/employee-working-time-plan.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import {
  EmployeeWorkingTimeErrorCode,
  mapEmployeeWorkingTimeConflict,
  mapEmployeeWorkingTimeErrorCode,
} from './employee-working-time-error.mapper';
import {
  WorkingTimeCreateDraft,
  WorkingTimePlanDraft,
  WorkingTimeUpdateDraft,
} from './employee-working-time.mapper';
import { EmployeeWorkingTimeGateway } from './employee-working-time.gateway';

@Injectable({
  providedIn: 'root',
})
export class EmployeeWorkingTimeStore {
  private readonly employeeWorkingTimeGateway = inject(EmployeeWorkingTimeGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly workingTimesState = signal<ReadonlyArray<EmployeeWorkingTimeModel>>([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<EmployeeWorkingTimeErrorCode | null>(null);
  private readonly errorConflictState = signal<EmployeeWorkingTimeConflictModel | null>(null);
  private readonly successState = signal<'created' | 'updated' | 'deleted' | null>(null);
  private readonly planState = signal<EmployeeWorkingTimePlanModel | null>(null);
  private readonly planningState = signal(false);
  private requestId = 0;
  private planRequestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly workingTimes = this.workingTimesState.asReadonly();
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
  planChange(employeeKey: EmployeeBusinessKey, draft: WorkingTimePlanDraft): void {
    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    const planRequestId = ++this.planRequestId;

    this.planState.set(null);
    this.planningState.set(true);

    this.employeeWorkingTimeGateway
      .planEmployeeWorkingTimeChange(normalizedEmployeeKey, draft)
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

  loadWorkingTimesByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadWorkingTimesByBusinessKeyInternal(key, false);
  }

  createWorkingTime(employeeKey: EmployeeBusinessKey, draft: WorkingTimeCreateDraft): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeWorkingTimeGateway
      .createEmployeeWorkingTime(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('created');
          this.loadWorkingTimesByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  updateWorkingTime(
    employeeKey: EmployeeBusinessKey,
    workingTimeNumber: number,
    draft: WorkingTimeUpdateDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeWorkingTimeGateway
      .updateEmployeeWorkingTime(normalizedEmployeeKey, workingTimeNumber, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('updated');
          this.loadWorkingTimesByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  deleteWorkingTime(employeeKey: EmployeeBusinessKey, workingTimeNumber: number): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeWorkingTimeGateway
      .deleteEmployeeWorkingTime(normalizedEmployeeKey, workingTimeNumber)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('deleted');
          this.loadWorkingTimesByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  private failWith(error: unknown): void {
    this.errorState.set(mapEmployeeWorkingTimeErrorCode(error));
    this.errorConflictState.set(mapEmployeeWorkingTimeConflict(error));
  }

  private loadWorkingTimesByBusinessKeyInternal(
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
      this.workingTimesState.set([]);
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    if (hasKeyChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.employeeWorkingTimeGateway
      .getEmployeeWorkingTimes(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (workingTimes) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.workingTimesState.set(workingTimes);
          this.loadingState.set(false);
        },
        error: (error) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loadingState.set(false);
          this.errorState.set(mapEmployeeWorkingTimeErrorCode(error));
        },
      });
  }

  private resetState(): void {
    this.requestId += 1;
    this.clearPlan();
    this.selectedEmployeeKeyState.set(null);
    this.workingTimesState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);
  }
}
