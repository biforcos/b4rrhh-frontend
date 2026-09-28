import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ArrearExplanationModel } from '../models/arrear-explanation.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosLineaExplicadaComponent } from './recibos-linea-explicada.component';

const linea = (o: Partial<PayrollConceptModel> = {}): PayrollConceptModel => ({
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

/** La línea de atraso de EMP000025 en su recibo de 202609, con los números del backend. */
const ATRASO = linea({
  lineNumber: 3,
  conceptCode: '102',
  conceptLabel: 'Horas extraordinarias',
  amount: -83.16,
  quantity: null,
  rate: null,
  originPeriodCode: '202607',
  mergedStepCount: 0,
});
const SU_EXPLICACION: ArrearExplanationModel = {
  originPeriodCode: '202607',
  conceptCode: '102',
  conceptLabel: 'Horas extraordinarias',
  lineAmount: -83.16,
  currentValue: 0,
  currentValueCalculatedAt: '2026-09-27T20:26:07Z',
  alreadyPaid: 83.16,
  paidIn: [{ payrollPeriodCode: '202608', amount: 83.16 }],
  difference: -83.16,
  addsUp: true,
};

/**
 * De una línea del folio a su explicación, en un clic (`b4rrhh/frontend#93`). Es lo que más va a
 * preguntar un usuario: de dónde sale este número. Una línea normal se explica con cantidad por
 * tarifa y sus pasos; una de atraso, con tres números — lo que el mes vale hoy, lo que ya se pagó
 * por él y la diferencia — que el backend ya daba (`backend#134`) y la pantalla no enseñaba.
 */
describe('RecibosLineaExplicadaComponent', () => {
  function montar(concept: PayrollConceptModel, explanation: ArrearExplanationModel | null) {
    TestBed.configureTestingModule({ imports: [RecibosLineaExplicadaComponent] });
    const fixture: ComponentFixture<RecibosLineaExplicadaComponent> = TestBed.createComponent(
      RecibosLineaExplicadaComponent,
    );
    fixture.componentRef.setInput('concept', concept);
    fixture.componentRef.setInput('payrollPeriodCode', '202609');
    fixture.componentRef.setInput('arrear', explanation);
    fixture.detectChanges();
    return fixture;
  }

  const texto = (fixture: ComponentFixture<unknown>) =>
    ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  it('una línea de atraso: lo que vale hoy, lo que ya se pagó y la diferencia', () => {
    const t = texto(montar(ATRASO, SU_EXPLICACION));
    expect(t).toContain('07/2026');
    expect(t).toContain('Hoy vale 0,00');
    expect(t).toContain('Ya se pagó 83,16');
    expect(t).toContain('en el recibo de 08/2026: 83,16');
    expect(t).toContain('0,00 − 83,16 = -83,16');
  });

  it('si los tres números no cuadran con la línea, lo dice en vez de esconderlo', () => {
    const t = texto(montar(ATRASO, { ...SU_EXPLICACION, addsUp: false }));
    expect(t).toContain('no cuadra');
  });

  it('una línea de atraso sin su explicación cargada todavía no inventa números', () => {
    const t = texto(montar(ATRASO, null));
    expect(t).toContain('Cargando');
    expect(t).not.toContain('Hoy vale');
  });

  it('una línea normal: cantidad por tarifa, y a un clic sus pasos', () => {
    const fixture = montar(linea(), null);
    expect(texto(fixture)).toContain('15,00 × 47,50 = 712,50');
    let pedidos = 0;
    fixture.componentInstance.stepsRequested.subscribe(() => (pedidos += 1));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.linea-explicada__pasos')!
      .click();
    expect(pedidos).toBe(1);
  });

  it('una línea sin cantidad ni tarifa no pinta una multiplicación vacía', () => {
    const fixture = montar(linea({ quantity: null, rate: null, amount: 66.98 }), null);
    const cuenta = (fixture.nativeElement as HTMLElement).querySelector(
      '.linea-explicada__cuenta-simple',
    )!.textContent!;
    expect(cuenta).not.toContain('×');
    expect(cuenta).toContain('66,98');
  });
});
