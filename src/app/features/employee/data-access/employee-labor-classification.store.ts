import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeLaborClassificationModel } from '../models/employee-labor-classification.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { mapEmployeeLaborClassificationErrorCode } from './employee-labor-classification.error.mapper';
import {
  LaborClassificationCloseDraft,
  LaborClassificationCorrectDraft,
  LaborClassificationReplaceDraft,
} from './employee-labor-classification.mapper';
import { EmployeeLaborClassificationReadGateway } from './employee-labor-classification-read.gateway';

export type EmployeeLaborClassificationErrorCode =
  | 'LABOR_CLASSIFICATION_OVERLAP'
  | 'LABOR_CLASSIFICATION_OUTSIDE_PRESENCE'
  | 'LABOR_CLASSIFICATION_INCOMPLETE_COVERAGE'
  | 'LABOR_CLASSIFICATION_INVALID_PERIOD'
  | 'LABOR_CLASSIFICATION_ALREADY_CLOSED'
  | 'LABOR_CLASSIFICATION_NOT_FOUND'
  | 'AGREEMENT_NOT_FOUND'
  | 'AGREEMENT_CATEGORY_NOT_FOUND'
  | 'AGREEMENT_CATEGORY_RELATION_INVALID'
  | 'request-failed';

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
  private readonly successState = signal<'replaced' | 'corrected' | 'closed' | null>(null);
  private requestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly laborClassifications = this.laborClassificationsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly success = this.successState.asReadonly();

  clearFeedback(): void {
    this.errorState.set(null);
    this.successState.set(null);
  }

  loadLaborClassificationsByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadLaborClassificationsByBusinessKeyInternal(key, false);
  }

  replaceFromDate(employeeKey: EmployeeBusinessKey, draft: LaborClassificationReplaceDraft): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeLaborClassificationReadGateway
      .replaceLaborClassificationFromDate(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('replaced');
          this.loadLaborClassificationsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.errorState.set(mapEmployeeLaborClassificationErrorCode(error));
        },
      });
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
          this.errorState.set(mapEmployeeLaborClassificationErrorCode(error));
        },
      });
  }

  closeOccurrence(
    employeeKey: EmployeeBusinessKey,
    startDate: string,
    draft: LaborClassificationCloseDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeLaborClassificationReadGateway
      .closeLaborClassificationOccurrence(normalizedEmployeeKey, startDate, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('closed');
          this.loadLaborClassificationsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.errorState.set(mapEmployeeLaborClassificationErrorCode(error));
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
    this.selectedEmployeeKeyState.set(null);
    this.laborClassificationsState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.successState.set(null);
  }
}
