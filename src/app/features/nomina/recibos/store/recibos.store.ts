import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import {
  PayrollSummaryModel,
  PayrollCompanyProfileModel,
  PayrollEmployeeProfileModel,
  PayrollAgreementProfileModel,
} from '../models/payroll-summary.model';
import { RecibosFilters } from '../models/recibos-filters.model';

export type RecibosErrorCode = 'request-failed' | 'not-found' | 'transition-failed';

@Injectable({ providedIn: 'root' })
export class RecibosStore {
  private readonly gateway = inject(RecibosGateway);

  private readonly payrollsState = signal<ReadonlyArray<PayrollSummaryModel>>([]);
  private readonly listLoadingState = signal(false);
  private readonly listErrorState = signal<RecibosErrorCode | null>(null);

  private readonly selectedKeyState = signal<PayrollBusinessKey | null>(null);
  private readonly conceptsState = signal<ReadonlyArray<PayrollConceptModel>>([]);
  private readonly companyProfileState = signal<PayrollCompanyProfileModel | null>(null);
  private readonly employeeProfileState = signal<PayrollEmployeeProfileModel | null>(null);
  private readonly agreementProfileState = signal<PayrollAgreementProfileModel | null>(null);
  private readonly presenceStartDateState = signal<string | null>(null);
  private readonly presenceEndDateState = signal<string | null>(null);
  private readonly seniorityDateState = signal<string | null>(null);
  private readonly workCenterCodeState = signal<string | null>(null);
  private readonly workCenterNameState = signal<string | null>(null);
  private readonly conceptsLoadingState = signal(false);
  private readonly conceptsErrorState = signal<RecibosErrorCode | null>(null);

  private readonly transitioningState = signal(false);
  private readonly transitionErrorState = signal<string | null>(null);

  readonly payrolls = this.payrollsState.asReadonly();
  readonly listLoading = this.listLoadingState.asReadonly();
  readonly listError = this.listErrorState.asReadonly();
  readonly selectedKey = this.selectedKeyState.asReadonly();
  readonly concepts = this.conceptsState.asReadonly();
  readonly companyProfile = this.companyProfileState.asReadonly();
  readonly employeeProfile = this.employeeProfileState.asReadonly();
  readonly agreementProfile = this.agreementProfileState.asReadonly();
  readonly presenceStartDate = this.presenceStartDateState.asReadonly();
  readonly presenceEndDate = this.presenceEndDateState.asReadonly();
  readonly seniorityDate = this.seniorityDateState.asReadonly();
  readonly workCenterCode = this.workCenterCodeState.asReadonly();
  readonly workCenterName = this.workCenterNameState.asReadonly();
  readonly conceptsLoading = this.conceptsLoadingState.asReadonly();
  readonly conceptsError = this.conceptsErrorState.asReadonly();
  readonly transitioning = this.transitioningState.asReadonly();
  readonly transitionError = this.transitionErrorState.asReadonly();

  readonly selectedPayroll = computed(() => {
    const key = this.selectedKeyState();
    if (!key) return null;
    return (
      this.payrollsState().find(
        (p) =>
          p.ruleSystemCode === key.ruleSystemCode &&
          p.employeeTypeCode === key.employeeTypeCode &&
          p.employeeNumber === key.employeeNumber &&
          p.payrollPeriodCode === key.payrollPeriodCode &&
          p.payrollTypeCode === key.payrollTypeCode &&
          p.presenceNumber === key.presenceNumber,
      ) ?? null
    );
  });

  search(filters: RecibosFilters): void {
    this.listLoadingState.set(true);
    this.listErrorState.set(null);

    this.gateway
      .search(filters)
      .pipe(take(1))
      .subscribe({
        next: (payrolls) => {
          this.payrollsState.set(payrolls);
          this.listLoadingState.set(false);
        },
        error: () => {
          this.listLoadingState.set(false);
          this.listErrorState.set('request-failed');
        },
      });
  }

  selectPayroll(key: PayrollBusinessKey): void {
    this.selectedKeyState.set(key);
    this.transitionErrorState.set(null);
    this.loadConcepts(key);
  }

  invalidate(key: PayrollBusinessKey): void {
    if (this.transitioningState()) return;
    this.transitioningState.set(true);
    this.transitionErrorState.set(null);

    this.gateway
      .invalidate(key)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.updatePayrollInList(updated);
          this.transitioningState.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.transitioningState.set(false);
          this.transitionErrorState.set(this.mapTransitionError(err));
        },
      });
  }

  validate(key: PayrollBusinessKey): void {
    if (this.transitioningState()) return;
    this.transitioningState.set(true);
    this.transitionErrorState.set(null);

    this.gateway
      .validate(key)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.updatePayrollInList(updated);
          this.transitioningState.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.transitioningState.set(false);
          this.transitionErrorState.set(this.mapTransitionError(err));
        },
      });
  }

  recalculate(key: PayrollBusinessKey): void {
    if (this.transitioningState()) return;
    this.transitioningState.set(true);
    this.transitionErrorState.set(null);

    this.gateway
      .recalculate(key)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.updatePayrollInList(updated);
          this.transitioningState.set(false);
          this.loadConcepts(key);
        },
        error: (err: HttpErrorResponse) => {
          this.transitioningState.set(false);
          this.transitionErrorState.set(this.mapTransitionError(err));
        },
      });
  }

  private loadConcepts(key: PayrollBusinessKey): void {
    this.conceptsLoadingState.set(true);
    this.conceptsState.set([]);
    this.companyProfileState.set(null);
    this.employeeProfileState.set(null);
    this.agreementProfileState.set(null);
    this.presenceStartDateState.set(null);
    this.presenceEndDateState.set(null);
    this.seniorityDateState.set(null);
    this.workCenterCodeState.set(null);
    this.workCenterNameState.set(null);
    this.conceptsErrorState.set(null);

    this.gateway
      .getDetail(key)
      .pipe(take(1))
      .subscribe({
        next: (detail) => {
          this.conceptsState.set(detail.concepts);
          this.companyProfileState.set(detail.companyProfile);
          this.employeeProfileState.set(detail.employeeProfile);
          this.agreementProfileState.set(detail.agreementProfile);
          this.presenceStartDateState.set(detail.presenceStartDate);
          this.presenceEndDateState.set(detail.presenceEndDate);
          this.seniorityDateState.set(detail.seniorityDate);
          this.workCenterCodeState.set(detail.workCenterCode);
          this.workCenterNameState.set(detail.workCenterName);
          this.conceptsLoadingState.set(false);
        },
        error: () => {
          this.conceptsLoadingState.set(false);
          this.conceptsErrorState.set('request-failed');
        },
      });
  }

  private updatePayrollInList(updated: PayrollSummaryModel): void {
    this.payrollsState.update((list) =>
      list.map((p) =>
        p.ruleSystemCode === updated.ruleSystemCode &&
        p.employeeTypeCode === updated.employeeTypeCode &&
        p.employeeNumber === updated.employeeNumber &&
        p.payrollPeriodCode === updated.payrollPeriodCode &&
        p.payrollTypeCode === updated.payrollTypeCode &&
        p.presenceNumber === updated.presenceNumber
          ? updated
          : p,
      ),
    );
  }

  private mapTransitionError(err: HttpErrorResponse): string {
    if (err.status === 409)
      return err.error?.message ?? 'Transición no permitida en el estado actual.';
    if (err.status === 404) return 'Nómina no encontrada.';
    return 'Error al cambiar el estado. Inténtalo de nuevo.';
  }
}
