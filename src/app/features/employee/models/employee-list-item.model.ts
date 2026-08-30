import { EmployeeBusinessKey } from './employee-business-key.model';

export interface EmployeeListItemModel extends EmployeeBusinessKey {
  displayName: string;
  /** Código del centro de trabajo vigente; `null` si no tiene. */
  workCenter: string | null;
  statusLabel: string;
}

/** El filtro y la página que se piden al servidor; la cola del raíl (#20) será esto mismo. */
export interface EmployeeDirectoryQuery {
  q: string;
  status: string | null;
  page: number;
  size: number;
}

/** Una página del directorio y el total de los que cumplen el filtro, no el de la página. */
export interface EmployeeDirectoryPageModel {
  items: ReadonlyArray<EmployeeListItemModel>;
  page: number;
  size: number;
  total: number;
}
