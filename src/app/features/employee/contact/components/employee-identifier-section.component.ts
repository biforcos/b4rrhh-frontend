import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { take } from 'rxjs';

import {
  IdentifierDraft,
  createEmptyIdentifierDraft,
  mapEmployeeIdentifierModelToSlotRow,
} from '../../data-access/employee-identifier-edit.mapper';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeeIdentifierStore } from '../../data-access/employee-identifier.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeIdentifierModel } from '../../models/employee-identifier.model';
import { isValidSpanishDni } from '../../shared/utils/spanish-dni.util';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { SectionMode, SectionUiState } from '../../shared/ui/section/section-ui-state.model';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { B4IconComponent } from '../../../../shared/ui/icon/b4-icon.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { SlotSectionComponent } from '../../../../shared/ui/slot-section/slot-section.component';

interface IdentifierRowViewModel {
  key: string;
  typeLabel: string;
  value: string;
  secondaryText: string | null;
  badges: ReadonlyArray<string>;
}

@Component({
  selector: 'app-employee-identifier-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlotSectionComponent, B4IconComponent, UiDateInputComponent, UiSelectComponent, InputTextModule],
  templateUrl: './employee-identifier-section.component.html',
})
export class EmployeeIdentifierSectionComponent {
  private static readonly GLOBAL_FEEDBACK_SOURCE_KEY = 'employee-identifier-section-local';

  readonly employeeKey = input<EmployeeBusinessKey | null>(null);

  private readonly identifierStore = inject(EmployeeIdentifierStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);
  private readonly globalMessageService = inject(GlobalMessageService);
  private readonly creatingState = signal(false);
  private readonly editingKeyState = signal<string | null>(null);
  private readonly deletingKeyState = signal<string | null>(null);
  private readonly localErrorMessageState = signal<string | null>(null);
  private readonly createDraftState = signal<IdentifierDraft>(createEmptyIdentifierDraft());
  private readonly editDraftState = signal<IdentifierDraft>(createEmptyIdentifierDraft());
  private readonly availableKeysState = signal<ReadonlyArray<SlotKeyOption<string>>>([]);
  private readonly catalogLoadingState = signal(false);

  private catalogRequestId = 0;

  protected readonly texts = employeeTexts;
  protected readonly rows = computed<ReadonlyArray<IdentifierRowViewModel>>(() =>
    this.identifierStore
      .identifiers()
      .map((identifier) =>
        mapEmployeeIdentifierModelToSlotRow(identifier, {
          primaryBadge: this.texts.identifiersSectionPrimaryBadge,
          expirationPrefix: this.texts.identifiersSectionExpirationPrefix,
        }),
      )
      .map((row) => ({
        key: row.key,
        typeLabel: row.keyLabel,
        value: row.value,
        secondaryText: row.secondaryText ?? null,
        badges: row.badges ?? [],
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  );
  protected readonly hasRows = computed(() => this.rows().length > 0);
  protected readonly creating = this.creatingState.asReadonly();
  protected readonly createDraft = this.createDraftState.asReadonly();
  protected readonly editDraft = this.editDraftState.asReadonly();
  protected readonly availableKeys = this.availableKeysState.asReadonly();
  protected readonly catalogOptionsLoading = this.catalogLoadingState.asReadonly();
  protected readonly editingKey = this.editingKeyState.asReadonly();
  protected readonly deletingKey = this.deletingKeyState.asReadonly();
  protected readonly isCreateDniInvalid = computed(() => this.isDraftDniInvalid(this.createDraftState()));
  protected readonly isEditDniInvalid = computed(() => this.isDraftDniInvalid(this.editDraftState()));
  protected readonly canSaveCreate = computed(() => {
    const draft = this.createDraftState();
    const normalizedTypeCode = this.normalizeIdentifierTypeCode(draft.key);
    return normalizedTypeCode.length > 0 && draft.value.trim().length > 0 && !this.isCreateDniInvalid();
  });
  protected readonly canSaveEdit = computed(() => {
    const draft = this.editDraftState();
    return draft.value.trim().length > 0 && !this.isEditDniInvalid();
  });
  protected readonly sectionState = computed<SectionUiState>(() => {
    const isBusy = this.identifierStore.loading() || this.identifierStore.mutating();

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
        this.identifierStore.loadIdentifiers(activeEmployeeKey);
        this.loadCatalogOptions(activeEmployeeKey?.ruleSystemCode ?? null);
        this.resetInteractionState();
      });
    });

    effect((onCleanup) => {
      onCleanup(() => {
        untracked(() => this.globalMessageService.clearSourceMessages(EmployeeIdentifierSectionComponent.GLOBAL_FEEDBACK_SOURCE_KEY));
      });
    });

    effect(() => {
      if (!this.identifierStore.success()) {
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
    this.createDraftState.set(createEmptyIdentifierDraft());
  }

  protected startEdit(identifierTypeCode: string): void {
    if (!this.canStartInteraction()) {
      return;
    }

    const sourceIdentifier = this.findIdentifierByTypeCode(identifierTypeCode);
    if (!sourceIdentifier) {
      return;
    }

    this.clearInteractionFeedback();
    this.creatingState.set(false);
    this.deletingKeyState.set(null);
    this.editingKeyState.set(sourceIdentifier.typeCode);
    this.editDraftState.set({
      key: sourceIdentifier.typeCode,
      value: sourceIdentifier.value,
      issuingCountryCode: sourceIdentifier.issuingCountryCode ?? '',
      expirationDate: sourceIdentifier.expirationDate ?? '',
      isPrimary: sourceIdentifier.isPrimary,
    });
  }

  protected requestDelete(identifierTypeCode: string): void {
    if (!this.canStartInteraction()) {
      return;
    }

    const row = this.findRowByKey(identifierTypeCode);
    if (!row) {
      return;
    }

    this.clearInteractionFeedback();
    this.creatingState.set(false);
    this.editingKeyState.set(null);
    this.deletingKeyState.set(row.key);
  }

  protected confirmDelete(identifierTypeCode: string): void {
    const activeEmployeeKey = this.employeeKey();
    if (!activeEmployeeKey || this.identifierStore.mutating()) {
      return;
    }

    this.clearLocalError();
    this.identifierStore.deleteIdentifier(activeEmployeeKey, identifierTypeCode);
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

  protected updateCreateDraftKey(identifierTypeCode: string | null): void {
    this.createDraftState.update((draft) => ({
      ...draft,
      key: identifierTypeCode,
    }));
    this.clearInteractionFeedback();
  }

  protected updateCreateDraftValue(identifierValue: string): void {
    this.createDraftState.update((draft) => ({
      ...draft,
      value: identifierValue,
    }));
    this.clearInteractionFeedback();
  }

  protected updateCreateDraftIssuingCountryCode(issuingCountryCode: string): void {
    this.createDraftState.update((draft) => ({
      ...draft,
      issuingCountryCode,
    }));
    this.clearInteractionFeedback();
  }

  protected updateCreateDraftExpirationDate(expirationDate: string): void {
    this.createDraftState.update((draft) => ({
      ...draft,
      expirationDate,
    }));
    this.clearInteractionFeedback();
  }

  protected updateCreateDraftIsPrimary(isPrimary: boolean): void {
    this.createDraftState.update((draft) => ({
      ...draft,
      isPrimary,
    }));
    this.clearInteractionFeedback();
  }

  protected updateEditDraftValue(identifierValue: string): void {
    this.editDraftState.update((draft) => ({
      ...draft,
      value: identifierValue,
    }));
    this.clearInteractionFeedback();
  }

  protected updateEditDraftIssuingCountryCode(issuingCountryCode: string): void {
    this.editDraftState.update((draft) => ({
      ...draft,
      issuingCountryCode,
    }));
    this.clearInteractionFeedback();
  }

  protected updateEditDraftExpirationDate(expirationDate: string): void {
    this.editDraftState.update((draft) => ({
      ...draft,
      expirationDate,
    }));
    this.clearInteractionFeedback();
  }

  protected updateEditDraftIsPrimary(isPrimary: boolean): void {
    this.editDraftState.update((draft) => ({
      ...draft,
      isPrimary,
    }));
    this.clearInteractionFeedback();
  }

  protected submitCreate(): void {
    const activeEmployeeKey = this.employeeKey();
    if (!activeEmployeeKey || this.identifierStore.mutating()) {
      return;
    }

    const draft = this.createDraftState();
    const normalizedTypeCode = this.normalizeIdentifierTypeCode(draft.key);
    if (!normalizedTypeCode) {
      return;
    }

    const isDuplicateType = this.rows().some((row) => row.key === normalizedTypeCode);
    if (isDuplicateType) {
      this.publishGlobalFeedback(this.texts.identifiersSectionDuplicateTypeMessage);
      return;
    }

    if (!this.validateDraftDniForCurrentContext(draft)) {
      return;
    }

    this.clearLocalError();
    this.identifierStore.createIdentifier(activeEmployeeKey, {
      ...draft,
      key: normalizedTypeCode,
    });
  }

  protected submitEdit(identifierTypeCode: string): void {
    const activeEmployeeKey = this.employeeKey();
    if (!activeEmployeeKey || this.identifierStore.mutating()) {
      return;
    }

    const normalizedTypeCode = this.normalizeIdentifierTypeCode(identifierTypeCode);
    if (!normalizedTypeCode) {
      return;
    }

    const sourceIdentifier = this.findIdentifierByTypeCode(normalizedTypeCode);
    if (!sourceIdentifier) {
      return;
    }

    const draft = {
      ...this.editDraftState(),
      key: normalizedTypeCode,
    };

    if (!this.validateDraftDniForCurrentContext(draft)) {
      return;
    }

    this.clearLocalError();
    this.identifierStore.updateIdentifier(activeEmployeeKey, normalizedTypeCode, draft);
  }

  private canStartInteraction(): boolean {
    const activeEmployeeKey = this.employeeKey();
    if (!activeEmployeeKey) {
      return false;
    }

    return !this.identifierStore.mutating();
  }

  private findRowByKey(identifierTypeCode: string): IdentifierRowViewModel | null {
    const normalizedTypeCode = this.normalizeIdentifierTypeCode(identifierTypeCode);
    return this.rows().find((row) => row.key === normalizedTypeCode) ?? null;
  }

  private findIdentifierByTypeCode(identifierTypeCode: string): EmployeeIdentifierModel | null {
    const normalizedTypeCode = this.normalizeIdentifierTypeCode(identifierTypeCode);
    return this.identifierStore.identifiers().find((identifier) => identifier.typeCode === normalizedTypeCode) ?? null;
  }

  private normalizeIdentifierTypeCode(identifierTypeCode: string | null): string {
    return identifierTypeCode?.trim().toUpperCase() ?? '';
  }

  private validateDraftDniForCurrentContext(draft: IdentifierDraft): boolean {
    if (!this.isDniValidationApplicable(draft)) {
      return true;
    }

    if (isValidSpanishDni(draft.value)) {
      return true;
    }

    this.localErrorMessageState.set(this.texts.identifiersSectionInvalidDniMessage);
    return false;
  }

  private isDniValidationApplicable(draft: IdentifierDraft): boolean {
    const identifierTypeCode = this.normalizeIdentifierTypeCode(draft.key);
    const issuingCountryCode = (draft.issuingCountryCode ?? '').trim().toUpperCase();

    return identifierTypeCode === 'NATIONAL_ID' && issuingCountryCode === 'ESP';
  }

  private isDraftDniInvalid(draft: IdentifierDraft): boolean {
    if (!this.isDniValidationApplicable(draft)) {
      return false;
    }

    const normalizedValue = draft.value.trim();
    if (normalizedValue.length === 0) {
      return false;
    }

    return !isValidSpanishDni(normalizedValue);
  }

  private resetInteractionState(): void {
    this.creatingState.set(false);
    this.editingKeyState.set(null);
    this.deletingKeyState.set(null);
    this.createDraftState.set(createEmptyIdentifierDraft());
    this.editDraftState.set(createEmptyIdentifierDraft());
  }

  private clearInteractionFeedback(): void {
    this.identifierStore.clearFeedback();
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
    const successCode = this.identifierStore.success();

    if (successCode === 'created') {
      return this.texts.identifiersSectionCreateSuccessMessage;
    }

    if (successCode === 'updated') {
      return this.texts.identifiersSectionEditSuccessMessage;
    }

    if (successCode === 'deleted') {
      return this.texts.identifiersSectionDeleteSuccessMessage;
    }

    return null;
  }

  private loadCatalogOptions(ruleSystemCode: string | null): void {
    const normalizedRuleSystemCode = ruleSystemCode?.trim() ?? '';

    if (!normalizedRuleSystemCode) {
      this.catalogRequestId += 1;
      this.catalogLoadingState.set(false);
      this.availableKeysState.set([]);
      this.createDraftState.update((draft) => ({
        ...draft,
        key: null,
      }));
      return;
    }

    const requestId = ++this.catalogRequestId;
    this.catalogLoadingState.set(true);
    this.fieldCatalogService
      .loadIdentifierTypeOptions(normalizedRuleSystemCode)
      .pipe(take(1))
      .subscribe({
        next: (options) => {
          if (requestId !== this.catalogRequestId) {
            return;
          }

          this.catalogLoadingState.set(false);
          this.availableKeysState.set(options);
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
    this.globalMessageService.setSourceMessages(EmployeeIdentifierSectionComponent.GLOBAL_FEEDBACK_SOURCE_KEY, [
      {
        id: 'employee-identifier-section-local-error',
        level: 'error',
        text: message,
        sectionId: 'contact',
        sectionLabel: this.texts.personalAreaLabel,
        sticky: true,
      },
    ]);
  }

  private clearGlobalFeedback(): void {
    this.globalMessageService.clearSourceMessages(EmployeeIdentifierSectionComponent.GLOBAL_FEEDBACK_SOURCE_KEY);
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
