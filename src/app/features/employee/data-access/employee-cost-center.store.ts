import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeCostCenterWindowModel } from '../models/employee-cost-center.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { EmployeeCostCenterGateway } from './employee-cost-center.gateway';
import {
  CostCenterDistributionCreateDraft,
  CostCenterDistributionReplaceDraft,
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
  private readonly successState = signal<'created' | 'replaced' | 'closed' | null>(null);
  private requestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly currentDistribution = this.currentDistributionState.asReadonly();
  readonly history = this.historyState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly success = this.successState.asReadonly();

  clearFeedback(): void {
    this.errorState.set(null);
    this.successState.set(null);
  }

  loadCostCenters(key: EmployeeBusinessKey | null): void {
    this.loadCostCentersInternal(key, false);
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

  replaceDistribution(
    employeeKey: EmployeeBusinessKey,
    draft: CostCenterDistributionReplaceDraft,
  ): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.gateway
      .replaceDistribution(normalizedKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => this.handleMutationSuccess('replaced', normalizedKey),
        error: (err) => this.handleMutationError(err),
      });
  }

  closeDistribution(employeeKey: EmployeeBusinessKey, startDate: string, endDate: string): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.gateway
      .closeDistribution(normalizedKey, startDate, endDate)
      .pipe(take(1))
      .subscribe({
        next: () => this.handleMutationSuccess('closed', normalizedKey),
        error: (err) => this.handleMutationError(err),
      });
  }

  private startMutation(): void {
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);
  }

  private handleMutationSuccess(
    type: 'created' | 'replaced' | 'closed',
    key: EmployeeBusinessKey,
  ): void {
    this.mutatingState.set(false);
    this.successState.set(type);
    this.loadCostCentersInternal(key, true);
  }

  private handleMutationError(error: any): void {
    this.mutatingState.set(false);
    this.errorState.set(mapEmployeeCostCenterErrorCode(error));
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
        error: (err) => {
          if (requestId !== this.requestId) return;
          this.loadingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  private resetState(): void {
    this.requestId++;
    this.selectedEmployeeKeyState.set(null);
    this.currentDistributionState.set(null);
    this.historyState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.successState.set(null);
  }
}
