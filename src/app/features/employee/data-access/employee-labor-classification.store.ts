import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeLaborClassificationModel } from '../models/employee-labor-classification.model';
import {
  EmployeeLaborClassificationConflictModel,
  EmployeeLaborClassificationPlanModel,
} from '../models/employee-labor-classification-plan.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import {
  EmployeeLaborClassificationErrorCode,
  mapEmployeeLaborClassificationConflict,
  mapEmployeeLaborClassificationErrorCode,
} from './employee-labor-classification.error.mapper';
import {
  LaborClassificationCorrectDraft,
  LaborClassificationCreateDraft,
  LaborClassificationPlanDraft,
} from './employee-labor-classification.mapper';
import { EmployeeLaborClassificationReadGateway } from './employee-labor-classification-read.gateway';

export type { EmployeeLaborClassificationErrorCode };

@Injectable({
  providedIn: 'root',
})
export class EmployeeLaborClassificationStore {
  private readonly employeeLaborClassificationReadGateway = inject(
    EmployeeLaborClassificationReadGateway,
  );
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly laborClassificationsState = signal<
    ReadonlyArray<EmployeeLaborClassificationModel>
  >([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<EmployeeLaborClassificationErrorCode | null>(null);
  private readonly errorConflictState = signal<EmployeeLaborClassificationConflictModel | null>(
    null,
  );
  private readonly successState = signal<'created' | 'corrected' | null>(null);
  private readonly planState = signal<EmployeeLaborClassificationPlanModel | null>(null);
  private readonly planningState = signal(false);
  private requestId = 0;
  private planRequestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly laborClassifications = this.laborClassificationsState.asReadonly();
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
  planChange(employeeKey: EmployeeBusinessKey, draft: LaborClassificationPlanDraft): void {
    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    const planRequestId = ++this.planRequestId;

    this.planState.set(null);
    this.planningState.set(true);

    this.employeeLaborClassificationReadGateway
      .planLaborClassificationChange(normalizedEmployeeKey, draft)
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

  createLaborClassification(
    employeeKey: EmployeeBusinessKey,
    draft: LaborClassificationCreateDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeLaborClassificationReadGateway
      .createLaborClassification(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('created');
          this.loadLaborClassificationsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  private failWith(error: unknown): void {
    this.errorState.set(mapEmployeeLaborClassificationErrorCode(error));
    this.errorConflictState.set(mapEmployeeLaborClassificationConflict(error));
  }

  loadLaborClassificationsByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadLaborClassificationsByBusinessKeyInternal(key, false);
  }

  correctOccurrence(
    employeeKey: EmployeeBusinessKey,
    startDate: string,
    draft: LaborClassificationCorrectDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);

    this.employeeLaborClassificationReadGateway
      .correctLaborClassificationOccurrence(normalizedEmployeeKey, startDate, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('corrected');
          this.loadLaborClassificationsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  private loadLaborClassificationsByBusinessKeyInternal(
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
      this.laborClassificationsState.set([]);
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    if (hasKeyChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.employeeLaborClassificationReadGateway
      .readEmployeeLaborClassificationsByBusinessKey(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (laborClassifications) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.laborClassificationsState.set(
            this.employeeLaborClassificationReadGateway.sortByTimelineRecency(laborClassifications),
          );
          this.loadingState.set(false);
        },
        error: (error) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loadingState.set(false);
          this.errorState.set(mapEmployeeLaborClassificationErrorCode(error));
        },
      });
  }

  private resetState(): void {
    this.requestId += 1;
    this.clearPlan();
    this.selectedEmployeeKeyState.set(null);
    this.laborClassificationsState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);
  }
}
