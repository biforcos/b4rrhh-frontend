import { PayrollListItemModel } from './payroll-summary.model';

/**
 * Una página de la búsqueda de recibos (`b4rrhh/frontend#93`). `total` cuenta todos los que cumplen
 * los filtros, no los de la página: es lo que distingue «no hay más» de «no caben más aquí».
 */
export interface RecibosPageModel {
  readonly items: ReadonlyArray<PayrollListItemModel>;
  readonly page: number;
  readonly size: number;
  readonly total: number;
}

/** Lo que pide la lista cada vez: una página de un tamaño que se lee de un vistazo. */
export const RECIBOS_PAGE_SIZE = 50;
