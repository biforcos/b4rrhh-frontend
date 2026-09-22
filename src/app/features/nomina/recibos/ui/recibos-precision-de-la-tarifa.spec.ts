import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PayrollCalculationStepModel } from '../models/payroll-calculation-step.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosFolioComponent } from './recibos-folio.component';
import { RecibosValorizacionPanelComponent } from './recibos-valorizacion-panel.component';

/**
 * El `b4rrhh/backend#106`: **una línea del recibo se tiene que poder reproducir multiplicando lo
 * que enseña**.
 *
 * El caso es el de `EMP000003`, presencia 1, período `202609` —el del mes partido con categoría
 * `G1`—, y es el único de los 873 recibos de la semilla donde las dos lecturas difieren:
 *
 * ```
 * 202609  101  SALARIO_BASE  15,00  30,84  462,53      15 × 30,84  = 462,60   ← lo que decía
 *                                                      15 × 30,835 = 462,53   ← lo que hizo
 * ```
 *
 * Hacen falta dos cosas a la vez para que se note: categoría cuyo precio día tenga decimales
 * impares al partirse —`61,67 / 2 = 30,835`— y mes partido. Con `G2` sale `23,75` y es exacto, y
 * a jornada completa no hay mitad. Por eso los tres primeros tests van por separado: **uno que
 * mirase sólo el caso difícil pasaría con una implementación que pintase siempre tres decimales**,
 * y uno que mirase sólo el fácil pasaría sin arreglar nada.
 *
 * El cuarto es el criterio 4 del issue, y es el que impide que esto vuelva: el folio y la pestaña
 * «Cálculo» no pueden tener cada uno su precisión. La tercera pantalla —el grafo— la dibuja el
 * diseñador y vive en otro repositorio, así que la sujeta `receiptFormat.test.ts` allí; ninguna
 * prueba puede abarcar los dos.
 */
describe('La tarifa se enseña con la precisión que se usó', () => {
  /** La segunda línea del mes partido: media jornada de `G1`, que es donde aparece el decimal. */
  const TRAMO_DE_MEDIA_JORNADA = linea({ quantity: 15, rate: 30.835, amount: 462.53 });

  /** La primera, a jornada completa: exacta, y la que no se puede estropear. */
  const TRAMO_PLENO = linea({ quantity: 15, rate: 61.67, amount: 925.05 });

  it('la línea del mes partido cuadra al multiplicarla', () => {
    const [, tarifa] = celdasDelFolio(TRAMO_DE_MEDIA_JORNADA);

    expect(tarifa).toBe('30,835');
    // Y lo que cuadra es la línea entera, no sólo la celda: lo que un técnico de nóminas hace al
    // mirarla es multiplicar, y le tiene que dar el importe impreso.
    expect(redondeoADos(15 * 30.835)).toBe(462.53);
  });

  /**
   * Seis decimales significativos, que es el techo real: el esquema acota `rounding_scale` entre
   * 0 y 6, así que ningún valor del recibo puede traer más. No hay ninguno así en la semilla —el
   * peor caso vivo tiene tres— y por eso hay que fabricarlo: sin este test, «pintar tres» pasa.
   */
  it('seis decimales se enseñan los seis, no tres', () => {
    const [cantidad, tarifa] = celdasDelFolio(
      linea({ quantity: 0.333333, rate: 1.234567, amount: 0.41 }),
    );

    expect(tarifa).toBe('1,234567');
    expect(cantidad).toBe('0,333333');
  });

  it('una tarifa exacta sigue saliendo con sus dos decimales', () => {
    const [cantidad, tarifa, devengo] = celdasDelFolio(TRAMO_PLENO);

    expect(cantidad).toBe('15,00');
    expect(tarifa).toBe('61,67');
    // El importe es dinero y no se mueve: los conceptos que llegan al folio redondean a dos.
    expect(devengo).toBe('925,05');
  });

  /**
   * El criterio 4. No compara contra una cadena escrita a mano a propósito: lo que se comprueba
   * es que las dos pantallas coincidan, que es lo que estaba roto.
   */
  it('el folio y la pestaña «Cálculo» dicen lo mismo del mismo número', () => {
    const [, tarifaEnElFolio] = celdasDelFolio(TRAMO_DE_MEDIA_JORNADA);
    const tarifaEnElCalculo = tarifaDelPasoEnCalculo(TRAMO_DE_MEDIA_JORNADA);

    expect(tarifaEnElCalculo).toBe(tarifaEnElFolio);
    expect(tarifaEnElCalculo).toBe('30,835');
  });

  /** Las celdas numéricas de la única fila del folio: cantidad, tarifa, devengo. */
  function celdasDelFolio(concept: PayrollConceptModel): [string, string, string] {
    const fixture = TestBed.createComponent(RecibosFolioComponent);
    fixture.componentRef.setInput('concepts', [concept]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const celdas = Array.from(host.querySelectorAll('.concept-table tbody td')) as HTMLElement[];
    const texto = (i: number) => celdas[i].textContent?.trim() ?? '';
    return [texto(3), texto(4), texto(5)];
  }

  /** La celda de tarifa del paso que produjo esa línea, en la pestaña «Cálculo». */
  function tarifaDelPasoEnCalculo(concept: PayrollConceptModel): string {
    const paso: PayrollCalculationStepModel = {
      executionOrder: 1,
      conceptCode: concept.conceptCode,
      conceptMnemonic: concept.conceptMnemonic,
      calculationType: 'RATE_BY_QUANTITY',
      functionalNature: 'EARNING',
      executionScope: 'SEGMENT',
      segmentStartDate: '2026-09-16',
      segmentEndDate: '2026-09-30',
      amount: concept.amount!,
      quantity: concept.quantity,
      rate: concept.rate,
      payslipOrderCode: concept.conceptCode,
      payslipLineNumber: concept.lineNumber,
      sourceTableCode: null,
      sourceTableRowId: null,
    };

    const fixture = TestBed.createComponent(RecibosValorizacionPanelComponent);
    fixture.componentRef.setInput('concepts', [concept]);
    fixture.componentRef.setInput('steps', [paso]);
    fixture.componentRef.setInput('stepsLoaded', true);
    fixture.componentRef.setInput('stepsLoading', false);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const pestanas = Array.from(host.querySelectorAll('.tab')) as HTMLElement[];
    pestanas.find((t) => t.textContent?.includes('Cálculo'))!.click();
    fixture.detectChanges();

    const celdas = Array.from(
      host.querySelectorAll('.steps-table tbody .col-num-cell'),
    ) as HTMLElement[];
    // Cantidad, tarifa, importe: la tarifa es la segunda.
    return celdas[1].textContent?.trim() ?? '';
  }

  function linea(valores: { quantity: number; rate: number; amount: number }): PayrollConceptModel {
    return {
      lineNumber: 1,
      conceptCode: '101',
      conceptMnemonic: 'SALARIO_BASE',
      conceptLabel: 'Salario base',
      amount: valores.amount,
      quantity: valores.quantity,
      rate: valores.rate,
      conceptNatureCode: 'EARNING',
      originPeriodCode: '202609',
      displayOrder: 1,
      mergedStepCount: 1,
      payslipSectionCode: 'DEVENGOS',
      payslipSubsectionCode: null,
    };
  }

  function redondeoADos(value: number): number {
    return Math.round(value * 100) / 100;
  }
});
