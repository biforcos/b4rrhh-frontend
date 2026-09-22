import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosFolioComponent } from './recibos-folio.component';

/**
 * El folio no suma (`b4rrhh/frontend#79`).
 *
 * <h3>Qué destapó esto</h3>
 *
 * El test de comparación PDF ↔ folio del `b4rrhh/backend#112`, en su primera corrida. El folio
 * pintaba, al pie del recuadro de bases de cotización:
 *
 * ```
 * Total determinación de las bases    2.391,75
 * ```
 *
 * que es `B_CC` (1.323,00) + `B01` (1.068,75). **Esa suma no significa nada.** La base de
 * cotización y la base sujeta a IRPF son dos cifras distintas para dos cosas distintas, y no hay
 * ningún sitio —ni en el modelo oficial, ni en el motor— donde se sumen. El folio la pintaba
 * porque sumaba *todos* los bloques que no traían total propio, y hasta la `V139` ese recuadro
 * salía vacío, así que nadie lo había visto.
 *
 * <h3>Por qué el arreglo no fue «excluir los BASE»</h3>
 *
 * Porque sería volver a clasificar por `conceptNatureCode` en el cliente, que es justo lo que el
 * `b4rrhh/frontend#76` acababa de quitar, y porque taparía sólo el caso conocido: el siguiente
 * bloque cuya suma no significara nada volvería a sumarse.
 *
 * La regla que queda es más corta y no deja casos: **un bloque tiene total si el motor le ha dado
 * uno, y si no, no lo tiene.** Los totales que existen son conceptos —`970`, `980`, `990`—,
 * calculados por el motor y congelados en la línea. Un número que el folio se inventa no es un
 * total: es un número.
 *
 * <h3>Lo que este test comprueba, y por los dos lados</h3>
 *
 * Que el bloque de bases no lleva total, que ninguno lo lleva por suma, y —lo que de verdad prueba
 * la regla— que **quitando el `970` de la respuesta, el bloque de devengos se queda sin total en
 * vez de con uno inventado**. Sin esa segunda mitad, un folio que hubiera dejado de pintar el pie
 * por cualquier otra razón pasaría igual.
 */
describe('El folio no suma: un bloque tiene el total que le dio el motor, o ninguno', () => {
  const SECCIONES = [
    { sectionCode: 'DEVENGOS', label: 'Devengos', displayOrder: 10 },
    { sectionCode: 'BASES', label: 'Determinacion de las bases de cotizacion', displayOrder: 40 },
    {
      sectionCode: 'APORTACION_EMPRESARIAL',
      label: 'Aportacion empresarial',
      displayOrder: 50,
    },
  ];

  /** Las dos bases del recibo real que destapó el defecto, con sus importes. */
  const LAS_DOS_BASES: PayrollConceptModel[] = [
    concepto('B_CC', 'Base de contingencias comunes', 'BASE', 1323.0, 'BASES'),
    concepto('B01', 'Base sujeta a retencion', 'BASE', 1068.75, 'BASES'),
  ];

  /** Devengos con su total del motor: dos conceptos y el 970 que los cierra. */
  const DEVENGOS_CON_SU_TOTAL: PayrollConceptModel[] = [
    concepto('101', 'Salario base', 'EARNING', 1200.0, 'DEVENGOS'),
    concepto('102', 'Horas extra', 'EARNING', 123.0, 'DEVENGOS'),
    concepto('970', 'Total devengado', 'TOTAL_EARNING', 1323.0, 'DEVENGOS'),
  ];

  /** Criterio 1: el recuadro de bases no lleva total. */
  it('el recuadro de bases se pinta entero y no lo cierra ninguna suma', () => {
    const folio = render(LAS_DOS_BASES);

    expect(folio.textContent).toContain('Determinacion de las bases de cotizacion');
    expect(folio.textContent).toContain(importe(1323.0));
    expect(folio.textContent).toContain(importe(1068.75));

    // El número que este issue existe para quitar.
    expect(folio.textContent).not.toContain(importe(2391.75));
    expect(folio.querySelector('tfoot')).toBeNull();
  });

  /**
   * Criterio 2, la mitad que importa: **quitando el 970, el bloque de devengos se queda sin
   * total.**
   *
   * Es la comprobación de que no queda ninguna suma de reserva. Si el folio siguiera sumando
   * cuando le falta el total del motor, aquí saldría 1.323,00 —que da la casualidad de que es el
   * mismo número que el 970— y el test diría que todo va bien. Por eso se busca el pie y no el
   * importe: lo que se afirma es que **no hay total**, no que el total sea otro.
   */
  it('sin el 970, los devengos no se quedan con un total inventado', () => {
    const sinElTotalDelMotor = DEVENGOS_CON_SU_TOTAL.filter((c) => c.conceptCode !== '970');

    const folio = render(sinElTotalDelMotor);

    expect(codigosDelCuerpo(folio)).toEqual(['101', '102']);
    expect(folio.querySelector('tfoot')).toBeNull();
    expect(folio.querySelector('.row-total')).toBeNull();
  });

  /** Y por el otro lado: con el 970, el bloque sí cierra con él, pintado como la línea que es. */
  it('con el 970, el total del bloque es esa línea y sale una sola vez', () => {
    const folio = render(DEVENGOS_CON_SU_TOTAL);

    expect(codigosDelCuerpo(folio)).toEqual(['101', '102', '970']);
    expect(folio.querySelector('.row-total')).not.toBeNull();
    expect(folio.querySelector('tfoot')).toBeNull();
    // Una sola vez: si además se sumara el bloque, 1.323,00 aparecería dos veces.
    expect(veces(folio, importe(1323.0))).toBe(1);
  });

  /**
   * La aportación empresarial tampoco se suma, y esto es lo que la regla cambia además de las
   * bases.
   *
   * El motor no totaliza este recuadro, así que antes el folio le ponía la suma de sus líneas.
   * Con la regla nueva se queda sin total, igual que las bases. **El papel del
   * `b4rrhh/backend#112` sí lo suma** —a propósito, porque el modelo oficial pide el total de ese
   * recuadro—, así que ahí queda una diferencia entre las dos salidas, dicha y no escondida.
   */
  it('la aportación empresarial tampoco lleva suma', () => {
    const folio = render([
      concepto('720', 'SS empresa CC', 'INFORMATIONAL', 312.23, 'APORTACION_EMPRESARIAL'),
      concepto('721', 'SS empresa desempleo', 'INFORMATIONAL', 93.27, 'APORTACION_EMPRESARIAL'),
    ]);

    expect(codigosDelCuerpo(folio)).toEqual(['720', '721']);
    expect(folio.textContent).not.toContain(importe(405.5));
    expect(folio.querySelector('tfoot')).toBeNull();
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function concepto(
    conceptCode: string,
    conceptLabel: string,
    conceptNatureCode: string,
    amount: number,
    payslipSectionCode: string | null,
    payslipSubsectionCode: string | null = null,
  ): PayrollConceptModel {
    return {
      lineNumber: 1,
      conceptCode,
      conceptMnemonic: conceptCode,
      conceptLabel,
      amount,
      quantity: null,
      rate: null,
      conceptNatureCode,
      originPeriodCode: '202609',
      displayOrder: Number(conceptCode.replace(/\D/g, '')) || 1,
      mergedStepCount: 1,
      payslipSectionCode,
      payslipSubsectionCode,
    };
  }

  /** Con el mismo formateador que el componente, para no depender del ICU de cada entorno. */
  function importe(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function render(concepts: ReadonlyArray<PayrollConceptModel>): HTMLElement {
    const fixture = TestBed.createComponent(RecibosFolioComponent);
    fixture.componentRef.setInput('concepts', concepts);
    fixture.componentRef.setInput('payslipSections', SECCIONES);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function codigosDelCuerpo(folio: HTMLElement): string[] {
    return Array.from(folio.querySelectorAll('.concept-table tbody tr')).map(
      (fila) => fila.querySelectorAll('td')[1]?.textContent?.trim() ?? '',
    );
  }

  function veces(folio: HTMLElement, texto: string): number {
    return (folio.textContent ?? '').split(texto).length - 1;
  }
});
