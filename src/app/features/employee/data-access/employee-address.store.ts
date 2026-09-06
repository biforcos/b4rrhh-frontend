import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeAddressModel } from '../models/employee-address.model';
import { EmployeeAddressPlanModel } from '../models/employee-address-plan.model';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { readTimelineConflict } from '../shared/utils/timeline-conflict.util';
import { TimelineConflict } from '../shared/utils/timeline-plan-message.util';
import {
  AddressCorrectDraft,
  AddressCreateDraft,
  AddressPlanDraft,
} from './employee-address-edit.mapper';
import {
  EmployeeAddressErrorCode,
  mapEmployeeAddressErrorCode,
} from './employee-address.error.mapper';
import { EmployeeAddressGateway } from './employee-address.gateway';
import { EmployeeAddressReadGateway } from './employee-address-read.gateway';

export type { EmployeeAddressErrorCode };

@Injectable({
  providedIn: 'root',
})
export class EmployeeAddressStore {
  private readonly employeeAddressReadGateway = inject(EmployeeAddressReadGateway);
  private readonly employeeAddressGateway = inject(EmployeeAddressGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly addressesState = signal<ReadonlyArray<EmployeeAddressModel>>([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<EmployeeAddressErrorCode | null>(null);
  private readonly errorConflictState = signal<TimelineConflict | null>(null);
  private readonly successState = signal<'created' | 'corrected' | 'deleted' | null>(null);
  private readonly planState = signal<EmployeeAddressPlanModel | null>(null);
  private readonly planningState = signal(false);
  private requestId = 0;
  private planRequestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly addresses = this.addressesState.asReadonly();
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

  loadAddresses(key: EmployeeBusinessKey | null): void {
    this.loadAddressesByBusinessKey(key);
  }

  loadAddressesByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadAddressesByBusinessKeyInternal(key, false);
  }

  /**
   * Pide al backend qué haría el cambio sin aplicarlo (ADR-057). Cada petición invalida la
   * anterior: mientras llega la respuesta no hay plan, para que nadie confirme contra uno viejo.
   */
  planChange(employeeKey: EmployeeBusinessKey, draft: AddressPlanDraft): void {
    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    const planRequestId = ++this.planRequestId;

    this.planState.set(null);
    this.planningState.set(true);

    this.employeeAddressGateway
      .planAddressChange(normalizedEmployeeKey, draft)
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

  createAddress(employeeKey: EmployeeBusinessKey, draft: AddressCreateDraft): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.employeeAddressGateway
      .createAddress(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => this.finishMutation('created', normalizedEmployeeKey),
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  correctAddress(
    employeeKey: EmployeeBusinessKey,
    addressNumber: number,
    draft: AddressCorrectDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.employeeAddressGateway
      .correctAddress(normalizedEmployeeKey, addressNumber, draft)
      .pipe(take(1))
      .subscribe({
        next: () => this.finishMutation('corrected', normalizedEmployeeKey),
        error: (error) => {
          this.mutatingState.set(false);
          this.failWith(error);
        },
      });
  }

  deleteAddress(employeeKey: EmployeeBusinessKey, addressNumber: number): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    this.startMutation();

    this.employeeAddressGateway
      .deleteAddress(normalizedEmployeeKey, addressNumber)
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
    this.loadAddressesByBusinessKeyInternal(key, true);
  }

  private failWith(error: unknown): void {
    this.errorState.set(mapEmployeeAddressErrorCode(error));
    this.errorConflictState.set(readTimelineConflict(error));
  }

  private loadAddressesByBusinessKeyInternal(
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
      this.addressesState.set([]);
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    if (hasKeyChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.employeeAddressReadGateway
      .readEmployeeAddressesByBusinessKey(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (addresses) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.addressesState.set(addresses);
          this.loadingState.set(false);
        },
        error: () => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loadingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  private resetState(): void {
    this.requestId += 1;
    this.clearPlan();
    this.selectedEmployeeKeyState.set(null);
    this.addressesState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.errorConflictState.set(null);
    this.successState.set(null);
  }
}
