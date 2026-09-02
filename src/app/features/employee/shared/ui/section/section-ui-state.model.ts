export type SectionMode = 'view' | 'editing' | 'creating' | 'confirming' | 'submitting' | 'error';

export interface SectionUiState {
  mode: SectionMode;
  dirty: boolean;
  busy: boolean;
  errorMessage: string | null;
  successMessage: string | null;
}

export interface SectionActionContract<KeyType = string> {
  startCreate(): void;
  startEdit(key: KeyType): void;
  requestDelete(key: KeyType): void;
  requestClose(key: KeyType): void;
  cancel(): void;
  submitCreate(): void;
  submitEdit(): void;
  confirmDelete(): void;
  confirmClose(): void;
}
