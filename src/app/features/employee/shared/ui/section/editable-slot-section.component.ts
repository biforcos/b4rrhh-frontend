import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
  output,
} from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';

import { UiButtonComponent } from '../../../../../shared/ui/button/ui-button.component';
import { UiSelectComponent } from '../../../../../shared/ui/select/ui-select.component';
import { UiTagComponent } from '../../../../../shared/ui/tag/ui-tag.component';
import { EmployeeSectionShellComponent } from './employee-section-shell.component';
import {
  SlotDraft,
  SlotDisplayMode,
  SlotEditSubmission,
  SlotKeyOption,
  SlotRowViewModel,
  SlotSectionTexts,
} from './editable-slot-section.model';
import { SectionUiState } from './section-ui-state.model';

const emptyTexts: SlotSectionTexts = {
  manageAction: 'Manage',
  exitManageAction: 'Done',
  addAction: 'Add',
  editAction: 'Edit',
  deleteAction: 'Delete',
  cancelAction: 'Cancel',
  saveCreateAction: 'Save',
  saveEditAction: 'Save',
  confirmDeleteMessage: 'Confirm delete',
  confirmDeleteAction: 'Confirm',
  emptyMessage: 'No rows',
  keyFieldLabel: 'Key',
  valueFieldLabel: 'Value',
};

const emptyDraft: SlotDraft<string> = {
  key: null,
  value: '',
};

@Component({
  selector: 'app-editable-slot-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmployeeSectionShellComponent,
    UiButtonComponent,
    UiTagComponent,
    UiSelectComponent,
    InputTextModule,
    NgTemplateOutlet,
  ],
  templateUrl: './editable-slot-section.component.html',
  styleUrl: './editable-slot-section.component.scss',
})
export class EditableSlotSectionComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly state = input.required<SectionUiState>();
  readonly displayMode = input<SlotDisplayMode>('view');
  readonly rows = input<ReadonlyArray<SlotRowViewModel<string>>>([]);
  readonly texts = input<SlotSectionTexts>(emptyTexts);
  readonly draft = input<SlotDraft<string>>(emptyDraft);
  readonly editingKey = input<string | null>(null);
  readonly deletingKey = input<string | null>(null);
  readonly availableKeys = input<ReadonlyArray<SlotKeyOption<string>>>([]);
  readonly canCreate = input(false);
  readonly canEdit = input(false);
  readonly canDelete = input(false);
  readonly createSubmitEnabled = input<boolean | null>(null);
  readonly editSubmitEnabled = input<boolean | null>(null);

  readonly manageStarted = output<void>();
  readonly manageExited = output<void>();
  readonly createStarted = output<void>();
  readonly editStarted = output<string>();
  readonly deleteRequested = output<string>();
  readonly deleteConfirmed = output<string>();
  readonly cancelled = output<void>();
  readonly draftKeyChanged = output<string | null>();
  readonly draftValueChanged = output<string>();
  readonly createSubmitted = output<SlotDraft<string>>();
  readonly editSubmitted = output<SlotEditSubmission<string>>();

  protected readonly customCreateFormTemplate =
    contentChild<TemplateRef<unknown>>('slotCreateForm');
  protected readonly customEditFormTemplate = contentChild<TemplateRef<unknown>>('slotEditForm');

  protected readonly isViewMode = computed(() => this.displayMode() === 'view');
  protected readonly isManageMode = computed(() => this.displayMode() === 'manage');
  protected readonly isCreating = computed(() => this.displayMode() === 'creating');
  protected readonly isEditing = computed(
    () => this.displayMode() === 'editing' && this.editingKey() !== null,
  );
  protected readonly isConfirmingDelete = computed(
    () => this.displayMode() === 'confirmingDelete' && this.deletingKey() !== null,
  );
  protected readonly hasRows = computed(() => this.rows().length > 0);
  protected readonly showEmpty = computed(() => !this.hasRows() && !this.isCreating());
  protected readonly canUseKeySelect = computed(() => this.availableKeys().length > 0);
  protected readonly canManage = computed(
    () => this.canCreate() || this.canEdit() || this.canDelete(),
  );
  protected readonly showManageAction = computed(
    () => this.isViewMode() && this.canManage() && !this.state().busy,
  );
  protected readonly showAddAction = computed(
    () => this.canCreate() && this.isManageMode() && !this.state().busy,
  );
  protected readonly showExitManageAction = computed(
    () => this.isManageMode() && !this.state().busy,
  );
  protected readonly showRowMaintenanceActions = computed(
    () => this.isManageMode() && !this.state().busy,
  );
  protected readonly isDraftValid = computed(() => {
    const draft = this.draft();
    const hasValidKey = this.normalizeKey(draft.key) !== null;
    const hasValidValue = this.normalizeValue(draft.value).length > 0;
    return hasValidKey && hasValidValue;
  });
  protected readonly isEditDraftValid = computed(
    () => this.normalizeValue(this.draft().value).length > 0,
  );
  protected readonly hasCustomCreateForm = computed(
    () => this.customCreateFormTemplate() !== undefined,
  );
  protected readonly hasCustomEditForm = computed(
    () => this.customEditFormTemplate() !== undefined,
  );
  protected readonly resolvedCreateSubmitEnabled = computed(
    () => this.createSubmitEnabled() ?? this.isDraftValid(),
  );
  protected readonly resolvedEditSubmitEnabled = computed(
    () => this.editSubmitEnabled() ?? this.isEditDraftValid(),
  );

  protected trackRowByKey(_index: number, row: SlotRowViewModel<string>): string {
    return row.key;
  }

  protected isRowEditing(row: SlotRowViewModel<string>): boolean {
    return this.isEditing() && this.editingKey() === row.key;
  }

  protected isRowDeleteConfirming(row: SlotRowViewModel<string>): boolean {
    return this.isConfirmingDelete() && this.deletingKey() === row.key;
  }

  protected isRowReadonly(row: SlotRowViewModel<string>): boolean {
    return row.isReadonly === true;
  }

  protected onCreateStarted(): void {
    this.createStarted.emit();
  }

  protected onManageStarted(): void {
    this.manageStarted.emit();
  }

  protected onManageExited(): void {
    this.manageExited.emit();
  }

  protected onEditStarted(rowKey: string): void {
    this.editStarted.emit(rowKey);
  }

  protected onDeleteRequested(rowKey: string): void {
    this.deleteRequested.emit(rowKey);
  }

  protected onDeleteConfirmed(rowKey: string): void {
    this.deleteConfirmed.emit(rowKey);
  }

  protected onCancelled(): void {
    this.cancelled.emit();
  }

  protected onDraftValueInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.draftValueChanged.emit(target.value);
  }

  protected onDraftKeyInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.draftKeyChanged.emit(this.normalizeKey(target.value));
  }

  protected onDraftKeySelect(value: string): void {
    this.draftKeyChanged.emit(this.normalizeKey(value));
  }

  protected onCreateSubmitted(): void {
    if (!this.resolvedCreateSubmitEnabled() || this.state().busy) {
      return;
    }

    this.createSubmitted.emit({
      key: this.normalizeKey(this.draft().key)!,
      value: this.normalizeValue(this.draft().value),
    });
  }

  protected onEditSubmitted(rowKey: string): void {
    if (!this.resolvedEditSubmitEnabled() || this.state().busy) {
      return;
    }

    this.editSubmitted.emit({
      key: rowKey,
      value: this.normalizeValue(this.draft().value),
    });
  }

  private normalizeKey(value: string | null): string | null {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeValue(value: string): string {
    return value.trim();
  }
}
