import { convertToParamMap } from '@angular/router';

import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import {
  arePayrollBusinessKeysEqual,
  buildPayrollDetailRouteCommands,
  buildPayrollKeyRoutePath,
  readPayrollBusinessKeyFromParamMap,
} from './payroll-route-key.util';

const KEY: PayrollBusinessKey = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000001',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 1,
};

function paramMapOf(key: PayrollBusinessKey, overrides: Record<string, string> = {}) {
  return convertToParamMap({
    ruleSystemCode: key.ruleSystemCode,
    employeeTypeCode: key.employeeTypeCode,
    employeeNumber: key.employeeNumber,
    payrollPeriodCode: key.payrollPeriodCode,
    payrollTypeCode: key.payrollTypeCode,
    presenceNumber: String(key.presenceNumber),
    ...overrides,
  });
}

describe('payroll-route-key.util', () => {
  it('declares the six segments of the business key, in order', () => {
    expect(buildPayrollKeyRoutePath()).toBe(
      ':ruleSystemCode/:employeeTypeCode/:employeeNumber/:payrollPeriodCode/:payrollTypeCode/:presenceNumber',
    );
  });

  it('builds the address under the recibos segment', () => {
    expect(buildPayrollDetailRouteCommands(KEY)).toEqual([
      '/nomina/recibos',
      'ESP',
      'INTERNAL',
      'EMP000001',
      '202609',
      'NORMAL',
      1,
    ]);
  });

  it('reads back the key it wrote', () => {
    expect(readPayrollBusinessKeyFromParamMap(paramMapOf(KEY))).toEqual(KEY);
  });

  /**
   * El criterio 3 del `frontend#64`: un empleado con el mes partido tiene dos recibos del mismo
   * periodo. Sólo el número de presencia los separa, así que las dos direcciones tienen que
   * diferenciarse en ese segmento y en ningún otro.
   */
  it('gives a split month two different addresses that differ only in the presence number', () => {
    const presencia1 = buildPayrollDetailRouteCommands({ ...KEY, presenceNumber: 1 });
    const presencia2 = buildPayrollDetailRouteCommands({ ...KEY, presenceNumber: 2 });

    expect(presencia1).not.toEqual(presencia2);
    expect(presencia1.slice(0, 6)).toEqual(presencia2.slice(0, 6));
    expect(readPayrollBusinessKeyFromParamMap(paramMapOf({ ...KEY, presenceNumber: 2 }))).toEqual({
      ...KEY,
      presenceNumber: 2,
    });
    expect(
      arePayrollBusinessKeysEqual(
        readPayrollBusinessKeyFromParamMap(paramMapOf({ ...KEY, presenceNumber: 1 })),
        readPayrollBusinessKeyFromParamMap(paramMapOf({ ...KEY, presenceNumber: 2 })),
      ),
    ).toBe(false);
  });

  it('accepts EXTRA as a payroll type', () => {
    const extra = readPayrollBusinessKeyFromParamMap(paramMapOf(KEY, { payrollTypeCode: 'EXTRA' }));
    expect(extra?.payrollTypeCode).toBe('EXTRA');
  });

  it.each([
    ['un tipo de nómina que no existe', { payrollTypeCode: 'PAGA_EXTRA' }],
    ['un tipo de nómina en minúsculas', { payrollTypeCode: 'normal' }],
    ['un número de presencia que no es un número', { presenceNumber: 'primera' }],
    ['un número de presencia con decimales', { presenceNumber: '1.5' }],
    ['un número de presencia negativo', { presenceNumber: '-1' }],
    ['un número de presencia cero', { presenceNumber: '0' }],
    ['un segmento vacío', { employeeNumber: '   ' }],
  ])('rejects %s', (_name, overrides) => {
    expect(readPayrollBusinessKeyFromParamMap(paramMapOf(KEY, overrides))).toBeNull();
  });

  it('rejects a param map without the key', () => {
    expect(readPayrollBusinessKeyFromParamMap(convertToParamMap({}))).toBeNull();
  });

  it('trims the segments', () => {
    const key = readPayrollBusinessKeyFromParamMap(
      paramMapOf(KEY, { employeeNumber: ' EMP000001 ' }),
    );
    expect(key?.employeeNumber).toBe('EMP000001');
  });
});
