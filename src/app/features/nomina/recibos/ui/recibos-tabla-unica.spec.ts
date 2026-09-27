import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { formatValor } from '../format/recibos.format';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosFolioComponent } from './recibos-folio.component';

/**
 * El folio: período sólo cuando no es el del recibo, y **una sola tabla** de devengos y deducciones
 * (`b4rrhh/frontend#89`).
 *
 * Decidido mirando la demo del 162, con nueve meses de historia por primera vez: con veinte filas que
 * dicen `202609` la columna de período no informa; con una que dice `202608` y las demás vacías, la
 * retro salta a la vista. Y devengos y deducciones van en una tabla, como en los recibos de nómina:
 * cada línea en su columna, el `970` y el `980` del motor al pie de cada una, y el líquido debajo.
 *
 * Los subtotales **se leen, no se suman** (`b4rrhh/backend#114`): el fixture les da a propósito un
 * importe que no es la suma de sus líneas, y el spec se pone rojo si alguien suma.
 */
describe('El folio con una sola tabla de devengos y deducciones', () => {
  const SECCIONES = [
    { sectionCode: 'DEVENGOS', label: 'Devengos', displayOrder: 10 },
    { sectionCode: 'DEDUCCIONES', label: 'Deducciones', displayOrder: 20 },
    { sectionCode: 'LIQUIDO', label: 'Liquido total a percibir', displayOrder: 30 },
    { sectionCode: 'BASES', label: 'Determinacion de las bases de cotizacion', displayOrder: 40 },
  ];

  const RECIBO: PayrollConceptModel[] = [
    linea(1, '101', 'Salario base', 'EARNING', 'DEVENGOS', '202609', 1400, 10),
    linea(2, '102', 'Horas extraordinarias', 'EARNING', 'DEVENGOS', '202608', 59.4, 20),
    // Ni 1400 + 59,40 ni nada que se le parezca: si el pie dice otra cosa, alguien ha sumado.
    linea(3, '970', 'Total devengado', 'TOTAL_EARNING', 'DEVENGOS', '202609', 9999, 970),
    linea(4, '700', 'Contingencias comunes', 'DEDUCTION', 'DEDUCCIONES', '202609', 95.2, 700),
    linea(5, '700', 'Contingencias comunes', 'DEDUCTION', 'DEDUCCIONES', '202608', 2.83, 701),
    linea(6, '980', 'Total a deducir', 'TOTAL_DEDUCTION', 'DEDUCCIONES', '202609', 7777, 980),
    linea(7, '990', 'Liquido total a percibir', 'NET_PAY', 'LIQUIDO', '202609', 2222, 990),
    linea(8, 'B01', 'Base de cotizacion', 'BASE', 'BASES', '202609', 1600, 1000),
  ];

  it('devengos y deducciones van en una sola tabla, cada línea en su columna', () => {
    const folio = render(RECIBO);

    const tablas = rotulos(folio);
    expect(tablas).toContain('Devengos y deducciones');
    expect(tablas).not.toContain('Devengos');
    expect(tablas).not.toContain('Deducciones');

    const filas = filasDe(folio, 'Devengos y deducciones');
    expect(filas.map((f) => [f.clave, f.devengo, f.deduccion])).toEqual([
      ['101', formatValor(1400), ''],
      ['102', formatValor(59.4), ''],
      ['700', '', formatValor(95.2)],
      ['700', '', formatValor(2.83)],
    ]);
  });

  it('los subtotales son el 970 y el 980 del servidor, no una suma del cliente', () => {
    const folio = render(RECIBO);
    const pie = folio.querySelector('.tabla-unica tfoot tr')!;
    const celdas = Array.from(pie.querySelectorAll('td, th')).map((c) => c.textContent!.trim());

    expect(celdas).toContain(formatValor(9999));
    expect(celdas).toContain(formatValor(7777));
  });

  it('el líquido va debajo, y es el 990', () => {
    const folio = render(RECIBO);

    const liquido = folio.querySelector('.net-pay-amount')!.textContent!;
    expect(liquido).toContain(formatValor(2222));
    const tabla = folio.querySelector('.tabla-unica')!;
    expect(
      tabla.compareDocumentPosition(folio.querySelector('.net-pay-footer')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('una línea propia no pinta período; una de atraso sí', () => {
    const folio = render(RECIBO);

    expect(filasDe(folio, 'Devengos y deducciones').map((f) => f.periodo)).toEqual([
      '',
      '202608',
      '',
      '202608',
    ]);
    // En todas las tablas, también en las que no cambian de forma.
    expect(
      filasDe(folio, 'Determinacion de las bases de cotizacion').map((f) => f.periodo),
    ).toEqual(['']);
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function rotulos(folio: HTMLElement): string[] {
    return Array.from(folio.querySelectorAll('.section-label')).map((el) => el.textContent!.trim());
  }

  function filasDe(folio: HTMLElement, titulo: string) {
    const tabla = Array.from(folio.querySelectorAll('.concept-table')).find(
      (t) => t.querySelector('.section-label')?.textContent?.trim() === titulo,
    );
    return Array.from(tabla?.querySelectorAll('tbody tr') ?? [])
      .filter((fila) => fila.querySelectorAll('td').length > 0)
      .map((fila) => {
        const celdas = Array.from(fila.querySelectorAll('td')).map((c) => c.textContent!.trim());
        return {
          periodo: celdas[0],
          clave: celdas[1],
          devengo: celdas[celdas.length - 2],
          deduccion: celdas[celdas.length - 1],
        };
      });
  }

  function linea(
    lineNumber: number,
    conceptCode: string,
    conceptLabel: string,
    conceptNatureCode: string,
    payslipSectionCode: string,
    originPeriodCode: string,
    amount: number,
    displayOrder: number,
  ): PayrollConceptModel {
    return {
      lineNumber,
      conceptCode,
      conceptMnemonic: conceptCode,
      conceptLabel,
      amount,
      quantity: null,
      rate: null,
      conceptNatureCode,
      originPeriodCode,
      displayOrder,
      mergedStepCount: 1,
      payslipSectionCode,
      payslipSubsectionCode: null,
    };
  }

  function render(concepts: ReadonlyArray<PayrollConceptModel>): HTMLElement {
    const fixture = TestBed.createComponent(RecibosFolioComponent);
    fixture.componentRef.setInput('concepts', concepts);
    fixture.componentRef.setInput('payslipSections', SECCIONES);
    fixture.componentRef.setInput('payrollPeriodCode', '202609');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
});
