/**
 * Una acción con nombre propio en una fila (ADR-016: la UI nombra la acción real, nunca un «Corregir»
 * universal). La presencia ofrece «Corregir fecha de alta» y «Corregir fecha de cese»
 * (`b4rrhh/frontend#135`), que no son editar el período: mueven con él lo que empezó o acabó ese día.
 */
export interface TemporalSectionRowAction {
  /** Lo que la sección recibe en `actionClicked` para saber cuál fue. */
  id: string;
  label: string;
  /** Con la fecha, para que dos filas no se lean igual. */
  ariaLabel: string;
}

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
  /**
   * Por defecto false: se ofrece cerrar. Sólo en la vigente de una serie de cobertura opcional
   * (`b4rrhh/frontend#91`): en las obligatorias cerrar la vigente sin nada detrás se rechaza
   * siempre, y el botón no se enseña.
   */
  canClose?: boolean;
  /** Las acciones con nombre propio de la fila, después de los verbos comunes. */
  actions?: ReadonlyArray<TemporalSectionRowAction>;
}
