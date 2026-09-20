import { describe, expect, it } from 'vitest';

import { PayrollConceptModel } from '../models/payroll-concept.model';
import { lineasQueSeMovieron } from './lineas-movidas.util';

function linea(
  lineNumber: number,
  conceptCode: string,
  amount: number | null,
): PayrollConceptModel {
  return {
    lineNumber,
    conceptCode,
    conceptMnemonic: conceptCode,
    conceptLabel: conceptCode,
    amount,
    quantity: null,
    rate: null,
    conceptNatureCode: 'EARNING',
    originPeriodCode: '202609',
    displayOrder: lineNumber,
    mergedStepCount: 1,
    payslipSectionCode: 'DEVENGOS',
  };
}

/**
 * Qué se movió al recalcular, y qué no (`b4rrhh/frontend#71`).
 *
 * Es el cálculo que separa un resalte que informa de uno decorativo. Con un gloss global se ve «ha
 * pasado algo»; con el selectivo se ve **qué arrastra a qué**, que es la tesis del producto.
 */
describe('Las líneas que se movieron', () => {
  it('señala la que cambió de importe y deja quietas las demás', () => {
    const antes = [linea(1, '101', 1200), linea(2, '102', 90), linea(3, '990', 1100)];
    const despues = [linea(1, '101', 1350), linea(2, '102', 90), linea(3, '990', 1220)];

    expect([...lineasQueSeMovieron(antes, despues)].sort()).toEqual([1, 3]);
  });

  /**
   * El caso que distingue un resalte que informa de uno decorativo: recalcular sin haber tocado
   * nada. Lo que se mueve entonces es la hora, y las líneas se quedan quietas — que es enseñar que
   * el motor es determinista.
   */
  it('sin cambios no señala ninguna', () => {
    const recibo = [linea(1, '101', 1200), linea(2, '990', 1100)];

    expect(
      lineasQueSeMovieron(
        recibo,
        recibo.map((l) => ({ ...l })),
      ),
    ).toEqual(new Set());
  });

  it('una línea que antes no estaba cuenta como movida', () => {
    const movidas = lineasQueSeMovieron(
      [linea(1, '101', 1200)],
      [linea(1, '101', 1200), linea(2, '102', 90)],
    );

    expect(movidas).toEqual(new Set([2]));
  });

  /**
   * Los números de línea se recolocan cuando una desaparece —la regla del cero quita las que valen
   * cero—, así que emparejar por `lineNumber` compararía el salario con el IRPF y diría que se
   * movió todo. Se empareja por concepto.
   */
  it('no empareja por número de línea: una línea que desaparece no mueve a las de abajo', () => {
    const antes = [linea(1, '101', 1200), linea(2, '102', 90), linea(3, '990', 1100)];
    // Se van las horas extra; el 990 pasa de la línea 3 a la 2 sin cambiar de importe.
    const despues = [linea(1, '101', 1200), linea(2, '990', 1100)];

    expect(lineasQueSeMovieron(antes, despues)).toEqual(new Set());
  });

  /** Dos tramos del mismo concepto a precios distintos no se funden: se emparejan en orden. */
  it('empareja en orden las líneas repetidas del mismo concepto', () => {
    const antes = [linea(1, '101', 600), linea(2, '101', 600)];
    const despues = [linea(1, '101', 600), linea(2, '101', 675)];

    expect(lineasQueSeMovieron(antes, despues)).toEqual(new Set([2]));
  });

  it('un importe que pasa a nulo, o al revés, también se ha movido', () => {
    expect(lineasQueSeMovieron([linea(1, '101', 1200)], [linea(1, '101', null)])).toEqual(
      new Set([1]),
    );
    expect(lineasQueSeMovieron([linea(1, '101', null)], [linea(1, '101', 1200)])).toEqual(
      new Set([1]),
    );
    expect(lineasQueSeMovieron([linea(1, '101', null)], [linea(1, '101', null)])).toEqual(
      new Set(),
    );
  });
});
