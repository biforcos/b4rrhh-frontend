import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { employeeTexts } from '../../../employee.texts';
import {
  SlotDraft,
  SlotDisplayMode,
  SlotEditSubmission,
  SlotKeyOption,
  SlotRowViewModel,
  SlotSectionTexts,
} from './editable-slot-section.model';
import { EditableSlotSectionComponent } from './editable-slot-section.component';
import { SectionActionContract, SectionUiState } from './section-ui-state.model';

const slotKeyOptions: ReadonlyArray<SlotKeyOption<string>> = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'MOBILE', label: 'Movil' },
  { value: 'PHONE', label: 'Teléfono' },
];

const initialRows: ReadonlyArray<SlotRowViewModel<string>> = [
  {
    key: 'EMAIL',
    keyLabel: 'Email',
    value: 'john@example.com',
  },
  {
    key: 'MOBILE',
    keyLabel: 'Movil',
    value: '600123123',
  },
];

const initialUiState: SectionUiState = {
  mode: 'view',
  dirty: false,
  busy: false,
  errorMessage: null,
  successMessage: null,
};

const initialDraft: SlotDraft<string> = {
  key: null,
  value: '',
};

@Component({
  selector: 'app-editable-slot-section-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditableSlotSectionComponent],
  template: `
    <app-editable-slot-section
      [title]="texts.slotDemoTitle"
      [subtitle]="texts.slotDemoSubtitle"
      [state]="uiState()"
      [displayMode]="displayMode()"
      [rows]="rows()"
      [texts]="slotTexts"
      [draft]="draft()"
      [editingKey]="editingKey()"
      [deletingKey]="deletingKey()"
      [availableKeys]="availableKeys()"
      [canCreate]="true"
      [canEdit]="true"
      [canDelete]="true"
      (manageStarted)="startManage()"
      (manageExited)="exitManage()"
      (createStarted)="startCreate()"
      (editStarted)="startEdit($event)"
      (deleteRequested)="requestDelete($event)"
      (deleteConfirmed)="confirmDeleteByKey($event)"
      (cancelled)="cancel()"
      (draftKeyChanged)="onDraftKeyChanged($event)"
      (draftValueChanged)="onDraftValueChanged($event)"
      (createSubmitted)="onCreateSubmitted($event)"
      (editSubmitted)="onEditSubmitted($event)"
    ></app-editable-slot-section>
  `,
})
export class EditableSlotSectionDemoComponent implements SectionActionContract<string> {
  protected readonly texts = employeeTexts;
  protected readonly slotTexts: SlotSectionTexts = {
    manageAction: employeeTexts.slotManageAction,
    exitManageAction: employeeTexts.slotExitManageAction,
    addAction: employeeTexts.slotAddAction,
    editAction: employeeTexts.slotEditAction,
    deleteAction: employeeTexts.slotDeleteAction,
    cancelAction: employeeTexts.slotCancelAction,
    saveCreateAction: employeeTexts.slotSaveCreateAction,
    saveEditAction: employeeTexts.slotSaveEditAction,
    confirmDeleteMessage: employeeTexts.slotConfirmDeleteMessage,
    confirmDeleteAction: employeeTexts.slotConfirmDeleteAction,
    emptyMessage: employeeTexts.slotEmptyMessage,
    keyFieldLabel: employeeTexts.slotKeyFieldLabel,
    valueFieldLabel: employeeTexts.slotValueFieldLabel,
  };
  protected readonly rows = signal<ReadonlyArray<SlotRowViewModel<string>>>(initialRows);
  protected readonly uiState = signal<SectionUiState>(initialUiState);
  protected readonly manageModeActive = signal(false);
  protected readonly draft = signal<SlotDraft<string>>(initialDraft);
  protected readonly editingKey = signal<string | null>(null);
  protected readonly deletingKey = signal<string | null>(null);
  protected readonly displayMode = computed<SlotDisplayMode>(() => {
    const mode = this.uiState().mode;

    if (mode === 'creating') {
      return 'creating';
    }

    if (mode === 'editing') {
      return 'editing';
    }

    if (mode === 'confirming') {
      return 'confirmingDelete';
    }

    return this.manageModeActive() ? 'manage' : 'view';
  });
  protected readonly availableKeys = computed(() => {
    const usedKeys = new Set(this.rows().map((row) => row.key));
    return slotKeyOptions.filter((option) => !usedKeys.has(option.value));
  });

  startManage(): void {
    this.manageModeActive.set(true);
    this.uiState.update((state) => ({
      ...state,
      mode: 'view',
      dirty: false,
      errorMessage: null,
      successMessage: null,
    }));
  }

  exitManage(): void {
    this.manageModeActive.set(false);
    this.cancel();
  }

  startCreate(): void {
    if (this.uiState().mode !== 'view' || !this.manageModeActive()) {
      return;
    }

    this.draft.set({
      key: null,
      value: '',
    });
    this.editingKey.set(null);
    this.deletingKey.set(null);
    this.uiState.set({
      mode: 'creating',
      dirty: false,
      busy: false,
      errorMessage: null,
      successMessage: null,
    });
  }

  startEdit(key: string): void {
    if (this.uiState().mode !== 'view' || !this.manageModeActive()) {
      return;
    }

    const row = this.rows().find((item) => item.key === key);
    if (!row) {
      return;
    }

    this.draft.set({
      key: row.key,
      value: row.value,
    });
    this.editingKey.set(row.key);
    this.deletingKey.set(null);
    this.uiState.set({
      mode: 'editing',
      dirty: false,
      busy: false,
      errorMessage: null,
      successMessage: null,
    });
  }

  requestDelete(key: string): void {
    if (this.uiState().mode !== 'view' || !this.manageModeActive()) {
      return;
    }

    const row = this.rows().find((item) => item.key === key);
    if (!row) {
      return;
    }

    this.deletingKey.set(row.key);
    this.editingKey.set(null);
    this.uiState.set({
      mode: 'confirming',
      dirty: false,
      busy: false,
      errorMessage: null,
      successMessage: null,
    });
  }

  requestClose(_key: string): void {
    this.cancel();
  }

  cancel(): void {
    this.draft.set(initialDraft);
    this.editingKey.set(null);
    this.deletingKey.set(null);
    this.uiState.set({
      mode: 'view',
      dirty: false,
      busy: false,
      errorMessage: null,
      successMessage: null,
    });
  }

  submitCreate(): void {
    const draft = this.draft();
    const key = draft.key;
    if (this.uiState().mode !== 'creating' || !key || !draft.value.trim()) {
      return;
    }

    if (this.rows().some((row) => row.key === key)) {
      this.uiState.update((state) => ({
        ...state,
        mode: 'error',
        errorMessage: this.texts.slotDuplicateKeyErrorMessage,
      }));
      return;
    }

    this.simulateSubmit(this.texts.slotCreateSuccessMessage, () => {
      const label = slotKeyOptions.find((option) => option.value === key)?.label ?? key;
      this.rows.update((rows) => [
        ...rows,
        {
          key,
          keyLabel: label,
          value: draft.value.trim(),
        },
      ]);
    });
  }

  submitEdit(): void {
    const key = this.editingKey();
    const nextValue = this.draft().value.trim();
    if (this.uiState().mode !== 'editing' || !key || nextValue.length === 0) {
      return;
    }

    this.simulateSubmit(this.texts.slotEditSuccessMessage, () => {
      this.rows.update((rows) =>
        rows.map((row) => {
          if (row.key !== key) {
            return row;
          }

          return {
            ...row,
            value: nextValue,
          };
        }),
      );
    });
  }

  confirmDelete(): void {
    const key = this.deletingKey();
    if (!key) {
      return;
    }

    this.confirmDeleteByKey(key);
  }

  confirmClose(): void {
    this.cancel();
  }

  protected onDraftKeyChanged(nextKey: string | null): void {
    this.draft.update((draft) => ({
      ...draft,
      key: nextKey,
    }));
    this.markDirty();
  }

  protected onDraftValueChanged(nextValue: string): void {
    this.draft.update((draft) => ({
      ...draft,
      value: nextValue,
    }));
    this.markDirty();
  }

  protected onCreateSubmitted(draft: SlotDraft<string>): void {
    this.draft.set(draft);
    this.submitCreate();
  }

  protected onEditSubmitted(submission: SlotEditSubmission<string>): void {
    this.editingKey.set(submission.key);
    this.draft.set({
      key: submission.key,
      value: submission.value,
    });
    this.submitEdit();
  }

  protected confirmDeleteByKey(key: string): void {
    if (this.uiState().mode !== 'confirming' || this.deletingKey() !== key) {
      return;
    }

    this.simulateSubmit(this.texts.slotDeleteSuccessMessage, () => {
      this.rows.update((rows) => rows.filter((row) => row.key !== key));
    });
  }

  private markDirty(): void {
    this.uiState.update((state) => ({
      ...state,
      dirty: true,
      errorMessage: null,
      successMessage: null,
    }));
  }

  private simulateSubmit(successMessage: string, applyMutation: () => void): void {
    this.uiState.update((state) => ({
      ...state,
      mode: 'submitting',
      busy: true,
      errorMessage: null,
      successMessage: null,
    }));

    window.setTimeout(() => {
      applyMutation();
      this.draft.set(initialDraft);
      this.editingKey.set(null);
      this.deletingKey.set(null);
      this.uiState.set({
        mode: 'view',
        dirty: false,
        busy: false,
        errorMessage: null,
        successMessage,
      });
    }, 500);
  }
}
