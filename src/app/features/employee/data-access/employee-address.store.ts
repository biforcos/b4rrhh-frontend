import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeAddressModel } from '../models/employee-address.model';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { AddressCreateDraft, AddressEditCurrentDraft } from './employee-address-edit.mapper';
import { EmployeeAddressGateway } from './employee-address.gateway';
import { EmployeeAddressReadGateway } from './employee-address-read.gateway';

export type EmployeeAddressErrorCode = 'request-failed';

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
  private readonly successState = signal<'created' | 'updated' | 'closed' | null>(null);
  private requestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly addresses = this.addressesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly success = this.successState.asReadonly();

  clearFeedback(): void {
    this.errorState.set(null);
    this.successState.set(null);
  }

  loadAddresses(key: EmployeeBusinessKey | null): void {
    this.loadAddressesByBusinessKey(key);
  }

  loadAddressesByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadAddressesByBusinessKeyInternal(key, false);
  }

  createAddress(employeeKey: EmployeeBusinessKey, draft: AddressCreateDraft): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeAddressGateway
      .createAddress(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('created');
          this.loadAddressesByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: () => {
          this.mutatingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  closeAddress(employeeKey: EmployeeBusinessKey, addressNumber: number, endDate: string): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeAddressGateway
      .closeAddress(normalizedEmployeeKey, addressNumber, endDate)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('closed');
          this.loadAddressesByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: () => {
          this.mutatingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  updateAddress(
    employeeKey: EmployeeBusinessKey,
    addressNumber: number,
    draft: AddressEditCurrentDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeAddressGateway
      .updateAddress(normalizedEmployeeKey, addressNumber, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('updated');
          this.loadAddressesByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: () => {
          this.mutatingState.set(false);
          this.errorState.set('request-failed');
        },
      });
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
    this.selectedEmployeeKeyState.set(null);
    this.addressesState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.successState.set(null);
  }
}
