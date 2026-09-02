import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs';

import { RuleSystemGateway } from '../gateway/rule-system.gateway';
import { RuleSystemFormModel } from '../models/rule-system-form.model';
import { RuleSystem } from '../models/rule-system.model';
import { ruleSystemTexts } from '../rule-system.texts';

@Injectable({
  providedIn: 'root',
})
export class RuleSystemStore {
  private readonly router = inject(Router);
  private readonly ruleSystemGateway = inject(RuleSystemGateway);

  private readonly itemsState = signal<ReadonlyArray<RuleSystem>>([]);
  private readonly selectedState = signal<RuleSystem | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly savingState = signal(false);
  private readonly successMessageState = signal<string | null>(null);
  private loadListRequestId = 0;
  private loadDetailRequestId = 0;

  readonly items = this.itemsState.asReadonly();
  readonly selected = this.selectedState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly successMessage = this.successMessageState.asReadonly();

  clearMessages(): void {
    this.errorState.set(null);
    this.successMessageState.set(null);
  }

  prepareCreate(): void {
    this.selectedState.set(null);
    this.clearMessages();
  }

  loadList(): void {
    this.loadingState.set(true);
    this.errorState.set(null);

    const requestId = ++this.loadListRequestId;

    this.ruleSystemGateway
      .loadRuleSystems()
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          if (requestId !== this.loadListRequestId) {
            return;
          }

          this.itemsState.set(items);
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          if (requestId !== this.loadListRequestId) {
            return;
          }

          this.loadingState.set(false);
          this.errorState.set(this.formatError(error));
        },
      });
  }

  loadDetail(code: string): void {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      this.selectedState.set(null);
      this.errorState.set(null);
      return;
    }

    this.loadingState.set(true);
    this.errorState.set(null);

    const requestId = ++this.loadDetailRequestId;

    this.ruleSystemGateway
      .loadRuleSystem(normalizedCode)
      .pipe(take(1))
      .subscribe({
        next: (item) => {
          if (requestId !== this.loadDetailRequestId) {
            return;
          }

          this.selectedState.set(item);
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          if (requestId !== this.loadDetailRequestId) {
            return;
          }

          this.loadingState.set(false);
          this.errorState.set(this.formatError(error));
        },
      });
  }

  create(formValue: RuleSystemFormModel): void {
    if (this.savingState()) {
      return;
    }

    this.savingState.set(true);
    this.errorState.set(null);
    this.successMessageState.set(null);

    this.ruleSystemGateway
      .createRuleSystem(formValue)
      .pipe(take(1))
      .subscribe({
        next: (created) => {
          this.savingState.set(false);
          this.selectedState.set(created);
          this.successMessageState.set(ruleSystemTexts.createSuccessMessage);
          this.loadList();
          void this.router.navigate(['/configuracion/rule-systems', created.code]);
        },
        error: (error: unknown) => {
          this.savingState.set(false);
          this.errorState.set(this.formatError(error));
        },
      });
  }

  update(code: string, formValue: RuleSystemFormModel): void {
    if (this.savingState()) {
      return;
    }

    const normalizedCode = code.trim();
    if (!normalizedCode) {
      this.errorState.set('Rule system code is required for update.');
      return;
    }

    this.savingState.set(true);
    this.errorState.set(null);
    this.successMessageState.set(null);

    this.ruleSystemGateway
      .updateRuleSystem(normalizedCode, formValue)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.savingState.set(false);
          this.successMessageState.set(ruleSystemTexts.updateSuccessMessage);
          this.loadDetail(normalizedCode);
          this.loadList();
        },
        error: (error: unknown) => {
          this.savingState.set(false);
          this.errorState.set(this.formatError(error));
        },
      });
  }

  private formatError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (
        typeof error.error === 'object' &&
        error.error &&
        typeof error.error.message === 'string'
      ) {
        return error.error.message;
      }

      if (typeof error.error === 'string' && error.error.trim().length > 0) {
        return error.error;
      }

      return `Request failed with status ${error.status}.`;
    }

    return 'Unexpected error while processing rule systems.';
  }
}
