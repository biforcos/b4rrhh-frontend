import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';
import { HireEmployeeDraft, HireEmployeeResult } from '../models/employee-hiring.model';
import { EmployeeHiringGateway } from './employee-hiring.gateway';
import { HttpFailure, toHttpFailure } from '../../../shared/utils/http-failure.util';

export type HireEmployeeErrorCode =
  | 'already-exists'
  | 'invalid-catalog-value'
  | 'invalid-dependent-relation'
  | 'request-failed';

@Injectable({
  providedIn: 'root',
})
export class EmployeeHiringStore {
  private readonly gateway = inject(EmployeeHiringGateway);

  private readonly hiringState = signal(false);
  private readonly errorState = signal<HireEmployeeErrorCode | null>(null);
  private readonly failureState = signal<HttpFailure | null>(null);
  private readonly resultState = signal<HireEmployeeResult | null>(null);

  readonly hiring = this.hiringState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Lo que se sabe del último fallo, para contarlo y no sólo clasificarlo (`b4rrhh/frontend#92`). */
  readonly failure = this.failureState.asReadonly();
  readonly result = this.resultState.asReadonly();

  hire(draft: HireEmployeeDraft): void {
    if (this.hiringState()) return;

    this.hiringState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    this.resultState.set(null);

    this.gateway
      .hire(draft)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.hiringState.set(false);
          this.resultState.set(result);
        },
        error: (error) => {
          this.failureState.set(toHttpFailure(error));
          this.hiringState.set(false);
          this.errorState.set(this.mapError(error));
        },
      });
  }

  private mapError(error: any): HireEmployeeErrorCode {
    if (error.status === 409) return 'already-exists';
    if (error.status === 422) return 'invalid-catalog-value';
    return 'request-failed';
  }

  reset(): void {
    this.hiringState.set(false);
    this.errorState.set(null);
    this.failureState.set(null);
    this.resultState.set(null);
  }
}
