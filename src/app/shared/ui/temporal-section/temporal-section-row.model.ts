/** Una fila de una sección temporal: una vigencia con su estado y lo que se puede hacer con ella. */
export interface TemporalSectionRow {
  /** ISO. */
  startDate: string;
  /** ISO, o null si la vigencia está abierta. */
  endDate: string | null;
  isActive: boolean;
  /** Por defecto true: se ofrece editar. */
  canEdit?: boolean;
  /**
   * Por defecto false: se ofrece borrar. La sección decide en qué filas; en una serie bajo
   * ADR-057 borrar la última —la vigente— es la forma de deshacer un alta, y el plan del backend
   * dice si se puede.
   */
  canDelete?: boolean;
}
