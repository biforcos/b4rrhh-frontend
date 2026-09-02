import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';
import { RehireEmployeeDraft, RehireEmployeeResult } from '../models/employee-rehire.model';
import { EmployeeRehireGateway } from './employee-rehire.gateway';

export type RehireEmployeeErrorCode =
  | 'employee-not-found'
  | 'already-active'
  | 'invalid-rehire-date'
  | 'rehire-conflict'
  | 'invalid-working-time'
  | 'invalid-catalog-value'
  | 'invalid-dependent-relation'
  | 'invalid-distribution'
  | 'request-failed';

@Injectable({
  providedIn: 'root',
})
export class EmployeeRehireStore {
  private readonly gateway = inject(EmployeeRehireGateway);

  private readonly rehireState = signal(false);
  private readonly errorState = signal<RehireEmployeeErrorCode | null>(null);
  private readonly resultState = signal<RehireEmployeeResult | null>(null);

  readonly rehiring = this.rehireState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly result = this.resultState.asReadonly();

  rehire(draft: RehireEmployeeDraft): void {
    if (this.rehireState()) return;

    this.rehireState.set(true);
    this.errorState.set(null);
    this.resultState.set(null);

    this.gateway
      .rehire(draft)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.rehireState.set(false);
          this.resultState.set(result);
        },
        error: (error) => {
          this.rehireState.set(false);
          this.errorState.set(this.mapError(error));
        },
      });
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private extractFunctionalCode(error: unknown): string {
    if (!this.isRecord(error)) return '';

    // Prefer explicit error.code at top level
    const topCode = typeof error['code'] === 'string' ? error['code'] : null;
    if (topCode) return topCode;

    // Check nested error structures: error.error.code OR error.error.error.code
    const nested = error['error'];
    if (this.isRecord(nested)) {
      if (typeof nested['code'] === 'string') return nested['code'];
      const inner = nested['error'];
      if (this.isRecord(inner) && typeof inner['code'] === 'string') return inner['code'];
    }

    return '';
  }

  private extractErrorMessage(error: unknown): string {
    if (!this.isRecord(error)) return '';

    const topMessage = typeof error['message'] === 'string' ? error['message'] : null;
    if (topMessage) return topMessage;

    const nested = error['error'];
    if (this.isRecord(nested)) {
      if (typeof nested['message'] === 'string') return nested['message'];
      const inner = nested['error'];
      if (this.isRecord(inner) && typeof inner['message'] === 'string') return inner['message'];
    }

    return '';
  }

  private mapError(error: unknown): RehireEmployeeErrorCode {
    if (!this.isRecord(error)) return 'request-failed';

    const status = typeof error['status'] === 'number' ? error['status'] : undefined;
    if (status === 404) return 'employee-not-found';
    if (status === 409) {
      const functionalCode = this.extractFunctionalCode(error).toUpperCase();
      const message = this.extractErrorMessage(error).toUpperCase();
      const conflictContext = `${functionalCode} ${message}`;

      if (conflictContext.includes('ALREADY_ACTIVE')) return 'already-active';
      if (
        conflictContext.includes('INVALID_REHIRE_DATE') ||
        conflictContext.includes('REHIRE_DATE')
      )
        return 'invalid-rehire-date';

      return 'rehire-conflict';
    }

    if (status === 422) {
      const functionalCode = this.extractFunctionalCode(error).toUpperCase();

      if (functionalCode.includes('BUSINESS_VALIDATION') || functionalCode.includes('WORKING'))
        return 'invalid-working-time';
      if (functionalCode.includes('DISTRIBUT') || functionalCode.includes('COST_CENTER'))
        return 'invalid-distribution';
      if (functionalCode.includes('DEPEND') || functionalCode.includes('RELATION'))
        return 'invalid-dependent-relation';
      if (
        functionalCode.includes('CATALOG') ||
        functionalCode.includes('NOT_FOUND') ||
        functionalCode.includes('INVALID')
      )
        return 'invalid-catalog-value';

      return 'invalid-catalog-value';
    }

    return 'request-failed';
  }

  reset(): void {
    this.rehireState.set(false);
    this.errorState.set(null);
    this.resultState.set(null);
  }
}
