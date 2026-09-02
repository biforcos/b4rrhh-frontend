import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { take } from 'rxjs';

import { mapEmployeeContactModelToSlotRow } from '../../data-access/employee-contact-edit.mapper';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeeContactStore } from '../../data-access/employee-contact.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { B4IconComponent } from '../../../../shared/ui/icon/b4-icon.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { SlotSectionComponent } from '../../../../shared/ui/slot-section/slot-section.component';
import { UiCatalogLabelComponent } from '../../../../shared/ui/catalog-label/ui-catalog-label.component';
import { SlotDraft, SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { SectionMode, SectionUiState } from '../../shared/ui/section/section-ui-state.model';

interface ContactRowViewModel {
  key: string;
  /** Lo que se lee: el literal del catálogo o, si no lo hay, el código. Para los `aria-label`. */
  typeLabel: string;
  /** El literal del catálogo; `null` si no llegó y el código va solo (ADR-051 §4). */
  typeName: string | null;
  typeCode: string;
  value: string;
}

function createEmptyContactDraft(): SlotDraft<string> {
  return {
    key: null,
    value: '',
  };
}

@Component({
  selector: 'app-employee-contact-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SlotSectionComponent,
    B4IconComponent,
    UiSelectComponent,
    InputTextModule,
    UiCatalogLabelComponent,
  ],
  templateUrl: './employee-contact-section.component.html',
})
export class EmployeeContactSectionComponent {
  private static readonly GLOBAL_FEEDBACK_SOURCE_KEY = 'employee-contact-section-local';

  readonly employeeKey = input<EmployeeBusinessKey | null>(null);

  private readonly contactStore = inject(EmployeeContactStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);
  private readonly globalMessageService = inject(GlobalMessageService);
  private readonly creatingState = signal(false);
  private readonly editingKeyState = signal<string | null>(null);
  private readonly deletingKeyState = signal<string | null>(null);
  private readonly localErrorMessageState = signal<string | null>(null);
  private readonly createDraftState = signal<SlotDraft<string>>(createEmptyContactDraft());
  private readonly editDraftValueState = signal('');
  private readonly availableContactTypeOptionsState = signal<ReadonlyArray<SlotKeyOption<string>>>(
    [],
  );
  private readonly catalogLoadingState = signal(false);

  private catalogRequestId = 0;

  protected readonly texts = employeeTexts;
  protected readonly rows = computed<ReadonlyArray<ContactRowViewModel>>(() =>
    this.contactStore
      .contacts()
      .map((contact) => mapEmployeeContactModelToSlotRow(contact))
      .map((row) => ({
        key: row.key,
        typeLabel: row.keyLabel,
        // El mapper deja el código en `secondaryText` solo cuando el literal lo tapa.
        typeName: row.secondaryText ? row.keyLabel : null,
        typeCode: row.key,
        value: row.value,
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  );
  protected readonly hasRows = computed(() => this.rows().length > 0);
  protected readonly creating = this.creatingState.asReadonly();
  protected readonly createDraft = this.createDraftState.asReadonly();
  protected readonly editDraftValue = this.editDraftValueState.asReadonly();
  protected readonly availableContactTypeOptions =
    this.availableContactTypeOptionsState.asReadonly();
  protected readonly catalogOptionsLoading = this.catalogLoadingState.asReadonly();
  protected readonly editingKey = this.editingKeyState.asReadonly();
  protected readonly deletingKey = this.deletingKeyState.asReadonly();
  protected readonly canSaveCreate = computed(() => {
    const draft = this.createDraftState();
    return !!draft.key && draft.value.trim().length > 0;
  });
  protected readonly canSaveEdit = computed(() => this.editDraftValueState().trim().length > 0);
  protected readonly sectionState = computed<SectionUiState>(() => {
    const isBusy = this.contactStore.loading() || this.contactStore.mutating();

    return {
      mode: isBusy ? 'submitting' : this.resolveSectionMode(),
      dirty: this.creatingState() || this.editingKeyState() !== null,
      busy: isBusy,
      errorMessage: this.resolveErrorMessage(),
      successMessage: this.resolveSuccessMessage(),
    };
  });

  constructor() {
    effect(() => {
      const activeEmployeeKey = this.employeeKey();

      untracked(() => {
        this.contactStore.loadContacts(activeEmployeeKey);
        this.loadCatalogOptions(activeEmployeeKey?.ruleSystemCode ?? null);
        this.resetInteractionState();
      });
    });

    effect((onCleanup) => {
      onCleanup(() => {
        untracked(() =>
          this.globalMessageService.clearSourceMessages(
            EmployeeContactSectionComponent.GLOBAL_FEEDBACK_SOURCE_KEY,
          ),
        );
      });
    });

    effect(() => {
      if (!this.contactStore.success()) {
        return;
      }

      untracked(() => {
        this.resetInteractionState();
      });
    });
  }

  protected startCreate(): void {
    if (!this.canStartInteraction()) {
      return;
    }

    this.clearInteractionFeedback();
    this.creatingState.set(true);
    this.editingKeyState.set(null);
    this.deletingKeyState.set(null);
    this.createDraftState.set(createEmptyContactDraft());
  }

  protected startEdit(contactTypeCode: string): void {
    if (!this.canStartInteraction()) {
      return;
    }

    const row = this.findRowByKey(contactTypeCode);
    if (!row) {
      return;
    }

    this.clearInteractionFeedback();
    this.creatingState.set(false);
    this.deletingKeyState.set(null);
    this.editingKeyState.set(row.key);
    this.editDraftValueState.set(row.value);
  }

  protected requestDelete(contactTypeCode: string): void {
    if (!this.canStartInteraction()) {
      return;
    }

    const row = this.findRowByKey(contactTypeCode);
    if (!row) {
      return;
    }

    this.clearInteractionFeedback();
    this.creatingState.set(false);
    this.editingKeyState.set(null);
    this.deletingKeyState.set(row.key);
  }

  protected confirmDelete(contactTypeCode: string): void {
    const activeEmployeeKey = this.employeeKey();
    if (!activeEmployeeKey || this.contactStore.mutating()) {
      return;
    }

    this.clearLocalError();
    this.contactStore.deleteContact(activeEmployeeKey, contactTypeCode);
  }

  protected cancelCreate(): void {
    this.clearInteractionFeedback();
    this.resetInteractionState();
  }

  protected cancelEdit(): void {
    this.clearInteractionFeedback();
    this.resetInteractionState();
  }

  protected cancelDelete(): void {
    this.clearInteractionFeedback();
    this.resetInteractionState();
  }

  protected updateCreateDraftKey(contactTypeCode: string | null): void {
    this.createDraftState.update((draft) => ({
      ...draft,
      key: contactTypeCode,
    }));
    this.clearInteractionFeedback();
  }

  protected updateCreateDraftValue(contactValue: string): void {
    this.createDraftState.update((draft) => ({
      ...draft,
      value: contactValue,
    }));
    this.clearInteractionFeedback();
  }

  protected updateEditDraftValue(contactValue: string): void {
    this.editDraftValueState.set(contactValue);
    this.clearInteractionFeedback();
  }

  protected submitCreate(): void {
    const activeEmployeeKey = this.employeeKey();
    if (!activeEmployeeKey || this.contactStore.mutating()) {
      return;
    }

    const draft = this.createDraftState();
    if (!draft.key) {
      return;
    }

    if (!draft.value.trim()) {
      return;
    }

    const isDuplicateType = this.rows().some((row) => row.key === draft.key);
    if (isDuplicateType) {
      this.publishGlobalFeedback(this.texts.contactsSectionDuplicateTypeMessage);
      return;
    }

    this.clearLocalError();
    this.contactStore.createContact(activeEmployeeKey, draft);
  }

  protected submitEdit(contactTypeCode: string): void {
    const activeEmployeeKey = this.employeeKey();
    if (!activeEmployeeKey || this.contactStore.mutating()) {
      return;
    }

    const contactValue = this.editDraftValueState().trim();
    if (!contactValue) {
      return;
    }

    this.clearLocalError();
    this.contactStore.updateContact(activeEmployeeKey, contactTypeCode, {
      key: contactTypeCode,
      value: contactValue,
    });
  }

  private canStartInteraction(): boolean {
    const activeEmployeeKey = this.employeeKey();
    if (!activeEmployeeKey) {
      return false;
    }

    return !this.contactStore.mutating();
  }

  private findRowByKey(contactTypeCode: string): ContactRowViewModel | null {
    return this.rows().find((row) => row.key === contactTypeCode) ?? null;
  }

  private resetInteractionState(): void {
    this.creatingState.set(false);
    this.editingKeyState.set(null);
    this.deletingKeyState.set(null);
    this.createDraftState.set(createEmptyContactDraft());
    this.editDraftValueState.set('');
  }

  private clearInteractionFeedback(): void {
    this.contactStore.clearFeedback();
    this.clearLocalError();
    this.clearGlobalFeedback();
  }

  private clearLocalError(): void {
    this.localErrorMessageState.set(null);
  }

  private resolveSectionMode(): SectionMode {
    if (this.creatingState()) {
      return 'creating';
    }

    if (this.editingKeyState() !== null) {
      return 'editing';
    }

    if (this.deletingKeyState() !== null) {
      return 'confirming';
    }

    return 'view';
  }

  private resolveErrorMessage(): string | null {
    return this.localErrorMessageState();
  }

  private resolveSuccessMessage(): string | null {
    const successCode = this.contactStore.success();

    if (successCode === 'created') {
      return this.texts.contactsSectionCreateSuccessMessage;
    }

    if (successCode === 'updated') {
      return this.texts.contactsSectionEditSuccessMessage;
    }

    if (successCode === 'deleted') {
      return this.texts.contactsSectionDeleteSuccessMessage;
    }

    return null;
  }

  private loadCatalogOptions(ruleSystemCode: string | null): void {
    const normalizedRuleSystemCode = ruleSystemCode?.trim() ?? '';

    if (!normalizedRuleSystemCode) {
      this.catalogRequestId += 1;
      this.catalogLoadingState.set(false);
      this.availableContactTypeOptionsState.set([]);
      this.createDraftState.update((draft) => ({ ...draft, key: null }));
      return;
    }

    const requestId = ++this.catalogRequestId;
    this.catalogLoadingState.set(true);
    this.fieldCatalogService
      .loadContactTypeOptions(normalizedRuleSystemCode)
      .pipe(take(1))
      .subscribe({
        next: (options) => {
          if (requestId !== this.catalogRequestId) {
            return;
          }

          this.catalogLoadingState.set(false);
          this.availableContactTypeOptionsState.set(options);
          this.syncDraftKeyWithAvailableOptions(options);
        },
        error: () => {
          if (requestId !== this.catalogRequestId) {
            return;
          }

          this.catalogLoadingState.set(false);
          this.publishGlobalFeedback(this.texts.catalogLoadFailedMessage);
        },
      });
  }

  private publishGlobalFeedback(message: string): void {
    this.globalMessageService.setSourceMessages(
      EmployeeContactSectionComponent.GLOBAL_FEEDBACK_SOURCE_KEY,
      [
        {
          id: 'employee-contact-section-local-error',
          level: 'error',
          text: message,
          sectionId: 'contact',
          sectionLabel: this.texts.personalAreaLabel,
          sticky: true,
        },
      ],
    );
  }

  private clearGlobalFeedback(): void {
    this.globalMessageService.clearSourceMessages(
      EmployeeContactSectionComponent.GLOBAL_FEEDBACK_SOURCE_KEY,
    );
  }

  private syncDraftKeyWithAvailableOptions(options: ReadonlyArray<SlotKeyOption<string>>): void {
    const currentDraftKey = this.createDraftState().key;
    if (!currentDraftKey) {
      return;
    }

    const hasMatchingKey = options.some((option) => option.value === currentDraftKey);
    if (hasMatchingKey) {
      return;
    }

    this.createDraftState.update((draft) => ({
      ...draft,
      key: null,
    }));
  }
}
