import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { CompanyGateway } from '../gateway/company.gateway';
import { CompanyDetailModel } from '../models/company-detail.model';
import { CompanyListItemModel } from '../models/company-list-item.model';
import { EditableCompanyDraftModel } from '../models/editable-company-draft.model';
import { CompanyFormValue } from '../models/company-form-value.model';
import { CompanyBusinessKey, CompanyUiMode } from '../models/company-ui-state.model';

export type CompanyErrorCode = 'request-failed' | 'not-found' | 'already-exists' | 'not-applicable';

@Injectable({
  providedIn: 'root',
})
export class CompanyStore {
  private readonly gateway = inject(CompanyGateway);

  private readonly listState = signal<ReadonlyArray<CompanyListItemModel>>([]);
  private readonly listLoadingState = signal(false);
  private readonly listErrorState = signal<CompanyErrorCode | null>(null);

  private readonly selectedKeyState = signal<CompanyBusinessKey | null>(null);
  private readonly selectedDetailState = signal<CompanyDetailModel | null>(null);
  private readonly detailLoadingState = signal(false);
  private readonly detailErrorState = signal<CompanyErrorCode | null>(null);
  private readonly draftState = signal<EditableCompanyDraftModel | null>(null);

  private readonly modeState = signal<CompanyUiMode>('idle');
  private readonly submittingState = signal(false);
  private readonly submitErrorState = signal<string | null>(null);
  private readonly submitSuccessState = signal<'created' | 'updated' | null>(null);

  // Public readonly signals
  readonly companies = this.listState.asReadonly();
  readonly listLoading = this.listLoadingState.asReadonly();
  readonly listError = this.listErrorState.asReadonly();

  readonly selectedKey = this.selectedKeyState.asReadonly();
  readonly selectedDetail = this.selectedDetailState.asReadonly();
  readonly detailLoading = this.detailLoadingState.asReadonly();
  readonly detailError = this.detailErrorState.asReadonly();
  readonly draft = this.draftState.asReadonly();

  readonly mode = this.modeState.asReadonly();
  readonly submitting = this.submittingState.asReadonly();
  readonly submitError = this.submitErrorState.asReadonly();
  readonly submitSuccess = this.submitSuccessState.asReadonly();

  readonly isCreating = computed(() => this.draftState()?.mode === 'create');
  readonly isEditing = computed(() => this.draftState()?.mode === 'edit');
  readonly isViewing = computed(
    () => this.selectedKeyState() !== null && this.draftState() === null,
  );
  readonly hasActiveForm = computed(() => this.draftState() !== null);
  readonly hasActiveDetail = computed(
    () => this.selectedKeyState() !== null || this.draftState() !== null,
  );

  constructor() {
    this.loadList();
  }

  loadList(): void {
    this.listLoadingState.set(true);
    this.listErrorState.set(null);

    this.gateway
      .listCompanies()
      .pipe(take(1))
      .subscribe({
        next: (companies) => {
          this.listState.set(companies);
          this.listLoadingState.set(false);
        },
        error: () => {
          this.listLoadingState.set(false);
          this.listErrorState.set('request-failed');
        },
      });
  }

  startCreate(): void {
    this.selectedKeyState.set(null);
    this.selectedDetailState.set(null);
    this.detailErrorState.set(null);
    this.draftState.set({ mode: 'create', key: null });
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);
    this.modeState.set('creating');
  }

  selectCompany(key: CompanyBusinessKey): void {
    this.selectedKeyState.set(key);
    this.draftState.set(null);
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);
    this.modeState.set('viewing');

    this.loadDetail(key);
  }

  startEdit(key: CompanyBusinessKey): void {
    this.selectedKeyState.set(key);
    this.draftState.set({ mode: 'edit', key });
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);
    this.modeState.set('editing');

    if (!this.selectedDetailState()) {
      this.loadDetail(key);
    }
  }

  cancelForm(): void {
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);

    const currentDraft = this.draftState();
    if (currentDraft?.mode === 'edit' && currentDraft.key) {
      this.draftState.set(null);
      this.modeState.set('viewing');
      this.loadDetail(currentDraft.key);
      return;
    }

    this.draftState.set(null);
    this.selectedKeyState.set(null);
    this.selectedDetailState.set(null);
    this.detailErrorState.set(null);
    this.modeState.set('idle');
  }

  submitCreate(formValue: CompanyFormValue): void {
    if (this.submittingState()) {
      return;
    }

    this.submittingState.set(true);
    this.modeState.set('submitting');
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);

    this.gateway
      .createCompany(formValue)
      .pipe(take(1))
      .subscribe({
        next: (created) => {
          this.submittingState.set(false);
          this.submitSuccessState.set('created');
          this.modeState.set('viewing');
          const key = { ruleSystemCode: created.ruleSystemCode, companyCode: created.companyCode };
          this.selectedKeyState.set(key);
          this.selectedDetailState.set(created);
          this.draftState.set(null);
          this.loadList();
          this.loadDetail(key);
        },
        error: (err: HttpErrorResponse) => {
          this.submittingState.set(false);
          this.modeState.set('creating');
          this.submitErrorState.set(this.mapSubmitError(err));
        },
      });
  }

  submitUpdate(key: CompanyBusinessKey, formValue: CompanyFormValue): void {
    if (this.submittingState()) {
      return;
    }

    this.submittingState.set(true);
    this.modeState.set('submitting');
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);

    this.gateway
      .updateCompany(key, formValue)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.submittingState.set(false);
          this.submitSuccessState.set('updated');
          this.modeState.set('viewing');
          this.selectedDetailState.set(updated);
          this.draftState.set(null);
          this.loadList();
          this.loadDetail(key);
        },
        error: (err: HttpErrorResponse) => {
          this.submittingState.set(false);
          this.modeState.set('editing');
          this.submitErrorState.set(this.mapSubmitError(err));
        },
      });
  }

  clearFeedback(): void {
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);
  }

  private loadDetail(key: CompanyBusinessKey): void {
    this.detailLoadingState.set(true);
    this.detailErrorState.set(null);
    this.selectedDetailState.set(null);

    this.gateway
      .getCompany(key)
      .pipe(take(1))
      .subscribe({
        next: (detail) => {
          this.selectedDetailState.set(detail);
          this.detailLoadingState.set(false);
          if (this.draftState() === null) {
            this.modeState.set('viewing');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.detailLoadingState.set(false);
          this.modeState.set(err.status === 404 ? 'error' : this.modeState());
          this.detailErrorState.set(err.status === 404 ? 'not-found' : 'request-failed');
        },
      });
  }

  private mapSubmitError(err: HttpErrorResponse): string {
    if (err.status === 409) {
      const message: string | undefined = err.error?.message;
      if (message?.toLowerCase().includes('applicable')) {
        return 'La empresa existe pero no está vigente hoy. No se puede editar.';
      }
      return 'Ya existe una empresa con ese código. Usa un código diferente.';
    }
    if (err.status === 404) {
      return 'No se encontró la empresa. Es posible que haya sido eliminada.';
    }
    if (err.status === 400) {
      const message: string | undefined = err.error?.message;
      return message ?? 'Los datos enviados no son válidos. Revisa el formulario.';
    }
    return 'No se pudo guardar la empresa. Inténtalo de nuevo.';
  }
}
