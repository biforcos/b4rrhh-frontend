import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeWorkingTimeModel } from '../models/employee-working-time.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import {
  EmployeeWorkingTimeErrorCode,
  mapEmployeeWorkingTimeErrorCode,
} from './employee-working-time-error.mapper';
import {
  WorkingTimeCloseDraft,
  WorkingTimeCreateDraft,
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
  private readonly successState = signal<'created' | 'updated' | 'closed' | null>(null);
  private requestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly workingTimes = this.workingTimesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly success = this.successState.asReadonly();

  clearFeedback(): void {
    this.errorState.set(null);
    this.successState.set(null);
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
          this.errorState.set(mapEmployeeWorkingTimeErrorCode(error));
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
          this.errorState.set(mapEmployeeWorkingTimeErrorCode(error));
        },
      });
  }

  closeWorkingTime(
    employeeKey: EmployeeBusinessKey,
    workingTimeNumber: number,
    draft: WorkingTimeCloseDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeWorkingTimeGateway
      .closeEmployeeWorkingTime(normalizedEmployeeKey, workingTimeNumber, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('closed');
          this.loadWorkingTimesByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.errorState.set(mapEmployeeWorkingTimeErrorCode(error));
        },
      });
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
    this.selectedEmployeeKeyState.set(null);
    this.workingTimesState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.successState.set(null);
  }
}
