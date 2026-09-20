import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { RecibosStore } from './recibos.store';

const KEY: PayrollBusinessKey = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP001000',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 2,
};

function recibo(status: PayrollSummaryModel['status']): PayrollSummaryModel {
  return { ...KEY, status, calculatedAt: '2026-09-14T22:03:48' };
}

function linea(lineNumber: number, conceptCode: string, amount: number): PayrollConceptModel {
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
 * El resalte del recálculo, visto desde el estado (`b4rrhh/frontend#71`).
 *
 * El recálculo es el pago de toda la demo y hoy es una página que se vuelve a pintar: el visitante
 * tiene que comparar dos estados que no puede ver a la vez, de memoria. Para poder compararlos hay
 * que **no tirar el recibo anterior hasta haber hecho el diff**, y eso es lo único que esto toca de
 * lo que ya existía.
 */
describe('El resalte del recálculo', () => {
  let concepts: ReadonlyArray<PayrollConceptModel>;
  let store: RecibosStore;

  beforeEach(() => {
    concepts = [linea(1, '101', 1200), linea(2, '102', 90), linea(3, '990', 1100)];

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RecibosGateway,
          useValue: {
            getPayslipSections: () => of([]),
            invalidate: () => of(recibo('NOT_VALID')),
            recalculate: () => of(recibo('CALCULATED')),
            getDetail: () =>
              of({
                summary: recibo('CALCULATED'),
                runId: null,
                rulesChangedSinceCalculation: false,
                concepts,
                companyProfile: null,
                employeeProfile: null,
                agreementProfile: null,
                presenceStartDate: null,
                presenceEndDate: null,
                seniorityDate: null,
                workCenterCode: null,
                workCenterName: null,
              }),
          },
        },
      ],
    });
    store = TestBed.inject(RecibosStore);
  });

  /** Abrir un recibo no anima nada: no hay dos estados que comparar, hay uno. */
  it('abrir un recibo no mueve nada', () => {
    store.selectPayroll(KEY);

    expect(store.lineasMovidas()).toEqual(new Set());
    expect(store.recalculoSeq()).toBe(0);
  });

  it('recalcular tras un cambio señala sólo las líneas que cambiaron de valor', () => {
    store.selectPayroll(KEY);

    // Sube el precio día: se mueven el salario y el líquido, y las horas extra no.
    concepts = [linea(1, '101', 1350), linea(2, '102', 90), linea(3, '990', 1220)];
    store.recalculateFrom(KEY, 'CALCULATED');

    expect([...store.lineasMovidas()].sort()).toEqual([1, 3]);
    expect(store.recalculoSeq()).toBe(1);
  });

  /**
   * El criterio que distingue un resalte que informa de uno decorativo: el contador se mueve —la
   * hora también— y el conjunto de líneas se queda vacío.
   */
  it('recalcular sin haber cambiado nada mueve la hora y deja las líneas quietas', () => {
    store.selectPayroll(KEY);
    store.recalculateFrom(KEY, 'CALCULATED');

    expect(store.lineasMovidas()).toEqual(new Set());
    expect(store.recalculoSeq()).toBe(1);
  });

  /** Y abrir otro recibo después lo apaga: el resalte era de aquel recálculo, no de la pantalla. */
  it('el resalte no sobrevive a abrir otro recibo', () => {
    store.selectPayroll(KEY);
    concepts = [linea(1, '101', 1350), linea(2, '102', 90), linea(3, '990', 1220)];
    store.recalculateFrom(KEY, 'CALCULATED');
    expect(store.lineasMovidas().size).toBeGreaterThan(0);

    store.selectPayroll({ ...KEY, employeeNumber: 'EMP000003' });

    expect(store.lineasMovidas()).toEqual(new Set());
  });
});
