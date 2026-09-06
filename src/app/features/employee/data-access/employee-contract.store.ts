import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeContractModel } from '../models/employee-contract.model';
import {
  EmployeeContractConflictModel,
  EmployeeContractPlanModel,
} from '../models/employee-contract-plan.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import {
  EmployeeContractErrorCode,
  mapEmployeeContractConflict,
  mapEmployeeContractErrorCode,
} from './employee-contract.error.mapper';
import {
  ContractCloseDraft,
  ContractCorrectDraft,
  ContractCreateDraft,
  ContractPlanDraft,
  ContractReplaceDraft,
} from './employee-contract.mapper';
import { EmployeeContractReadGateway } from './employee-contract-read.gateway';

export type { EmployeeContractErrorCode };

@Injectable({
  providedIn: 'root',
})
export class EmployeeContractStore {
  private readonly employeeContractReadGateway = inject(EmployeeContractReadGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly contractsState = signal<ReadonlyArray<EmployeeContractModel>>([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<EmployeeContractErrorCode | null>(null);
  private readonly errorConflictState = signal<EmployeeContractConflictModel | null>(null);
  private readonly successState = signal<'created' | 'replaced' | 'corrected' | 'closed' | null>(
    null,
  );
  private readonly planState = signal<EmployeeContractPlanModel | null>(null);
  private readonly planningState = signal(false);
  private requestId = 0;
  private planRequestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly contracts = this.contractsState.asReadonly();
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
  planChange(employeeKey: EmployeeBusinessKey, draft: ContractPlanDraft): void {
    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    const planRequestId = ++this.planRequestId;

    this.planState.set(null);
    this.planningState.set(true);

    this.employeeContractReadGateway
      .planContractChange(normalizedEmployeeKey, draft)
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

  createContract(employeeKey: EmployeeBusinessKey, draft: ContractCreateDraft): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeContractReadGateway
      .createContract(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('created');
          this.loadContractsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  private failWith(error: unknown): void {
    this.errorState.set(mapEmployeeContractErrorCode(error));
    this.errorConflictState.set(mapEmployeeContractConflict(error));
  }

  loadContractsByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadContractsByBusinessKeyInternal(key, false);
  }

  replaceFromDate(employeeKey: EmployeeBusinessKey, draft: ContractReplaceDraft): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeContractReadGateway
      .replaceContractFromDate(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('replaced');
          this.loadContractsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  correctOccurrence(
    employeeKey: EmployeeBusinessKey,
    startDate: string,
    draft: ContractCorrectDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeContractReadGateway
      .correctContractOccurrence(normalizedEmployeeKey, startDate, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('corrected');
          this.loadContractsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  closeOccurrence(
    employeeKey: EmployeeBusinessKey,
    startDate: string,
    draft: ContractCloseDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeContractReadGateway
      .closeContractOccurrence(normalizedEmployeeKey, startDate, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('closed');
          this.loadContractsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  private loadContractsByBusinessKeyInternal(
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
      this.contractsState.set([]);
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    if (hasKeyChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.employeeContractReadGateway
      .readEmployeeContractsByBusinessKey(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (contracts) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.contractsState.set(
            this.employeeContractReadGateway.sortByTimelineRecency(contracts),
          );
          this.loadingState.set(false);
        },
        error: (error) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loadingState.set(false);
          this.errorState.set(mapEmployeeContractErrorCode(error));
        },
      });
  }

  private resetState(): void {
    this.requestId += 1;
    this.clearPlan();
    this.selectedEmployeeKeyState.set(null);
    this.contractsState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);
  }
}
