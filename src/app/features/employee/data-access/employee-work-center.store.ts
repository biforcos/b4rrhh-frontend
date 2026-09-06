import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeWorkCenterModel } from '../models/employee-work-center.model';
import { EmployeeWorkCenterPlanModel } from '../models/employee-work-center-plan.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { readTimelineConflict } from '../shared/utils/timeline-conflict.util';
import { TimelineConflict } from '../shared/utils/timeline-plan-message.util';
import {
  EmployeeWorkCenterErrorCode,
  mapEmployeeWorkCenterErrorCode,
} from './employee-work-center-error.mapper';
import {
  WorkCenterCorrectDraft,
  WorkCenterCreateDraft,
  WorkCenterPlanDraft,
} from './employee-work-center.mapper';
import { EmployeeWorkCenterGateway } from './employee-work-center.gateway';

@Injectable({
  providedIn: 'root',
})
export class EmployeeWorkCenterStore {
  private readonly employeeWorkCenterGateway = inject(EmployeeWorkCenterGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly workCentersState = signal<ReadonlyArray<EmployeeWorkCenterModel>>([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<EmployeeWorkCenterErrorCode | null>(null);
  private readonly errorConflictState = signal<TimelineConflict | null>(null);
  private readonly successState = signal<'created' | 'corrected' | 'deleted' | null>(null);
  private readonly planState = signal<EmployeeWorkCenterPlanModel | null>(null);
  private readonly planningState = signal(false);
  private requestId = 0;
  private planRequestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly workCenters = this.workCentersState.asReadonly();
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

  loadWorkCenters(key: EmployeeBusinessKey | null): void {
    this.loadWorkCentersByBusinessKeyInternal(key, false);
  }

  refreshWorkCenters(key: EmployeeBusinessKey | null): void {
    this.loadWorkCentersByBusinessKeyInternal(key, true);
  }

  /**
   * Pide al backend qué haría el cambio sin aplicarlo (ADR-057). Cada petición invalida la
   * anterior: mientras llega la respuesta no hay plan, para que nadie confirme contra uno viejo.
   */
  planChange(employeeKey: EmployeeBusinessKey, draft: WorkCenterPlanDraft): void {
    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    const planRequestId = ++this.planRequestId;

    this.planState.set(null);
    this.planningState.set(true);

    this.employeeWorkCenterGateway
      .planWorkCenterChange(normalizedEmployeeKey, draft)
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

  createWorkCenter(employeeKey: EmployeeBusinessKey, draft: WorkCenterCreateDraft): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.employeeWorkCenterGateway
      .createWorkCenter(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => this.finishMutation('created', normalizedEmployeeKey),
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  correctWorkCenter(
    employeeKey: EmployeeBusinessKey,
    workCenterAssignmentNumber: number,
    draft: WorkCenterCorrectDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.employeeWorkCenterGateway
      .correctWorkCenter(normalizedEmployeeKey, workCenterAssignmentNumber, draft)
      .pipe(take(1))
      .subscribe({
        next: () => this.finishMutation('corrected', normalizedEmployeeKey),
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  deleteWorkCenter(employeeKey: EmployeeBusinessKey, workCenterAssignmentNumber: number): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.employeeWorkCenterGateway
      .deleteWorkCenter(normalizedEmployeeKey, workCenterAssignmentNumber)
      .pipe(take(1))
      .subscribe({
        next: () => this.finishMutation('deleted', normalizedEmployeeKey),
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  private startMutation(): void {
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);
  }

  private finishMutation(
    success: 'created' | 'corrected' | 'deleted',
    key: EmployeeBusinessKey,
  ): void {
    this.mutatingState.set(false);
    this.successState.set(success);
    this.loadWorkCentersByBusinessKeyInternal(key, true);
  }

  private failWith(error: unknown): void {
    this.errorState.set(mapEmployeeWorkCenterErrorCode(error));
    this.errorConflictState.set(readTimelineConflict(error));
  }

  private loadWorkCentersByBusinessKeyInternal(
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
      this.workCentersState.set([]);
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    if (hasKeyChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.employeeWorkCenterGateway
      .readWorkCenters(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (workCenters) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.workCentersState.set(workCenters);
          this.loadingState.set(false);
        },
        error: (error) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loadingState.set(false);
          this.errorState.set(mapEmployeeWorkCenterErrorCode(error));
        },
      });
  }

  private resetState(): void {
    this.requestId += 1;
    this.clearPlan();
    this.selectedEmployeeKeyState.set(null);
    this.workCentersState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);
  }
}
