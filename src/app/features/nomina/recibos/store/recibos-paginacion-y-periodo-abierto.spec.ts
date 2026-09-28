import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollSummaryModel, PayrollStatus } from '../models/payroll-summary.model';
import { RecibosStore } from './recibos.store';

const recibo = (period: string, status: PayrollStatus, employeeNumber = 'EMP000001') =>
  ({
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber,
    payrollPeriodCode: period,
    payrollTypeCode: 'NORMAL',
    presenceNumber: 1,
    status,
    calculatedAt: '2026-09-27T20:28:20Z',
  }) as PayrollSummaryModel;

const pagina = (items: PayrollSummaryModel[], total: number, page = 0, size = 50) => ({
  items,
  page,
  size,
  total,
});

/**
 * La lista de recibos pagina y dice cuántos hay, y abre con el período abierto
 * (`b4rrhh/frontend#93`).
 *
 * <p>Antes la búsqueda cortaba en 500 sin decirlo y la pantalla contaba las filas que tenía: «500
 * nóminas encontradas» de 7.908. Y el filtro de período arrancaba con un `202604` de ejemplo que
 * parecía un mes de verdad.
 */
describe('RecibosStore: páginas, total y período abierto', () => {
  let store: RecibosStore;
  let search: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    search = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: RecibosGateway, useValue: { search, getPayslipSections: () => of([]) } },
      ],
    });
    store = TestBed.inject(RecibosStore);
  });

  it('guarda la página y el total, no el número de filas', () => {
    search.mockReturnValue(of(pagina([recibo('202609', 'CALCULATED')], 7908)));

    store.search({ payrollPeriodCode: '', employeeNumber: '', status: '' });

    expect(store.payrolls()).toHaveLength(1);
    expect(store.total()).toBe(7908);
    expect(store.page()).toBe(0);
    expect(store.pageCount()).toBe(159);
  });

  it('cambiar de página repite los mismos filtros con la página nueva', () => {
    const filtros = { payrollPeriodCode: '202609', employeeNumber: '', status: '' as const };
    search.mockReturnValue(of(pagina([recibo('202609', 'CALCULATED')], 120)));
    store.search(filtros);

    store.goToPage(2);

    expect(search).toHaveBeenLastCalledWith(filtros, 2);
  });

  describe('el período abierto', () => {
    it('es el del primer recibo de una búsqueda sin filtros, si no está cerrado', async () => {
      search.mockReturnValue(of(pagina([recibo('202609', 'CALCULATED')], 7908, 0, 1)));

      expect(await store.findOpenPeriod()).toBe('202609');
      expect(search).toHaveBeenCalledWith(
        { payrollPeriodCode: '', employeeNumber: '', status: '' },
        0,
        1,
      );
    });

    it('si el más reciente ya está cerrado, el abierto es el mes siguiente', async () => {
      search.mockReturnValue(of(pagina([recibo('202612', 'DEFINITIVE')], 100, 0, 1)));
      expect(await store.findOpenPeriod()).toBe('202701');
    });

    it('sin ningún recibo no hay período abierto que proponer', async () => {
      search.mockReturnValue(of(pagina([], 0, 0, 1)));
      expect(await store.findOpenPeriod()).toBeNull();
    });
  });
});
