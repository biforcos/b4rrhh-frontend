import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosFolioComponent } from './recibos-folio.component';

/**
 * La mitad de frontend del `b4rrhh/backend#94`: **qué naturalezas pinta el folio**.
 *
 * El backend reparte por `payslip_order_code` —lo tiene y es una línea del recibo, no lo tiene y
 * es un paso de cálculo que se guarda y no se imprime— y el folio filtra por **naturaleza**. Son
 * dos criterios distintos que responden a dos preguntas distintas, y hoy **no coinciden**: se
 * persisten 14 conceptos y este folio pinta 9. Los cinco que sobran son la aportación empresarial
 * a la Seguridad Social (720 a 724, `INFORMATIONAL`), que en una nómina de verdad va en su propio
 * recuadro al pie y no entre las líneas.
 *
 * Nada de esto es un defecto: los cinco están bien persistidos y bien no pintados. Lo que faltaba
 * era que estuviera escrito y que se enterase alguien cuando cambie.
 *
 * **Por qué son dos tests y no uno.** El censo de lo que se persiste vive en `b4rrhh/backend`
 * (`WhatIsPersistedAndWhatThePayslipPaintsAreTwoCriteriaTest`), porque sale de consultar
 * `payroll_engine.payroll_concept` y una prueba de aquí no puede verlo. Lo que el folio pinta vive
 * aquí, y una prueba de allí tampoco puede verlo: allí sólo hay una **copia** de esta lista, y
 * esto es lo que la mantiene cierta. Ninguna prueba abarca las dos mitades.
 *
 * **Cuándo es legítimo romper este test.** Cuando el folio aprenda a pintar lo que hoy no pinta, y
 * hay dos candidatos escritos: el **bloque de determinación de las bases de cotización** —base de
 * contingencias comunes, de AT y EP, y sujeta a IRPF, que son conceptos `BASE`— y el **recuadro de
 * la aportación empresarial**. Los dos son decisiones de maquetación perfectamente razonables. El
 * día que se tomen, esto se pone rojo con razón: lo que hay que hacer es actualizar el censo de
 * los dos lados, no borrarlo.
 */
describe('Qué naturalezas pinta el folio, y cuáles se persisten sin pintarse', () => {
  /** Las cinco que se pintan, de las ocho que existen. Este es el censo. */
  const PINTADAS = ['DEDUCTION', 'EARNING', 'NET_PAY', 'TOTAL_DEDUCTION', 'TOTAL_EARNING'];

  /** Y las tres que no. `BASE` y `TECHNICAL` ni siquiera llegan al recibo; `INFORMATIONAL` sí. */
  const NO_PINTADAS = ['BASE', 'INFORMATIONAL', 'TECHNICAL'];

  /** Un concepto real de cada naturaleza, con un importe irrepetible para poder buscarlo. */
  const UNO_DE_CADA_NATURALEZA: PayrollConceptModel[] = [
    concepto('101', 'Salario base', 'EARNING', 1111.11),
    concepto('700', 'Contingencias comunes', 'DEDUCTION', 2222.22),
    concepto('720', 'SS empresa CC', 'INFORMATIONAL', 3333.33),
    concepto('B_CC', 'Base de contingencias comunes', 'BASE', 4444.44),
    concepto('P_IRPF', 'Tipo de IRPF', 'TECHNICAL', 5555.55),
    concepto('970', 'Total devengado', 'TOTAL_EARNING', 6666.66),
    concepto('980', 'Total a deducir', 'TOTAL_DEDUCTION', 7777.77),
    concepto('990', 'Líquido a percibir', 'NET_PAY', 8888.88),
  ];

  /**
   * El censo entero, en una afirmación.
   *
   * Cada naturaleza se prueba **sola en su folio**, con un nombre y un importe que no se repiten:
   * si alguno de los dos aparece en la página, esa naturaleza se pinta. No se mira por qué hueco
   * sale —el cuerpo, la fila de totales o el pie— porque lo que este censo afirma es si sale o no
   * sale.
   *
   * Si mañana alguien añade al folio un bloque para las bases de cotización, esta lista se mueve y
   * el test lo dice nombrando la naturaleza que ha cambiado de lado.
   */
  it('de las ocho naturalezas, el folio pinta cinco y deja tres fuera', () => {
    const pintadas = UNO_DE_CADA_NATURALEZA.filter(seVeEnElFolio)
      .map((c) => c.conceptNatureCode)
      .sort();
    const fuera = UNO_DE_CADA_NATURALEZA.filter((c) => !seVeEnElFolio(c))
      .map((c) => c.conceptNatureCode)
      .sort();

    expect(pintadas).toEqual(PINTADAS);
    expect(fuera).toEqual(NO_PINTADAS);
  });

  it('el cuerpo del recibo son los devengos y las deducciones, y nada más', () => {
    expect(codigosDelCuerpo(UNO_DE_CADA_NATURALEZA)).toEqual(['101', '700']);
  });

  it('los tres totales se buscan uno a uno por su naturaleza', () => {
    const folio = render(UNO_DE_CADA_NATURALEZA);

    expect(textoDe(folio, '.row-totals .amount-earning')).toBe(importe(6666.66));
    expect(textoDe(folio, '.row-totals .amount-deduction')).toBe(importe(7777.77));
    expect(textoDe(folio, '.net-pay-amount')).toBe(`${importe(8888.88)} €`);
  });

  /**
   * Los cinco `INFORMATIONAL` de la aportación empresarial son la divergencia conocida, y la
   * única: se persisten con orden de recibo y este folio no los pinta.
   *
   * Si algún día los pinta, será en su propio recuadro al pie —como manda una nómina de verdad— y
   * no como una línea más del cuerpo, que las sumaría a las deducciones del trabajador.
   */
  it('la aportación empresarial se persiste con su orden de recibo y el folio no la pinta', () => {
    const folio = render(UNO_DE_CADA_NATURALEZA);

    expect(codigosDelCuerpo(UNO_DE_CADA_NATURALEZA)).not.toContain('720');
    expect(folio.textContent).not.toContain('SS empresa CC');
    expect(folio.textContent).not.toContain(importe(3333.33));
  });

  /**
   * La columna de importes del cuerpo no se suma nunca para sacar un total.
   *
   * Los totales del folio salen de sus tres conceptos —970, 980 y 990—, que el motor calculó. Una
   * suma hecha aquí daría otro número en cuanto el folio pinte una naturaleza más, y sería un
   * número que no cuadra con el recibo del backend.
   */
  it('los totales son los conceptos 970, 980 y 990, no la suma de lo que se ve', () => {
    const sinLaAportacionEmpresarial = UNO_DE_CADA_NATURALEZA.filter(
      (c) => c.conceptCode !== '720',
    );

    // La aportación empresarial entra en la lista y los totales no se mueven, porque no se suman.
    expect(textoDe(render(UNO_DE_CADA_NATURALEZA), '.row-totals .amount-deduction')).toBe(
      textoDe(render(sinLaAportacionEmpresarial), '.row-totals .amount-deduction'),
    );
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function concepto(
    conceptCode: string,
    conceptLabel: string,
    conceptNatureCode: string,
    amount: number,
  ): PayrollConceptModel {
    return {
      lineNumber: 1,
      conceptCode,
      conceptLabel,
      amount,
      quantity: null,
      rate: null,
      conceptNatureCode,
      originPeriodCode: '202609',
      displayOrder: 1,
      mergedStepCount: 1,
    };
  }

  /** Con el mismo formateador que el componente, para no depender del ICU de cada entorno. */
  function importe(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Solo en su folio: si su nombre o su importe aparecen en la pagina, esa naturaleza se pinta.
   *
   * Se miran los dos y no solo el importe, porque el folio tiene una forma de pintar una fila sin
   * pintar su numero: la columna de devengos y la de deducciones solo se rellenan si la naturaleza
   * es una de esas dos, asi que una fila de cualquier otra naturaleza saldria con su clave y su
   * concepto y dos guiones. Eso es estar pintado, y buscando solo el importe pasaba por no
   * estarlo — comprobado rompiendolo a mano.
   */
  function seVeEnElFolio(concept: PayrollConceptModel): boolean {
    const folio = render([concept]).textContent ?? '';
    return folio.includes(concept.conceptLabel) || folio.includes(importe(concept.amount!));
  }

  function render(concepts: ReadonlyArray<PayrollConceptModel>): HTMLElement {
    const fixture = TestBed.createComponent(RecibosFolioComponent);
    fixture.componentRef.setInput('concepts', concepts);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function codigosDelCuerpo(concepts: ReadonlyArray<PayrollConceptModel>): string[] {
    const filas = Array.from(
      render(concepts).querySelectorAll('.concept-table tbody tr'),
    ) as HTMLElement[];
    return filas.map((fila) => fila.querySelectorAll('td')[1]?.textContent?.trim() ?? '');
  }

  function textoDe(folio: HTMLElement, selector: string): string {
    return folio.querySelector(selector)?.textContent?.trim() ?? '';
  }
});
