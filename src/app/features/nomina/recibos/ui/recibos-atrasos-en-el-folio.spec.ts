import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosFolioComponent } from './recibos-folio.component';

/**
 * El folio pinta las líneas de atraso **donde el servidor las pone**, con su origen (`b4rrhh/frontend#85`).
 *
 * Y «nada propio» es el entregable de esta parte del issue, no una nota al margen. La tentación era
 * un bloque «Atrasos» al final del folio, y está mal por dos razones: el modelo oficial de nómina no
 * tiene ese bloque, y un atraso de cuota es una deducción de este recibo —está en el 980— así que
 * sacarlo de las deducciones dejaría un folio cuyo bloque de deducciones no suma su propio total.
 * Lo que distingue una línea de atraso de una del mes es su columna de período, que el folio ya
 * pinta desde el `b4rrhh/backend#112`.
 *
 * Los cuatro bloques a la vez son el caso del `b4rrhh/backend#133`: devengos, deducciones,
 * aportación empresarial y bases. Los tres primeros suman a un total de este mes; las bases
 * atrasadas **no**, y se pintan igual, porque se leen y porque hacen falta para la liquidación
 * complementaria.
 */
describe('Las líneas de atraso salen en su bloque con su origen', () => {
  const SECCIONES = [
    { sectionCode: 'DEVENGOS', label: 'Devengos', displayOrder: 10 },
    { sectionCode: 'DEDUCCIONES', label: 'Deducciones', displayOrder: 20 },
    { sectionCode: 'BASES', label: 'Determinacion de las bases de cotizacion', displayOrder: 40 },
    { sectionCode: 'APORTACION_EMPRESARIAL', label: 'Aportacion empresarial', displayOrder: 50 },
  ];

  /**
   * Un recibo de septiembre con línea propia y atraso en los cuatro bloques. El literal lleva el
   * mes a la vista y viene **congelado desde el backend**: el folio no lo compone.
   */
  const RECIBO_CON_ATRASOS: PayrollConceptModel[] = [
    linea(1, '100', 'Salario base', 'EARNING', 'DEVENGOS', '202609', 1400),
    linea(2, '102', 'Importe horas extra (atraso 08/2026)', 'EARNING', 'DEVENGOS', '202608', 59.4),
    linea(3, '700', 'Contingencias comunes', 'DEDUCTION', 'DEDUCCIONES', '202609', -95.2),
    linea(
      4,
      '700',
      'Contingencias comunes (atraso 08/2026)',
      'DEDUCTION',
      'DEDUCCIONES',
      '202608',
      -2.83,
    ),
    linea(5, '501', 'Base de contingencias comunes', 'BASE', 'BASES', '202609', 1600),
    linea(
      6,
      '501',
      'Base de contingencias comunes (atraso 08/2026)',
      'BASE',
      'BASES',
      '202608',
      59.4,
    ),
    linea(
      7,
      '720',
      'Contingencias comunes (atraso 08/2026)',
      'INFORMATIONAL',
      'APORTACION_EMPRESARIAL',
      '202608',
      14.07,
    ),
  ];

  it('cada atraso se pinta en el bloque que el servidor le da, y en ninguno más', () => {
    const folio = render(RECIBO_CON_ATRASOS);

    expect(periodosDelBloque(folio, 'Devengos')).toEqual(['202609', '202608']);
    expect(periodosDelBloque(folio, 'Deducciones')).toEqual(['202609', '202608']);
    expect(periodosDelBloque(folio, 'Determinacion de las bases de cotizacion')).toEqual([
      '202609',
      '202608',
    ]);
    expect(periodosDelBloque(folio, 'Aportacion empresarial')).toEqual(['202608']);
  });

  /** No hay bloque «Atrasos»: el folio pinta los bloques que el catálogo declara y nada más. */
  it('el folio no se inventa un bloque de atrasos', () => {
    const folio = render(RECIBO_CON_ATRASOS);

    const rotulos = Array.from(folio.querySelectorAll('.section-label')).map((el) =>
      el.textContent!.trim(),
    );
    expect(rotulos).toEqual([
      'Devengos',
      'Deducciones',
      'Determinacion de las bases de cotizacion',
      'Aportacion empresarial',
    ]);
  });

  /**
   * El literal se pinta tal cual llega. Si el folio compusiera el sufijo, un recibo ya entregado
   * cambiaría de texto el día que se cambiara la forma de escribirlo: el literal está congelado en
   * la línea porque el recibo tiene un gemelo en papel fuera del sistema (`b4rrhh/backend#134`).
   */
  it('el literal con su mes sale tal cual viene, sin componerlo aquí', () => {
    const folio = render(RECIBO_CON_ATRASOS);

    expect(folio.textContent).toContain('Importe horas extra (atraso 08/2026)');
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  /** La columna de período de cada fila de un bloque, en orden. */
  function periodosDelBloque(folio: HTMLElement, titulo: string): string[] {
    const tabla = Array.from(folio.querySelectorAll('.concept-table')).find(
      (t) => t.querySelector('.section-label')?.textContent?.trim() === titulo,
    );
    return Array.from(tabla?.querySelectorAll('tbody tr') ?? [])
      .filter((fila) => fila.querySelectorAll('td').length > 0)
      .map((fila) => fila.querySelectorAll('td')[0].textContent!.trim());
  }

  function linea(
    lineNumber: number,
    conceptCode: string,
    conceptLabel: string,
    conceptNatureCode: string,
    payslipSectionCode: string,
    originPeriodCode: string,
    amount: number,
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
      displayOrder: lineNumber * 10,
      mergedStepCount: 1,
      payslipSectionCode,
      payslipSubsectionCode: null,
    };
  }

  function render(concepts: ReadonlyArray<PayrollConceptModel>): HTMLElement {
    const fixture = TestBed.createComponent(RecibosFolioComponent);
    fixture.componentRef.setInput('concepts', concepts);
    fixture.componentRef.setInput('payslipSections', SECCIONES);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
});
