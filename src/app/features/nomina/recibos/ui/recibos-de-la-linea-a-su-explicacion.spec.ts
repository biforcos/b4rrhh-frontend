import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { ArrearExplanationModel } from '../models/arrear-explanation.model';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosStore } from '../store/recibos.store';
import { RecibosFolioComponent } from './recibos-folio.component';

const KEY: PayrollBusinessKey = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000025',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 1,
};

const linea = (o: Partial<PayrollConceptModel>): PayrollConceptModel => ({
  lineNumber: 1,
  conceptCode: '101',
  conceptMnemonic: 'SALARIO_BASE',
  conceptLabel: 'Salario base',
  amount: 712.5,
  quantity: 15,
  rate: 47.5,
  conceptNatureCode: 'EARNING',
  originPeriodCode: '202609',
  displayOrder: 101,
  payslipSectionCode: 'DEVENGOS',
  payslipSubsectionCode: null,
  mergedStepCount: 1,
  ...o,
});

const ATRASO = linea({
  lineNumber: 3,
  conceptCode: '102',
  conceptLabel: 'Horas extraordinarias',
  amount: -83.16,
  quantity: null,
  rate: null,
  originPeriodCode: '202607',
});

const EXPLICACIONES: ArrearExplanationModel[] = [
  {
    originPeriodCode: '202607',
    conceptCode: '102',
    conceptLabel: 'Horas extraordinarias',
    lineAmount: -83.16,
    currentValue: 0,
    currentValueCalculatedAt: null,
    alreadyPaid: 83.16,
    paidIn: [{ payrollPeriodCode: '202608', amount: 83.16 }],
    difference: -83.16,
    addsUp: true,
  },
];

/**
 * De una línea del folio a su explicación en un clic (`b4rrhh/frontend#93`): el folio dice qué
 * línea se ha pulsado, y el store sabe explicarla.
 */
describe('De una línea del folio a su explicación', () => {
  it('pulsar el concepto de una línea la pide', () => {
    const fixture = TestBed.createComponent(RecibosFolioComponent);
    fixture.componentRef.setInput('concepts', [linea({}), ATRASO]);
    fixture.componentRef.setInput('payslipSections', [
      { sectionCode: 'DEVENGOS', label: 'Devengos', displayOrder: 10 },
    ]);
    fixture.componentRef.setInput('payrollPeriodCode', '202609');
    fixture.detectChanges();
    const pedidas: PayrollConceptModel[] = [];
    fixture.componentInstance.lineRequested.subscribe((l) => pedidas.push(l));

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[aria-label="De dónde sale Horas extraordinarias"]')!
      .click();

    expect(pedidas).toEqual([ATRASO]);
  });

  it('una línea de atraso pide sus tres números una sola vez por recibo y encuentra los suyos', () => {
    const explainArrears = vi.fn(() => of(EXPLICACIONES));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: RecibosGateway,
          useValue: {
            explainArrears,
            getPayslipSections: () => of([]),
            getDetail: () => of(),
            listCalculationSteps: () => of([]),
          },
        },
      ],
    });
    const store = TestBed.inject(RecibosStore);
    (
      store as unknown as { selectedKeyState: { set(k: PayrollBusinessKey): void } }
    ).selectedKeyState.set(KEY);

    store.explainLine(ATRASO);
    store.explainLine(ATRASO);

    expect(explainArrears).toHaveBeenCalledTimes(1);
    expect(store.explainedLine()).toEqual(ATRASO);
    expect(store.explainedArrear()?.difference).toBe(-83.16);
  });

  it('una línea normal no pide nada al backend: se explica con lo que ya trae', () => {
    const explainArrears = vi.fn(() => of(EXPLICACIONES));
    TestBed.configureTestingModule({
      providers: [
        { provide: RecibosGateway, useValue: { explainArrears, getPayslipSections: () => of([]) } },
      ],
    });
    const store = TestBed.inject(RecibosStore);
    (
      store as unknown as { selectedKeyState: { set(k: PayrollBusinessKey): void } }
    ).selectedKeyState.set(KEY);

    store.explainLine(linea({}));

    expect(explainArrears).not.toHaveBeenCalled();
    expect(store.explainedArrear()).toBeNull();
  });
});
