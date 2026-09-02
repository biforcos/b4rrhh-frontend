import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeJourneyModel } from '../models/employee-journey.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { EmployeeJourneyReadGateway } from './employee-journey-read.gateway';

export type EmployeeJourneyErrorCode = 'request-failed';

@Injectable({
  providedIn: 'root',
})
export class EmployeeJourneyStore {
  private readonly employeeJourneyReadGateway = inject(EmployeeJourneyReadGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly journeyState = signal<EmployeeJourneyModel | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<EmployeeJourneyErrorCode | null>(null);
  private requestId = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly journey = this.journeyState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  loadJourneyByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadJourneyByBusinessKeyInternal(key, false);
  }

  refreshJourneyByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadJourneyByBusinessKeyInternal(key, true);
  }

  private loadJourneyByBusinessKeyInternal(
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
    this.journeyState.set(null);
    this.loadingState.set(true);
    this.errorState.set(null);

    const requestId = ++this.requestId;

    this.employeeJourneyReadGateway
      .readEmployeeJourneyByBusinessKey(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (journey) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.journeyState.set(journey);
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
    this.journeyState.set(null);
    this.loadingState.set(false);
    this.errorState.set(null);
  }
}
