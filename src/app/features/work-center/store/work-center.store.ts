import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { WorkCenterGateway } from '../gateway/work-center.gateway';
import { EditableWorkCenterDraftModel } from '../models/editable-work-center-draft.model';
import { WorkCenterContactFormValue } from '../models/work-center-contact-form-value.model';
import { WorkCenterContactModel } from '../models/work-center-contact.model';
import { WorkCenterDetailModel } from '../models/work-center-detail.model';
import { WorkCenterFormValue } from '../models/work-center-form-value.model';
import { WorkCenterListItemModel } from '../models/work-center-list-item.model';
import { WorkCenterBusinessKey, WorkCenterUiMode } from '../models/work-center-ui-state.model';

export type WorkCenterErrorCode =
  | 'request-failed'
  | 'not-found'
  | 'already-exists'
  | 'not-applicable';

@Injectable({
  providedIn: 'root',
})
export class WorkCenterStore {
  private readonly gateway = inject(WorkCenterGateway);

  private readonly listState = signal<ReadonlyArray<WorkCenterListItemModel>>([]);
  private readonly listLoadingState = signal(false);
  private readonly listErrorState = signal<WorkCenterErrorCode | null>(null);

  private readonly selectedKeyState = signal<WorkCenterBusinessKey | null>(null);
  private readonly selectedDetailState = signal<WorkCenterDetailModel | null>(null);
  private readonly detailLoadingState = signal(false);
  private readonly detailErrorState = signal<WorkCenterErrorCode | null>(null);
  private readonly draftState = signal<EditableWorkCenterDraftModel | null>(null);

  private readonly contactsState = signal<ReadonlyArray<WorkCenterContactModel>>([]);
  private readonly contactsLoadingState = signal(false);
  private readonly contactsErrorState = signal<string | null>(null);

  private readonly modeState = signal<WorkCenterUiMode>('idle');
  private readonly submittingState = signal(false);
  private readonly submitErrorState = signal<string | null>(null);
  private readonly submitSuccessState = signal<'created' | 'updated' | null>(null);

  private readonly contactSubmittingState = signal(false);
  private readonly contactSubmitErrorState = signal<string | null>(null);
  private readonly contactSubmitSuccessState = signal<'created' | 'updated' | 'deleted' | null>(
    null,
  );

  readonly workCenters = this.listState.asReadonly();
  readonly listLoading = this.listLoadingState.asReadonly();
  readonly listError = this.listErrorState.asReadonly();
  readonly selectedKey = this.selectedKeyState.asReadonly();
  readonly selectedDetail = this.selectedDetailState.asReadonly();
  readonly detailLoading = this.detailLoadingState.asReadonly();
  readonly detailError = this.detailErrorState.asReadonly();
  readonly draft = this.draftState.asReadonly();
  readonly contacts = this.contactsState.asReadonly();
  readonly contactsLoading = this.contactsLoadingState.asReadonly();
  readonly contactsError = this.contactsErrorState.asReadonly();
  readonly mode = this.modeState.asReadonly();
  readonly submitting = this.submittingState.asReadonly();
  readonly submitError = this.submitErrorState.asReadonly();
  readonly submitSuccess = this.submitSuccessState.asReadonly();
  readonly contactSubmitting = this.contactSubmittingState.asReadonly();
  readonly contactSubmitError = this.contactSubmitErrorState.asReadonly();
  readonly contactSubmitSuccess = this.contactSubmitSuccessState.asReadonly();

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
      .listWorkCenters()
      .pipe(take(1))
      .subscribe({
        next: (workCenters) => {
          this.listState.set(workCenters);
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
    this.contactsState.set([]);
    this.contactsErrorState.set(null);
    this.draftState.set({ mode: 'create', key: null });
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);
    this.contactSubmitErrorState.set(null);
    this.contactSubmitSuccessState.set(null);
    this.modeState.set('creating');
  }

  selectWorkCenter(key: WorkCenterBusinessKey): void {
    this.selectedKeyState.set(key);
    this.draftState.set(null);
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);
    this.contactSubmitErrorState.set(null);
    this.contactSubmitSuccessState.set(null);
    this.modeState.set('viewing');
    this.loadDetail(key);
    this.loadContacts(key);
  }

  startEdit(key: WorkCenterBusinessKey): void {
    this.selectedKeyState.set(key);
    this.draftState.set({ mode: 'edit', key });
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);
    this.modeState.set('editing');
    if (!this.selectedDetailState()) {
      this.loadDetail(key);
    }
    if (this.contactsState().length === 0) {
      this.loadContacts(key);
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
      this.loadContacts(currentDraft.key);
      return;
    }

    this.draftState.set(null);
    this.selectedKeyState.set(null);
    this.selectedDetailState.set(null);
    this.contactsState.set([]);
    this.detailErrorState.set(null);
    this.contactsErrorState.set(null);
    this.modeState.set('idle');
  }

  submitCreate(formValue: WorkCenterFormValue): void {
    if (this.submittingState()) {
      return;
    }

    this.submittingState.set(true);
    this.modeState.set('submitting');
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);

    this.gateway
      .createWorkCenter(formValue)
      .pipe(take(1))
      .subscribe({
        next: (created) => {
          const key = {
            ruleSystemCode: created.ruleSystemCode,
            workCenterCode: created.workCenterCode,
          };
          this.submittingState.set(false);
          this.submitSuccessState.set('created');
          this.modeState.set('viewing');
          this.selectedKeyState.set(key);
          this.selectedDetailState.set(created);
          this.draftState.set(null);
          this.loadList();
          this.loadDetail(key);
          this.loadContacts(key);
        },
        error: (err: HttpErrorResponse) => {
          this.submittingState.set(false);
          this.modeState.set('creating');
          this.submitErrorState.set(this.mapSubmitError(err));
        },
      });
  }

  submitUpdate(key: WorkCenterBusinessKey, formValue: WorkCenterFormValue): void {
    if (this.submittingState()) {
      return;
    }

    this.submittingState.set(true);
    this.modeState.set('submitting');
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);

    this.gateway
      .updateWorkCenter(key, formValue)
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
          this.loadContacts(key);
        },
        error: (err: HttpErrorResponse) => {
          this.submittingState.set(false);
          this.modeState.set('editing');
          this.submitErrorState.set(this.mapSubmitError(err));
        },
      });
  }

  submitCreateContact(formValue: WorkCenterContactFormValue): void {
    const key = this.selectedKeyState();
    if (!key || this.contactSubmittingState()) {
      return;
    }

    this.contactSubmittingState.set(true);
    this.contactSubmitErrorState.set(null);
    this.contactSubmitSuccessState.set(null);

    this.gateway
      .createContact(key, formValue)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.contactSubmittingState.set(false);
          this.contactSubmitSuccessState.set('created');
          this.loadContacts(key);
        },
        error: (err: HttpErrorResponse) => {
          this.contactSubmittingState.set(false);
          this.contactSubmitErrorState.set(this.mapContactSubmitError(err));
        },
      });
  }

  submitUpdateContact(contactNumber: number, formValue: WorkCenterContactFormValue): void {
    const key = this.selectedKeyState();
    if (!key || this.contactSubmittingState()) {
      return;
    }

    this.contactSubmittingState.set(true);
    this.contactSubmitErrorState.set(null);
    this.contactSubmitSuccessState.set(null);

    this.gateway
      .updateContact(key, contactNumber, formValue)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.contactSubmittingState.set(false);
          this.contactSubmitSuccessState.set('updated');
          this.loadContacts(key);
        },
        error: (err: HttpErrorResponse) => {
          this.contactSubmittingState.set(false);
          this.contactSubmitErrorState.set(this.mapContactSubmitError(err));
        },
      });
  }

  deleteContact(contactNumber: number): void {
    const key = this.selectedKeyState();
    if (!key || this.contactSubmittingState()) {
      return;
    }

    this.contactSubmittingState.set(true);
    this.contactSubmitErrorState.set(null);
    this.contactSubmitSuccessState.set(null);

    this.gateway
      .deleteContact(key, contactNumber)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.contactSubmittingState.set(false);
          this.contactSubmitSuccessState.set('deleted');
          this.loadContacts(key);
        },
        error: (err: HttpErrorResponse) => {
          this.contactSubmittingState.set(false);
          this.contactSubmitErrorState.set(this.mapContactSubmitError(err));
        },
      });
  }

  clearFeedback(): void {
    this.submitErrorState.set(null);
    this.submitSuccessState.set(null);
    this.contactSubmitErrorState.set(null);
    this.contactSubmitSuccessState.set(null);
  }

  private loadDetail(key: WorkCenterBusinessKey): void {
    this.detailLoadingState.set(true);
    this.detailErrorState.set(null);
    this.selectedDetailState.set(null);

    this.gateway
      .getWorkCenter(key)
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

  private loadContacts(key: WorkCenterBusinessKey): void {
    this.contactsLoadingState.set(true);
    this.contactsErrorState.set(null);
    this.contactsState.set([]);

    this.gateway
      .listContacts(key)
      .pipe(take(1))
      .subscribe({
        next: (contacts) => {
          this.contactsState.set(contacts);
          this.contactsLoadingState.set(false);
        },
        error: () => {
          this.contactsLoadingState.set(false);
          this.contactsErrorState.set('request-failed');
        },
      });
  }

  private mapSubmitError(err: HttpErrorResponse): string {
    if (err.status === 409) {
      const message: string | undefined = err.error?.message;
      if (message?.toLowerCase().includes('applicable')) {
        return 'El centro existe pero no está vigente hoy. No se puede editar.';
      }
      return 'Ya existe un centro con ese código. Usa un código diferente.';
    }
    if (err.status === 404) {
      return 'No se encontró el centro seleccionado.';
    }
    if (err.status === 400) {
      return err.error?.message ?? 'Los datos enviados no son válidos.';
    }
    return 'No se pudo guardar el centro. Inténtalo de nuevo.';
  }

  private mapContactSubmitError(err: HttpErrorResponse): string {
    if (err.status === 404) {
      return 'No se encontró el centro o el contacto.';
    }
    if (err.status === 400) {
      return err.error?.message ?? 'Los datos del contacto no son válidos.';
    }
    if (err.status === 409) {
      return 'Existe un conflicto funcional al gestionar el contacto.';
    }
    return 'No se pudo guardar el contacto. Inténtalo de nuevo.';
  }
}
