import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeYearModel } from '../models/employee-year.model';
import { HttpFailure, toHttpFailure } from '../../../shared/utils/http-failure.util';
import { EmployeeYearGateway } from './employee-year.gateway';

/**
 * El año que pinta la tira (`b4rrhh/frontend#109`). La respuesta que llega tarde no gana: pasar de
 * año deprisa deja en pantalla el último que se pidió, no el último que llegó.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeYearStore {
  private readonly gateway = inject(EmployeeYearGateway);
  private requestId = 0;

  private readonly yearState = signal<EmployeeYearModel | null>(null);
  private readonly loadingState = signal(false);
  private readonly failureState = signal<HttpFailure | null>(null);

  readonly year = this.yearState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly failure = this.failureState.asReadonly();

  load(key: EmployeeBusinessKey | null, year: number): void {
    const requestId = ++this.requestId;
    if (!key) {
      this.yearState.set(null);
      this.loadingState.set(false);
      return;
    }
    this.loadingState.set(true);
    this.failureState.set(null);
    this.gateway
      .getYear(key, year)
      .pipe(take(1))
      .subscribe({
        next: (model) => {
          if (requestId !== this.requestId) return;
          this.yearState.set(model);
          this.loadingState.set(false);
        },
        error: (err: unknown) => {
          if (requestId !== this.requestId) return;
          this.yearState.set(null);
          this.failureState.set(toHttpFailure(err));
          this.loadingState.set(false);
        },
      });
  }
}
