import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PayrollCalculationStepModel } from '../models/payroll-calculation-step.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosValorizacionPanelComponent } from './recibos-valorizacion-panel.component';

/**
 * Una línea que funde varios pasos lo dice, y un recibo sin fusiones no enseña nada
 * (`b4rrhh/backend#103`).
 *
 * El folio agrupa por `concepto|tarifa` y suma, así que **dos tramos al mismo precio salen en una
 * sola línea aunque no sean contiguos**. La línea es correcta y cuenta una historia falsa, y a la
 * vez la pestaña «Cálculo» enseña los dos pasos: las dos pantallas discrepaban en el número de
 * filas y ninguna explicaba por qué.
 *
 * **El criterio que se olvida es el segundo test**: una marca que sale siempre no marca nada. Por
 * eso van separados — con un solo test que mirase el caso fundido, una implementación que pintara
 * la marca en todas las filas pasaría.
 */
describe('La fusión de líneas se dice, y sólo cuando la hay', () => {
  /**
   * Cuatro tramos a dos precios, como el caso del issue: los tramos 1 y 3 comparten precio **sin
   * ser contiguos**, así que el folio los funde en la línea 1, y los 2 y 4 en la línea 2.
   */
  const CUATRO_TRAMOS: PayrollCalculationStepModel[] = [
    paso(1, '2025-01-01', '2025-01-10', 100, 1),
    paso(2, '2025-01-11', '2025-01-15', 50, 2),
    paso(3, '2025-01-16', '2025-01-22', 100, 1),
    paso(4, '2025-01-23', '2025-01-31', 50, 2),
  ];

  const DOS_LINEAS_FUNDIDAS: PayrollConceptModel[] = [linea(1, 1700, 2), linea(2, 700, 2)];

  it('un paso que comparte línea con otro dice con cuántos y cuál', () => {
    const root = render({ steps: CUATRO_TRAMOS, concepts: DOS_LINEAS_FUNDIDAS });

    const marcas = root.querySelectorAll('.step-merged');
    expect(marcas.length).toBe(4);
    expect(marcas[0].textContent).toContain('línea 1');
    expect(marcas[0].textContent).toContain('2 tramos');
    expect(marcas[1].textContent).toContain('línea 2');
  });

  /**
   * El criterio 5 del issue. Cuatro pasos, cada uno a su línea: no hay nada que explicar y no se
   * pinta nada.
   */
  it('sin fusiones no aparece ninguna marca', () => {
    const cadaUnoALoSuyo: PayrollCalculationStepModel[] = [
      paso(1, '2025-01-01', '2025-01-10', 100, 1),
      paso(2, '2025-01-11', '2025-01-15', 50, 2),
      paso(3, '2025-01-16', '2025-01-22', 70, 3),
      paso(4, '2025-01-23', '2025-01-31', 30, 4),
    ];

    const root = render({
      steps: cadaUnoALoSuyo,
      concepts: [linea(1, 1000, 1), linea(2, 250, 1), linea(3, 490, 1), linea(4, 270, 1)],
    });

    expect(root.querySelectorAll('.step-merged').length).toBe(0);
  });

  /** Y un paso que no llegó al folio tampoco: no tiene línea que compartir. */
  it('un paso que no se imprime no dice nada de líneas', () => {
    const tecnico: PayrollCalculationStepModel = {
      ...paso(1, null, null, null, null),
      conceptCode: 'J01',
      conceptMnemonic: 'COEFICIENTE_JORNADA',
      payslipOrderCode: null,
      payslipLineNumber: null,
      executionScope: 'PERIOD',
    };

    const root = render({ steps: [tecnico], concepts: [] });

    expect(root.querySelectorAll('.step-merged').length).toBe(0);
  });

  function paso(
    executionOrder: number,
    segmentStartDate: string | null,
    segmentEndDate: string | null,
    rate: number | null,
    payslipLineNumber: number | null,
  ): PayrollCalculationStepModel {
    return {
      executionOrder,
      conceptCode: '101',
      conceptMnemonic: 'SALARIO_BASE',
      calculationType: 'RATE_BY_QUANTITY',
      functionalNature: 'EARNING',
      executionScope: 'SEGMENT',
      segmentStartDate,
      segmentEndDate,
      amount: 100,
      quantity: 10,
      rate,
      payslipOrderCode: '101',
      payslipLineNumber,
    };
  }

  function linea(lineNumber: number, amount: number, mergedStepCount: number): PayrollConceptModel {
    return {
      lineNumber,
      conceptCode: '101',
      conceptLabel: 'Salario base',
      amount,
      quantity: null,
      rate: null,
      conceptNatureCode: 'EARNING',
      originPeriodCode: '202501',
      displayOrder: lineNumber,
      mergedStepCount,
    };
  }

  function render(inputs: {
    steps: ReadonlyArray<PayrollCalculationStepModel>;
    concepts: ReadonlyArray<PayrollConceptModel>;
  }): HTMLElement {
    const fixture = TestBed.createComponent(RecibosValorizacionPanelComponent);
    fixture.componentRef.setInput('steps', inputs.steps);
    fixture.componentRef.setInput('concepts', inputs.concepts);
    fixture.componentRef.setInput('stepsLoaded', true);
    fixture.componentRef.setInput('stepsLoading', false);
    fixture.detectChanges();

    // La pestaña «Cálculo» no está abierta por omisión: el panel arranca en el recibo.
    const host = fixture.nativeElement as HTMLElement;
    const pestanas = Array.from(host.querySelectorAll('.tab')) as HTMLElement[];
    pestanas.find((t) => t.textContent?.includes('Cálculo'))!.click();
    fixture.detectChanges();
    return host;
  }
});
