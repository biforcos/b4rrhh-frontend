import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeLaborClassificationCatalogItemModel } from '../models/employee-labor-classification-catalog-item.model';
import { EmployeeLaborClassificationCatalogGateway } from './employee-labor-classification-catalog.gateway';
import { HttpFailure, toHttpFailure } from '../../../shared/utils/http-failure.util';

export type EmployeeLaborClassificationCatalogErrorCode = 'request-failed';

@Injectable({
  providedIn: 'root',
})
export class EmployeeLaborClassificationCatalogStore {
  private readonly gateway = inject(EmployeeLaborClassificationCatalogGateway);

  private readonly ruleSystemCodeState = signal<string | null>(null);
  private readonly effectiveDateState = signal<string | null>(null);
  private readonly selectedAgreementCodeState = signal<string | null>(null);
  private readonly selectedAgreementCategoryCodeState = signal<string | null>(null);
  private readonly agreementsState = signal<
    ReadonlyArray<EmployeeLaborClassificationCatalogItemModel>
  >([]);
  private readonly agreementCategoriesState = signal<
    ReadonlyArray<EmployeeLaborClassificationCatalogItemModel>
  >([]);
  private readonly loadingAgreementsState = signal(false);
  private readonly loadingCategoriesState = signal(false);
  private readonly errorState = signal<EmployeeLaborClassificationCatalogErrorCode | null>(null);
  private readonly failureState = signal<HttpFailure | null>(null);

  private agreementsRequestId = 0;
  private categoriesRequestId = 0;

  readonly ruleSystemCode = this.ruleSystemCodeState.asReadonly();
  readonly effectiveDate = this.effectiveDateState.asReadonly();
  readonly selectedAgreementCode = this.selectedAgreementCodeState.asReadonly();
  readonly selectedAgreementCategoryCode = this.selectedAgreementCategoryCodeState.asReadonly();
  readonly agreements = this.agreementsState.asReadonly();
  readonly agreementCategories = this.agreementCategoriesState.asReadonly();
  readonly loadingAgreements = this.loadingAgreementsState.asReadonly();
  readonly loadingCategories = this.loadingCategoriesState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Lo que se sabe del último fallo, para contarlo y no sólo clasificarlo (`b4rrhh/frontend#92`). */
  readonly failure = this.failureState.asReadonly();

  loadAgreements(ruleSystemCode: string, effectiveDate?: string | null): void {
    const normalizedRuleSystemCode = this.normalizeRequiredValue(ruleSystemCode);
    const normalizedEffectiveDate = this.normalizeOptionalValue(effectiveDate);

    this.ruleSystemCodeState.set(normalizedRuleSystemCode);
    this.effectiveDateState.set(normalizedEffectiveDate);
    this.selectedAgreementCodeState.set(null);
    this.selectedAgreementCategoryCodeState.set(null);
    this.agreementCategoriesState.set([]);
    this.loadingCategoriesState.set(false);
    this.errorState.set(null);
    this.failureState.set(null);

    this.loadingAgreementsState.set(true);
    const requestId = ++this.agreementsRequestId;

    this.gateway
      .loadAgreements(normalizedRuleSystemCode, normalizedEffectiveDate)
      .pipe(take(1))
      .subscribe({
        next: (agreements) => {
          if (requestId !== this.agreementsRequestId) {
            return;
          }

          this.agreementsState.set(agreements);
          this.loadingAgreementsState.set(false);
        },
        error: (err: unknown) => {
          this.failureState.set(toHttpFailure(err));
          if (requestId !== this.agreementsRequestId) {
            return;
          }

          this.loadingAgreementsState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  selectAgreement(agreementCode: string | null): void {
    const normalizedAgreementCode = this.normalizeOptionalValue(agreementCode);

    this.selectedAgreementCodeState.set(normalizedAgreementCode);
    this.selectedAgreementCategoryCodeState.set(null);
    this.agreementCategoriesState.set([]);
    this.loadingCategoriesState.set(false);
    this.errorState.set(null);
    this.failureState.set(null);

    const ruleSystemCode = this.ruleSystemCodeState();
    if (!ruleSystemCode || !normalizedAgreementCode) {
      return;
    }

    this.loadingCategoriesState.set(true);
    const requestId = ++this.categoriesRequestId;

    this.gateway
      .loadAgreementCategories(ruleSystemCode, normalizedAgreementCode, this.effectiveDateState())
      .pipe(take(1))
      .subscribe({
        next: (categories) => {
          if (requestId !== this.categoriesRequestId) {
            return;
          }

          this.agreementCategoriesState.set(categories);
          this.loadingCategoriesState.set(false);
        },
        error: (err: unknown) => {
          this.failureState.set(toHttpFailure(err));
          if (requestId !== this.categoriesRequestId) {
            return;
          }

          this.loadingCategoriesState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  selectAgreementCategory(agreementCategoryCode: string | null): void {
    this.selectedAgreementCategoryCodeState.set(this.normalizeOptionalValue(agreementCategoryCode));
  }

  updateEffectiveDate(effectiveDate: string | null): void {
    const ruleSystemCode = this.ruleSystemCodeState();
    if (!ruleSystemCode) {
      this.effectiveDateState.set(this.normalizeOptionalValue(effectiveDate));
      return;
    }

    const currentAgreementCode = this.selectedAgreementCodeState();
    this.loadAgreements(ruleSystemCode, effectiveDate);

    if (currentAgreementCode) {
      this.selectAgreement(currentAgreementCode);
    }
  }

  private normalizeRequiredValue(value: string): string {
    return value.trim();
  }

  private normalizeOptionalValue(value: string | null | undefined): string | null {
    const normalizedValue = value?.trim() ?? '';
    return normalizedValue.length > 0 ? normalizedValue : null;
  }
}
