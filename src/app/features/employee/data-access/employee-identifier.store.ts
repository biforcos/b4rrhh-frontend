import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeIdentifierModel } from '../models/employee-identifier.model';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { IdentifierDraft } from './employee-identifier-edit.mapper';
import { EmployeeIdentifierGateway } from './employee-identifier.gateway';
import { EmployeeIdentifierReadGateway } from './employee-identifier-read.gateway';

export type EmployeeIdentifierErrorCode = 'request-failed';

@Injectable({
  providedIn: 'root',
})
export class EmployeeIdentifierStore {
  private readonly employeeIdentifierReadGateway = inject(EmployeeIdentifierReadGateway);
  private readonly employeeIdentifierGateway = inject(EmployeeIdentifierGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly identifiersState = signal<ReadonlyArray<EmployeeIdentifierModel>>([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<EmployeeIdentifierErrorCode | null>(null);
  private readonly successState = signal<'created' | 'updated' | 'deleted' | null>(null);
  private requestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly identifiers = this.identifiersState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly success = this.successState.asReadonly();

  clearFeedback(): void {
    this.errorState.set(null);
    this.successState.set(null);
  }

  loadIdentifiers(key: EmployeeBusinessKey | null): void {
    this.loadIdentifiersByBusinessKey(key);
  }

  loadIdentifiersByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadIdentifiersByBusinessKeyInternal(key, false);
  }

  createIdentifier(employeeKey: EmployeeBusinessKey, draft: IdentifierDraft): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeIdentifierGateway
      .createIdentifier(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('created');
          this.loadIdentifiersByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: () => {
          this.mutatingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  updateIdentifier(
    employeeKey: EmployeeBusinessKey,
    identifierTypeCode: string,
    draft: IdentifierDraft,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeIdentifierGateway
      .updateIdentifier(normalizedEmployeeKey, identifierTypeCode, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('updated');
          this.loadIdentifiersByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: () => {
          this.mutatingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  deleteIdentifier(employeeKey: EmployeeBusinessKey, identifierTypeCode: string): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);

    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.employeeIdentifierGateway
      .deleteIdentifier(normalizedEmployeeKey, identifierTypeCode)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('deleted');
          this.loadIdentifiersByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: () => {
          this.mutatingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  private loadIdentifiersByBusinessKeyInternal(
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
      this.identifiersState.set([]);
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    if (hasKeyChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.employeeIdentifierReadGateway
      .readEmployeeIdentifiersByBusinessKey(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (identifiers) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.identifiersState.set(identifiers);
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
    this.identifiersState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.successState.set(null);
  }
}
