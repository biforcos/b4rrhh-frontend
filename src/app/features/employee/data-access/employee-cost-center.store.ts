import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeCostCenterPlanModel } from '../models/employee-cost-center-plan.model';
import { EmployeeCostCenterWindowModel } from '../models/employee-cost-center.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { readTimelineConflict } from '../shared/utils/timeline-conflict.util';
import { TimelineConflict } from '../shared/utils/timeline-plan-message.util';
import { EmployeeCostCenterGateway } from './employee-cost-center.gateway';
import {
  CostCenterDistributionCorrectDraft,
  CostCenterDistributionCreateDraft,
  CostCenterPlanDraft,
} from './employee-cost-center.mapper';
import {
  EmployeeCostCenterErrorCode,
  mapEmployeeCostCenterErrorCode,
} from './employee-cost-center-error.mapper';

@Injectable({
  providedIn: 'root',
})
export class EmployeeCostCenterStore {
  private readonly gateway = inject(EmployeeCostCenterGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);

  private readonly currentDistributionState = signal<EmployeeCostCenterWindowModel | null>(null);
  private readonly historyState = signal<ReadonlyArray<EmployeeCostCenterWindowModel>>([]);

  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<EmployeeCostCenterErrorCode | null>(null);
  private readonly errorConflictState = signal<TimelineConflict | null>(null);
  private readonly successState = signal<'created' | 'corrected' | 'deleted' | null>(null);
  private readonly planState = signal<EmployeeCostCenterPlanModel | null>(null);
  private readonly planningState = signal(false);
  private requestId = 0;
  private planRequestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly currentDistribution = this.currentDistributionState.asReadonly();
  readonly history = this.historyState.asReadonly();
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

  loadCostCenters(key: EmployeeBusinessKey | null): void {
    this.loadCostCentersInternal(key, false);
  }

  /**
   * Pide al backend qué haría el cambio sin aplicarlo (ADR-057). Cada petición invalida la
   * anterior: mientras llega la respuesta no hay plan, para que nadie confirme contra uno viejo.
   */
  planChange(employeeKey: EmployeeBusinessKey, draft: CostCenterPlanDraft): void {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);
    const planRequestId = ++this.planRequestId;

    this.planState.set(null);
    this.planningState.set(true);

    this.gateway
      .planDistributionChange(normalizedKey, draft)
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
          this.handleMutationError(error);
        },
      });
  }

  clearPlan(): void {
    this.planRequestId += 1;
    this.planState.set(null);
    this.planningState.set(false);
  }

  createDistribution(
    employeeKey: EmployeeBusinessKey,
    draft: CostCenterDistributionCreateDraft,
  ): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.gateway
      .createDistribution(normalizedKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => this.handleMutationSuccess('created', normalizedKey),
        error: (err) => this.handleMutationError(err),
      });
  }

  correctDistribution(
    employeeKey: EmployeeBusinessKey,
    windowStartDate: string,
    draft: CostCenterDistributionCorrectDraft,
  ): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.gateway
      .correctDistribution(normalizedKey, windowStartDate, draft)
      .pipe(take(1))
      .subscribe({
        next: () => this.handleMutationSuccess('corrected', normalizedKey),
        error: (err) => this.handleMutationError(err),
      });
  }

  deleteDistribution(employeeKey: EmployeeBusinessKey, windowStartDate: string): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.gateway
      .deleteDistribution(normalizedKey, windowStartDate)
      .pipe(take(1))
      .subscribe({
        next: () => this.handleMutationSuccess('deleted', normalizedKey),
        error: (err) => this.handleMutationError(err),
      });
  }

  private startMutation(): void {
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);
  }

  private handleMutationSuccess(
    type: 'created' | 'corrected' | 'deleted',
    key: EmployeeBusinessKey,
  ): void {
    this.mutatingState.set(false);
    this.successState.set(type);
    this.loadCostCentersInternal(key, true);
  }

  private handleMutationError(error: unknown): void {
    this.mutatingState.set(false);
    this.errorState.set(mapEmployeeCostCenterErrorCode(error));
    this.errorConflictState.set(readTimelineConflict(error));
  }

  private loadCostCentersInternal(key: EmployeeBusinessKey | null, forceReload: boolean): void {
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
      this.currentDistributionState.set(null);
      this.historyState.set([]);
    }

    this.loadingState.set(true);
    this.errorState.set(null);
    if (hasKeyChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.gateway
      .readDistributionHistory(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (historyModel) => {
          if (requestId !== this.requestId) return;
          this.currentDistributionState.set(historyModel.currentDistribution ?? null);
          this.historyState.set(historyModel.distributionHistory);
          this.loadingState.set(false);
        },
        error: () => {
          if (requestId !== this.requestId) return;
          this.loadingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  private resetState(): void {
    this.requestId++;
    this.clearPlan();
    this.selectedEmployeeKeyState.set(null);
    this.currentDistributionState.set(null);
    this.historyState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);
  }
}
