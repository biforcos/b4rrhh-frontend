import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { EmployeeYearModel } from '../../models/employee-year.model';
import { AbsencePick, EmployeeYearStripComponent } from './employee-year-strip.component';

/**
 * El año de un vistazo (`b4rrhh/frontend#109`): la tira pinta lo que devuelve el resumen del
 * `b4rrhh/backend#151`, y lo que se pulsa en ella se le pide a la página.
 */
describe('La tira del año', () => {
  const MESES = Array.from({ length: 12 }, (_, i) => ({
    period: 202601 + i,
    payrollState: (i < 8 ? 'CLOSED' : i === 8 ? 'OPEN' : null) as 'CLOSED' | 'OPEN' | null,
    payrollInputCount: i === 2 ? 1 : i === 8 ? 2 : 0,
    activeRetroMarkCount: i === 2 ? 1 : 0,
    consumedRetroMarkCount: i === 2 ? 2 : 0,
  }));

  const ANIO: EmployeeYearModel = {
    year: 2026,
    presences: [{ startDate: '2026-02-10', endDate: null }],
    months: MESES,
    absences: [
      { absenceTypeCode: 'IT_COMMON', startDate: '2026-03-28', endDate: '2026-04-04' },
      { absenceTypeCode: 'VACATION', startDate: '2026-07-01', endDate: '2026-07-08' },
    ],
  };

  let fixture: ComponentFixture<EmployeeYearStripComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EmployeeYearStripComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(EmployeeYearStripComponent);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('data', ANIO);
    fixture.componentRef.setInput('selectedPeriod', 202603);
    fixture.componentRef.setInput(
      'absenceTypeLabels',
      new Map([['IT_COMMON', 'IT Contingencia Común']]),
    );
    fixture.componentRef.setInput('today', '2026-09-29');
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  const bars = () => Array.from(host.querySelectorAll<HTMLButtonElement>('.year-strip__bar'));
  const months = () => Array.from(host.querySelectorAll<HTMLButtonElement>('.year-strip__month'));

  it('pinta cada ausencia una vez, entera, aunque cruce de mes', () => {
    expect(bars()).toHaveLength(2);
    expect(bars()[0].getAttribute('aria-label')).toBe(
      'IT Contingencia Común, del 28/03/2026 al 04/04/2026',
    );
    // Sin nombre en el catálogo, el código.
    expect(bars()[1].getAttribute('aria-label')).toContain('VACATION');
  });

  it('pinta los meses entregados, los que no estaba y el elegido', () => {
    const cols = Array.from(host.querySelectorAll('.year-strip__column'));
    expect(cols).toHaveLength(12);
    expect(cols[0].classList).toContain('year-strip__column--absent');
    expect(cols[1].classList).not.toContain('year-strip__column--absent');
    expect(cols[7].classList).toContain('year-strip__column--closed');
    expect(cols[8].classList).not.toContain('year-strip__column--closed');
    expect(cols[2].classList).toContain('year-strip__column--selected');
    expect(months()[2].getAttribute('aria-pressed')).toBe('true');
  });

  it('las entradas y las correcciones van con su número escrito', () => {
    const dots = Array.from(host.querySelectorAll('.year-strip__dot'));
    expect(dots.map((d) => d.getAttribute('aria-label'))).toEqual([
      '1 entrada en marzo',
      '2 entradas en septiembre',
    ]);
    const marks = Array.from(host.querySelectorAll('.year-strip__mark'));
    expect(marks.map((m) => m.getAttribute('aria-label'))).toEqual([
      '1 corrección de marzo pendiente',
      '2 correcciones de marzo pagadas',
    ]);
  });

  it('pulsar un mes lo pide como período', () => {
    const pedidos: number[] = [];
    fixture.componentInstance.periodPicked.subscribe((p) => pedidos.push(p));
    months()[6].click();
    expect(pedidos).toEqual([202607]);
  });

  it('pulsar una barra pide su mes y la ausencia que hay que resaltar', () => {
    const pedidos: AbsencePick[] = [];
    fixture.componentInstance.absencePicked.subscribe((p) => pedidos.push(p));
    bars()[0].click();
    expect(pedidos).toEqual([
      { period: 202603, absenceTypeCode: 'IT_COMMON', startDate: '2026-03-28' },
    ]);
  });

  it('pulsar un punto o una marca lleva a ese mes', () => {
    const entradas: number[] = [];
    const marcas: number[] = [];
    fixture.componentInstance.inputsPicked.subscribe((p) => entradas.push(p));
    fixture.componentInstance.marksPicked.subscribe((p) => marcas.push(p));
    host.querySelectorAll<HTMLButtonElement>('.year-strip__dot')[1].click();
    host.querySelectorAll<HTMLButtonElement>('.year-strip__mark')[0].click();
    expect(entradas).toEqual([202609]);
    expect(marcas).toEqual([202603]);
  });

  it('las flechas piden el año anterior y el siguiente', () => {
    const pedidos: number[] = [];
    fixture.componentInstance.yearRequested.subscribe((y) => pedidos.push(y));
    const [antes, despues] = Array.from(
      host.querySelectorAll<HTMLButtonElement>('.year-strip__year-btn'),
    );
    antes.click();
    despues.click();
    expect(pedidos).toEqual([2025, 2027]);
  });

  it('todo lo que se pulsa es un botón con nombre, para el teclado y el lector', () => {
    const botones = Array.from(host.querySelectorAll<HTMLButtonElement>('button'));
    expect(botones.length).toBe(2 + 12 + 2 + 2 + 2);
    for (const b of botones) {
      const nombre = b.getAttribute('aria-label') ?? b.textContent?.trim();
      expect(nombre, b.outerHTML).toBeTruthy();
      expect(b.tabIndex).not.toBe(-1);
    }
  });

  it('con los datos de otro año no pinta nada de ellos', () => {
    fixture.componentRef.setInput('year', 2025);
    fixture.detectChanges();
    expect(bars()).toHaveLength(0);
    expect(host.querySelectorAll('.year-strip__dot')).toHaveLength(0);
  });
});
