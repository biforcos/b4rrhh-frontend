import { describe, expect, it } from 'vitest';

import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { marcaDePresencia } from './presencia.format';

/**
 * La presencia de un recibo sólo se dice cuando distingue algo (`b4rrhh/frontend#104`).
 *
 * «presencia 1» en cada fila era una palabra que no separaba una fila de otra. Se dice cuando es
 * mayor que 1, o cuando en la lista hay otra fila del mismo empleado y período —cesado y readmitido
 * en el mismo mes—, y entonces en las dos.
 */
describe('la marca de presencia de un recibo', () => {
  function recibo(employeeNumber: string, payrollPeriodCode: string, presenceNumber: number) {
    return {
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber,
      payrollPeriodCode,
      payrollTypeCode: 'NORMAL',
      presenceNumber,
      status: 'CALCULATED',
      calculatedAt: '2026-09-27T20:28:20Z',
    } satisfies PayrollSummaryModel;
  }

  it('presencia 1 sin hermana: nada', () => {
    const solo = recibo('EMP000001', '202609', 1);
    expect(marcaDePresencia(solo, [solo, recibo('EMP000002', '202609', 1)])).toBeNull();
  });

  it('presencia 1 con hermana del mismo mes: marca en las dos', () => {
    const primera = recibo('EMP000467', '202604', 1);
    const segunda = recibo('EMP000467', '202604', 2);
    const lista = [primera, segunda, recibo('EMP000468', '202604', 1)];

    expect(marcaDePresencia(primera, lista)).toBe('1.ª presencia');
    expect(marcaDePresencia(segunda, lista)).toBe('2.ª presencia');
  });

  it('una presencia de otro mes del mismo empleado no es hermana', () => {
    const abril = recibo('EMP000467', '202604', 1);
    expect(marcaDePresencia(abril, [abril, recibo('EMP000467', '202605', 1)])).toBeNull();
  });

  it('presencia mayor que 1, aunque vaya sola: marca', () => {
    const readmitido = recibo('EMP000001', '202609', 2);
    expect(marcaDePresencia(readmitido, [readmitido])).toBe('2.ª presencia');
  });
});
