import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { RecibosFilters } from '../models/recibos-filters.model';
import { RecibosListComponent } from './recibos-list.component';

const RECIBO: PayrollSummaryModel = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000001',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 2,
  status: 'CALCULATED',
  calculatedAt: '2026-09-27T20:28:20Z',
};

/**
 * La lista de recibos sin tocar nada (`b4rrhh/frontend#93`): abre con el período abierto ya
 * puesto, el hueco del filtro no parece un mes, y con 7.908 recibos pagina y dice cuántos hay.
 */
describe('La lista de recibos al abrirla', () => {
  function montar() {
    const search = vi.fn((filtros: RecibosFilters, page = 0, size = 50) =>
      of({
        items: [RECIBO],
        page,
        size,
        total: size === 1 ? 7908 : filtros.payrollPeriodCode ? 873 : 7908,
      }),
    );
    const vacio = new Map<string, string>();
    (vacio as unknown as { get(k: string): string | null }).get = () => null;
    TestBed.configureTestingModule({
      imports: [RecibosListComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: { queryParamMap: new BehaviorSubject(vacio) } },
        { provide: RecibosGateway, useValue: { getPayslipSections: () => of([]), search } },
      ],
    });
    const fixture = TestBed.createComponent(RecibosListComponent);
    fixture.detectChanges();
    return { fixture, search };
  }

  /** La promesa del período abierto, la búsqueda y el `ngModel` resuelven en vueltas distintas. */
  async function estable(fixture: ReturnType<typeof montar>['fixture']) {
    for (let vuelta = 0; vuelta < 3; vuelta += 1) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  it('busca sola con el período abierto puesto en el filtro', async () => {
    const { fixture, search } = montar();
    await estable(fixture);

    expect(search).toHaveBeenCalledWith(
      { payrollPeriodCode: '', employeeNumber: '', status: '' },
      0,
      1,
    );
    expect(search).toHaveBeenLastCalledWith(
      { payrollPeriodCode: '202609', employeeNumber: '', status: '' },
      0,
    );
    const periodo = (fixture.nativeElement as HTMLElement).querySelector(
      'input[aria-label="Período"]',
    ) as HTMLInputElement;
    expect(periodo.value).toBe('202609');
  });

  it('el hueco del período no parece un mes de verdad', () => {
    const { fixture } = montar();
    const periodo = (fixture.nativeElement as HTMLElement).querySelector(
      'input[aria-label="Período"]',
    ) as HTMLInputElement;
    expect(periodo.placeholder).not.toMatch(/^\d{6}$/);
  });

  it('dice cuántos hay en total y en qué página se está', async () => {
    const { fixture } = montar();
    await estable(fixture);
    const pie = (fixture.nativeElement as HTMLElement).querySelector('.list-footer')!;
    expect(pie.textContent?.replace(/\s+/g, ' ').trim()).toContain('873 recibos');
    expect(pie.textContent?.replace(/\s+/g, ' ').trim()).toContain('página 1 de 18');
  });

  it('la página siguiente pide la siguiente con los mismos filtros', async () => {
    const { fixture, search } = montar();
    await estable(fixture);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.list-footer__next')!
      .click();
    expect(search).toHaveBeenLastCalledWith(
      { payrollPeriodCode: '202609', employeeNumber: '', status: '' },
      1,
    );
  });
});
