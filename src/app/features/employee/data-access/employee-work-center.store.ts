import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeWorkCenterModel } from '../models/employee-work-center.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import {
  EmployeeWorkCenterErrorCode,
  mapEmployeeWorkCenterErrorCode,
} from './employee-work-center-error.mapper';
import { WorkCenterCorrectDraft, WorkCenterCreateDraft } from './employee-work-center.mapper';
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
  private readonly successState = signal<'created' | 'corrected' | 'closed' | 'deleted' | null>(
    null,
  );
  private requestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly workCenters = this.workCentersState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly success = this.successState.asReadonly();

  clearFeedback(): void {
    this.errorState.set(null);
    this.successState.set(null);
  }

  loadWorkCenters(key: EmployeeBusinessKey | null): void {
    this.loadWorkCentersByBusinessKeyInternal(key, false);
  }

  refreshWorkCenters(key: EmployeeBusinessKey | null): void {
    this.loadWorkCentersByBusinessKeyInternal(key, true);
  }

  createWorkCenter(employeeKey: EmployeeBusinessKey, draft: WorkCenterCreateDraft): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeWorkCenterGateway
      .createWorkCenter(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('created');
          this.loadWorkCentersByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.errorState.set(mapEmployeeWorkCenterErrorCode(error));
        },
      });
  }

  closeWorkCenter(
    employeeKey: EmployeeBusinessKey,
    workCenterAssignmentNumber: number,
    endDate: string,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeWorkCenterGateway
      .closeWorkCenter(normalizedEmployeeKey, workCenterAssignmentNumber, endDate)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('closed');
          this.loadWorkCentersByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.errorState.set(mapEmployeeWorkCenterErrorCode(error));
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

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeWorkCenterGateway
      .correctWorkCenter(normalizedEmployeeKey, workCenterAssignmentNumber, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('corrected');
          this.loadWorkCentersByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.errorState.set(mapEmployeeWorkCenterErrorCode(error));
        },
      });
  }

  deleteWorkCenter(employeeKey: EmployeeBusinessKey, workCenterAssignmentNumber: number): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeWorkCenterGateway
      .deleteWorkCenter(normalizedEmployeeKey, workCenterAssignmentNumber)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('deleted');
          this.loadWorkCentersByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.errorState.set(mapEmployeeWorkCenterErrorCode(error));
        },
      });
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
    this.selectedEmployeeKeyState.set(null);
    this.workCentersState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.successState.set(null);
  }
}
