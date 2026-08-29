/** Una fila de una sección temporal: una vigencia con su estado y lo que se puede hacer con ella. */
export interface TemporalSectionRow {
  /** ISO. */
  startDate: string;
  /** ISO, o null si la vigencia está abierta. */
  endDate: string | null;
  isActive: boolean;
  /** Por defecto true: se ofrece editar. */
  canEdit?: boolean;
  /** Por defecto false: se ofrece borrar, y solo en filas cerradas. */
  canDelete?: boolean;
}
