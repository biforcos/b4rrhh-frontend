import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeCoreIdentityDraft } from '../models/employee-core-identity-draft.model';
import { EmployeeDetailModel } from '../models/employee-detail.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { EmployeeDetailGateway } from './employee-detail.gateway';
import { EmployeeDetailReadGateway } from './employee-detail-read.gateway';

export type EmployeeDetailErrorCode = 'not-found' | 'request-failed';
export type EmployeeDetailMutationErrorCode = 'request-failed';

@Injectable({
  providedIn: 'root',
})
export class EmployeeDetailStore {
  private readonly employeeDetailReadGateway = inject(EmployeeDetailReadGateway);
  private readonly employeeDetailGateway = inject(EmployeeDetailGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly selectedEmployeeDetailState = signal<EmployeeDetailModel | null>(null);
  private readonly loadingDetailState = signal(false);
  private readonly detailErrorState = signal<EmployeeDetailErrorCode | null>(null);
  private readonly mutatingState = signal(false);
  private readonly mutationErrorState = signal<EmployeeDetailMutationErrorCode | null>(null);
  private readonly mutationSuccessState = signal<'updated' | null>(null);
  private requestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly selectedEmployeeDetail = this.selectedEmployeeDetailState.asReadonly();
  readonly loadingDetail = this.loadingDetailState.asReadonly();
  readonly detailError = this.detailErrorState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly mutationError = this.mutationErrorState.asReadonly();
  readonly mutationSuccess = this.mutationSuccessState.asReadonly();

  clearMutationFeedback(): void {
    this.mutationErrorState.set(null);
    this.mutationSuccessState.set(null);
  }

  loadEmployeeDetailByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadEmployeeDetailByBusinessKeyInternal(key, false);
  }

  refreshEmployeeDetailByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadEmployeeDetailByBusinessKeyInternal(key, true);
  }

  updateEmployeeCoreIdentity(
    employeeKey: EmployeeBusinessKey,
    draft: EmployeeCoreIdentityDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.mutationErrorState.set(null);
    this.mutationSuccessState.set(null);

    this.employeeDetailGateway
      .updateEmployeeCoreIdentity(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.mutationSuccessState.set('updated');
          this.loadEmployeeDetailByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: () => {
          this.mutatingState.set(false);
          this.mutationErrorState.set('request-failed');
        },
      });
  }

  private loadEmployeeDetailByBusinessKeyInternal(
    key: EmployeeBusinessKey | null,
    forceReload: boolean,
  ): void {
    if (!key) {
      this.resetDetailState();
      return;
    }

    const normalizedKey = toEmployeeBusinessKey(key);
    const isSameKey = areEmployeeBusinessKeysEqual(this.selectedEmployeeKeyState(), normalizedKey);

    if (
      !forceReload &&
      isSameKey &&
      (this.loadingDetailState() ||
        (this.selectedEmployeeDetailState() !== null && this.detailErrorState() === null))
    ) {
      return;
    }

    const hasKeyChanged = !isSameKey;

    this.selectedEmployeeKeyState.set(normalizedKey);
    if (hasKeyChanged) {
      this.selectedEmployeeDetailState.set(null);
      this.mutationErrorState.set(null);
      this.mutationSuccessState.set(null);
    }
    this.loadingDetailState.set(true);
    this.detailErrorState.set(null);

    const requestId = ++this.requestId;

    this.employeeDetailReadGateway
      .readEmployeeDetailByBusinessKey(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (employeeDetail) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loadingDetailState.set(false);

          if (!employeeDetail) {
            this.selectedEmployeeDetailState.set(null);
            this.detailErrorState.set('not-found');
            return;
          }

          this.selectedEmployeeDetailState.set(employeeDetail);
        },
        error: () => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loadingDetailState.set(false);
          this.detailErrorState.set('request-failed');
        },
      });
  }

  private resetDetailState(): void {
    this.requestId += 1;
    this.selectedEmployeeKeyState.set(null);
    this.selectedEmployeeDetailState.set(null);
    this.loadingDetailState.set(false);
    this.detailErrorState.set(null);
    this.mutatingState.set(false);
    this.mutationErrorState.set(null);
    this.mutationSuccessState.set(null);
  }
}
