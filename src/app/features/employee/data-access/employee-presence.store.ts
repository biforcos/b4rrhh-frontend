import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeePresenceModel } from '../models/employee-presence.model';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { EmployeePresenceReadGateway } from './employee-presence-read.gateway';

export type EmployeePresenceErrorCode = 'request-failed';

@Injectable({
  providedIn: 'root',
})
export class EmployeePresenceStore {
  private readonly employeePresenceReadGateway = inject(EmployeePresenceReadGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly presencesState = signal<ReadonlyArray<EmployeePresenceModel>>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<EmployeePresenceErrorCode | null>(null);
  private requestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly presences = this.presencesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  loadPresencesByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadPresencesByBusinessKeyInternal(key, false);
  }

  refreshPresencesByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadPresencesByBusinessKeyInternal(key, true);
  }

  private loadPresencesByBusinessKeyInternal(
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

    this.selectedEmployeeKeyState.set(normalizedKey);
    this.presencesState.set([]);
    this.loadingState.set(true);
    this.errorState.set(null);

    const requestId = ++this.requestId;

    this.employeePresenceReadGateway
      .readEmployeePresencesByBusinessKey(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (presences) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.presencesState.set(presences);
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
    this.presencesState.set([]);
    this.loadingState.set(false);
    this.errorState.set(null);
  }
}
