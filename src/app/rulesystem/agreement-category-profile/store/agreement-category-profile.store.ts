import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, take } from 'rxjs';

import { RuleSystemScopeStore } from '../../../core/scope/rule-system-scope.store';
import { AgreementCategoryProfileGateway } from '../gateway/agreement-category-profile.gateway';
import {
  AgreementCategoryProfileDraft,
  AgreementCategoryWithProfileModel,
  SimpleOption,
} from '../models/agreement-category-profile.model';
import { describeFailure, toHttpFailure } from '../../../shared/utils/http-failure.util';

type LoadingState = 'idle' | 'rule-systems' | 'agreements' | 'categories';

@Injectable({ providedIn: 'root' })
export class AgreementCategoryProfileStore {
  private readonly gateway = inject(AgreementCategoryProfileGateway);
  private readonly scope = inject(RuleSystemScopeStore);

  private readonly ruleSystemsState = signal<ReadonlyArray<SimpleOption>>([]);
  private readonly selectedRuleSystemCodeState = signal<string | null>(null);
  private readonly agreementsState = signal<ReadonlyArray<SimpleOption>>([]);
  private readonly selectedAgreementCodeState = signal<string | null>(null);
  private readonly grupoCotizacionOptionsState = signal<ReadonlyArray<SimpleOption>>([]);
  private readonly categoriesState = signal<ReadonlyArray<AgreementCategoryWithProfileModel>>([]);
  private readonly loadingState = signal<LoadingState>('idle');
  private readonly editingCategoryCodeState = signal<string | null>(null);
  private readonly editDraftState = signal<AgreementCategoryProfileDraft | null>(null);
  private readonly savingState = signal(false);
  private readonly errorMessageState = signal<string | null>(null);
  private readonly successMessageState = signal<string | null>(null);

  readonly selectedRuleSystemCode = this.selectedRuleSystemCodeState.asReadonly();
  readonly selectedAgreementCode = this.selectedAgreementCodeState.asReadonly();
  readonly categories = this.categoriesState.asReadonly();
  readonly loading = computed(() => this.loadingState() !== 'idle');
  readonly loadingCategories = computed(() => this.loadingState() === 'categories');
  readonly editingCategoryCode = this.editingCategoryCodeState.asReadonly();
  readonly editDraft = this.editDraftState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly errorMessage = this.errorMessageState.asReadonly();
  readonly successMessage = this.successMessageState.asReadonly();

  readonly ruleSystemOptions = computed(() =>
    this.ruleSystemsState().map((rs) => ({ value: rs.code, label: rs.name ?? rs.code })),
  );
  readonly agreementOptions = computed(() =>
    this.agreementsState().map((a) => ({
      value: a.code,
      label: a.name ? `${a.name} · ${a.code}` : a.code,
    })),
  );
  readonly grupoCotizacionSelectOptions = computed(() =>
    this.grupoCotizacionOptionsState().map((g) => ({
      value: g.code,
      label: g.name ? `${g.code} — ${g.name}` : g.code,
    })),
  );
  readonly canSave = computed(() => {
    const draft = this.editDraftState();
    return !!draft?.grupoCotizacionCode && !!draft?.tipoNomina;
  });

  initialize(): void {
    if (this.ruleSystemsState().length > 0) return;
    this.loadingState.set('rule-systems');
    // Se arranca en el ámbito, y la lista de aquí puede llegar antes que la suya (frontend#124).
    forkJoin({ items: this.gateway.loadRuleSystems(), scopeResolved: this.scope.whenResolved() })
      .pipe(take(1))
      .subscribe({
        next: ({ items }) => {
          this.ruleSystemsState.set(items);
          this.loadingState.set('idle');
          const initialCode = this.scope.initialCodeAmong(items.map((item) => item.code));
          if (this.selectedRuleSystemCodeState() === null && initialCode !== null) {
            this.selectRuleSystem(initialCode);
          }
        },
        error: (err: unknown) => {
          this.errorMessageState.set(
            describeFailure('No se pudieron cargar los sistemas de reglas', toHttpFailure(err)),
          );
          this.loadingState.set('idle');
        },
      });
  }

  selectRuleSystem(code: string): void {
    this.selectedRuleSystemCodeState.set(code);
    this.selectedAgreementCodeState.set(null);
    this.agreementsState.set([]);
    this.categoriesState.set([]);
    this.editingCategoryCodeState.set(null);
    this.clearFeedback();
    this.loadAgreements(code);
    this.loadGrupoCotizacionOptions(code);
  }

  selectAgreement(code: string): void {
    const rsc = this.selectedRuleSystemCodeState();
    if (!rsc) return;
    this.selectedAgreementCodeState.set(code);
    this.categoriesState.set([]);
    this.editingCategoryCodeState.set(null);
    this.clearFeedback();
    this.loadCategoriesWithProfiles(rsc, code);
  }

  startEdit(categoryCode: string): void {
    const category = this.categoriesState().find((c) => c.categoryCode === categoryCode);
    if (!category) return;
    this.editingCategoryCodeState.set(categoryCode);
    this.editDraftState.set({
      grupoCotizacionCode: category.grupoCotizacionCode ?? '',
      tipoNomina: (category.tipoNomina ?? 'MENSUAL') as string,
    });
    this.clearFeedback();
  }

  cancelEdit(): void {
    this.editingCategoryCodeState.set(null);
    this.editDraftState.set(null);
  }

  updateDraft(field: 'grupoCotizacionCode' | 'tipoNomina', value: string): void {
    this.editDraftState.update((d) => (d ? { ...d, [field]: value } : null));
  }

  saveEdit(): void {
    const rsc = this.selectedRuleSystemCodeState();
    const categoryCode = this.editingCategoryCodeState();
    const draft = this.editDraftState();
    if (!rsc || !categoryCode || !draft) return;

    this.savingState.set(true);
    this.clearFeedback();

    this.gateway
      .saveProfile(rsc, categoryCode, draft)
      .pipe(take(1))
      .subscribe({
        next: (saved) => {
          this.categoriesState.update((cats) =>
            cats.map((c) =>
              c.categoryCode === categoryCode
                ? {
                    ...c,
                    grupoCotizacionCode: saved.grupoCotizacionCode,
                    tipoNomina: saved.tipoNomina,
                  }
                : c,
            ),
          );
          this.editingCategoryCodeState.set(null);
          this.editDraftState.set(null);
          this.savingState.set(false);
          this.successMessageState.set('Perfil guardado correctamente.');
        },
        error: (err: HttpErrorResponse) => {
          this.savingState.set(false);
          this.errorMessageState.set(
            describeFailure('No se pudo guardar el perfil', toHttpFailure(err)),
          );
        },
      });
  }

  clearFeedback(): void {
    this.errorMessageState.set(null);
    this.successMessageState.set(null);
  }

  private loadAgreements(ruleSystemCode: string): void {
    this.loadingState.set('agreements');
    this.gateway
      .loadAgreements(ruleSystemCode)
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          this.agreementsState.set(items);
          this.loadingState.set('idle');
        },
        error: (err: unknown) => {
          this.errorMessageState.set(
            describeFailure('No se pudieron cargar los convenios', toHttpFailure(err)),
          );
          this.loadingState.set('idle');
        },
      });
  }

  private loadGrupoCotizacionOptions(ruleSystemCode: string): void {
    this.gateway
      .loadGrupoCotizacion(ruleSystemCode)
      .pipe(take(1))
      .subscribe({ next: (items) => this.grupoCotizacionOptionsState.set(items) });
  }

  private loadCategoriesWithProfiles(ruleSystemCode: string, agreementCode: string): void {
    this.loadingState.set('categories');
    this.gateway
      .loadCategoriesWithProfiles(ruleSystemCode, agreementCode)
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          this.categoriesState.set(items);
          this.loadingState.set('idle');
        },
        error: (err: unknown) => {
          this.errorMessageState.set(
            describeFailure('No se pudieron cargar las categorías', toHttpFailure(err)),
          );
          this.loadingState.set('idle');
        },
      });
  }
}
