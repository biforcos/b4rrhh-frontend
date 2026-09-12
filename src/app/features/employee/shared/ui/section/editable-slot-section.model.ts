export interface SlotRowViewModel<KeyType = string> {
  key: KeyType;
  keyLabel: string;
  value: string;
  valueLabel?: string | null;
  secondaryText?: string | null;
  badges?: ReadonlyArray<string>;
  isReadonly?: boolean;
}

export interface SlotDraft<KeyType = string> {
  key: KeyType | null;
  value: string;
}

export interface SlotKeyOption<KeyType = string> {
  value: KeyType;
  label: string;
  /**
   * Si el código está vigente a la fecha del período que se edita (b4rrhh/backend#32).
   *
   * Ausente significa «no se preguntó por ninguna fecha», que es lo que pasa en las listas
   * que no salen del catálogo. Las no vigentes **se ofrecen igual**: elegir una es un caso
   * legítimo y frecuente —la corrección administrativa—, y esconderlas obligaría a un modo
   * especial que el usuario tendría que saber que existe.
   */
  effective?: boolean;
  /** Por qué no está vigente, para decirlo en la opción: «cerrado el 31/12/2020». */
  note?: string | null;
}

export interface SlotEditSubmission<KeyType = string> {
  key: KeyType;
  value: string;
}

export type SlotDisplayMode = 'view' | 'manage' | 'creating' | 'editing' | 'confirmingDelete';

export interface SlotSectionTexts {
  manageAction: string;
  exitManageAction: string;
  addAction: string;
  editAction: string;
  deleteAction: string;
  cancelAction: string;
  saveCreateAction: string;
  saveEditAction: string;
  confirmDeleteMessage: string;
  confirmDeleteAction: string;
  emptyMessage: string;
  keyFieldLabel: string;
  valueFieldLabel: string;
}
