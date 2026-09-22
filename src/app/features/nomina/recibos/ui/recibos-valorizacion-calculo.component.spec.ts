import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PayrollCalculationStepModel } from '../models/payroll-calculation-step.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosValorizacionPanelComponent } from './recibos-valorizacion-panel.component';

/**
 * La pestaña «Cálculo» de la Valorización (`b4rrhh/frontend#65`).
 *
 * Es el primer sitio en el que se ven los pasos que el motor guardó desde el `b4rrhh/backend#93`:
 * los 35 que dio para llegar a las 14 líneas del recibo, en el orden en que los dio.
 *
 * Lo que este test sujeta son **las trampas del issue**, y las dos primeras son las que rompen
 * cualquier implementación que parezca correcta:
 *
 * 1. **El mismo concepto sale dos veces.** En los cinco empleados del mes partido el `101` aparece
 *    con dos segmentos y dos precios. Indexar o agrupar por `conceptCode` enseña uno y se come el
 *    otro, y acierta en 868 recibos de 873 — por eso se prueba con uno de los cinco y no con uno
 *    cualquiera.
 * 2. **Un recibo sin pasos no es un recibo sin conceptos.** Los 873 de la semilla se calcularon
 *    antes de que el motor los guardara, y la pestaña tiene que decirlo con palabras.
 * 3. **No se suma la columna de importes.** Los pasos incluyen bases y técnicos; su suma no es
 *    nada.
 * 4. **Se marca quién llegó al folio con `payslipOrderCode`**, no con la naturaleza.
 */
describe('La pestaña «Cálculo» de la Valorización', () => {
  /**
   * Un trozo de un recibo del mes partido, con el `101` dos veces.
   *
   * Los números son los de verdad: `executionOrder` del 1 al 39 con el `101` en el 8 y el 9, el
   * mismo `payslipOrderCode` en los dos —que es justo por lo que ese campo tampoco vale como clave
   * de fila— y dos tarifas distintas porque la jornada cambia a mitad de mes.
   */
  const MES_PARTIDO: PayrollCalculationStepModel[] = [
    paso({ executionOrder: 1, conceptCode: 'D01', conceptMnemonic: 'DIAS_NATURALES' }),
    paso({
      executionOrder: 8,
      conceptCode: '101',
      conceptMnemonic: 'SALARIO_BASE',
      functionalNature: 'EARNING',
      executionScope: 'SEGMENT',
      segmentStartDate: '2025-04-01',
      segmentEndDate: '2025-04-15',
      amount: 750,
      rate: 50,
      payslipOrderCode: '101',
    }),
    paso({
      executionOrder: 9,
      conceptCode: '101',
      conceptMnemonic: 'SALARIO_BASE',
      functionalNature: 'EARNING',
      executionScope: 'SEGMENT',
      segmentStartDate: '2025-04-16',
      segmentEndDate: '2025-04-30',
      amount: 375,
      rate: 25,
      payslipOrderCode: '101',
    }),
    paso({
      executionOrder: 13,
      conceptCode: 'B_CC',
      conceptMnemonic: 'BASE_CC',
      functionalNature: 'BASE',
      amount: 1125,
    }),
  ];

  /**
   * La trampa 1 del issue, y la que el mes partido existe para probar.
   *
   * Se comprueba sobre el DOM y no sobre el array: lo que se come una de las dos filas es el
   * `track` de la plantilla, y un test que mire la lista de entrada pasaría en verde con el fallo
   * puesto.
   */
  it('en un empleado del mes partido el 101 sale dos veces, cada uno con su segmento', () => {
    const filas = filasDeCalculo(MES_PARTIDO);

    const delSalarioBase = filas.filter((fila) => celda(fila, 2) === '101');
    expect(delSalarioBase).toHaveLength(2);

    // Dos pasos distintos: lo que los separa es el orden de ejecución, que es la clave de fila.
    expect(celda(delSalarioBase[0], 1)).toBe('8');
    expect(celda(delSalarioBase[1], 1)).toBe('9');

    // Con sus dos segmentos y sus dos precios, que es lo que los hace dos y no uno repetido.
    expect(textoDe(delSalarioBase[0])).toContain('01/04 – 15/04');
    expect(textoDe(delSalarioBase[1])).toContain('16/04 – 30/04');
    expect(celda(delSalarioBase[0], 5)).toBe('50,00');
    expect(celda(delSalarioBase[1], 5)).toBe('25,00');

    // Y el orden de folio es el MISMO en los dos, que es por lo que tampoco vale como clave.
    expect(celda(delSalarioBase[0], 7)).toBe('101');
    expect(celda(delSalarioBase[1], 7)).toBe('101');
  });

  it('los pasos salen en el orden en que el motor los ejecutó, no en el del folio', () => {
    const ordenes = filasDeCalculo(MES_PARTIDO).map((fila) => celda(fila, 1));

    expect(ordenes).toEqual(['1', '8', '9', '13']);
  });

  /**
   * La trampa 2: vacío con motivo.
   *
   * Un panel vacío y mudo es indistinguible de «no hay nada que explicar». La pestaña tiene que
   * decir por qué no hay pasos, y decir además que el recibo sí tiene conceptos: son dos cosas
   * distintas y la lista vacía no significa la segunda.
   */
  it('un recibo sin pasos dice por qué no los tiene, y que sus conceptos siguen ahí', () => {
    const folio = render({ steps: [], stepsLoaded: true, concepts: CATORCE_LINEAS });
    abrirCalculo(folio);

    const texto = folio.querySelector('.empty-with-reason')?.textContent ?? '';
    expect(texto).toContain('Se calculó antes de que el motor guardara sus pasos');
    expect(texto).toContain('Recalcúlalo para verlos');
    expect(texto).toContain('14 líneas');
    expect(folio.querySelector('.steps-table')).toBeNull();
  });

  /**
   * Y el vacío de «todavía no han llegado» no se confunde con el de «no hay».
   *
   * Sin esta diferencia, la pestaña acusaría a un recibo perfectamente normal de haberse calculado
   * antes de la V129 durante el tiempo que tarda la petición.
   */
  it('mientras los pasos vienen de camino no se dice que el recibo no los tenga', () => {
    const cargando = render({ steps: [], stepsLoaded: false, stepsLoading: true });
    abrirCalculo(cargando);

    expect(cargando.querySelector('.empty-with-reason')).toBeNull();
    expect(cargando.textContent).toContain('Cargando los pasos del cálculo');
  });

  /** La trampa 3: la columna de importes no se suma, así que no hay fila de totales. */
  it('la tabla de pasos no tiene fila de totales', () => {
    const folio = render({ steps: MES_PARTIDO, stepsLoaded: true });
    abrirCalculo(folio);

    expect(folio.querySelector('.steps-table tfoot')).toBeNull();
    expect(folio.querySelector('.steps-note')?.textContent).toContain('no se suma');
  });

  /** La trampa 4: quién llegó al folio sale de `payslipOrderCode`, no de la naturaleza. */
  it('los pasos que llegaron al folio se distinguen de los que no', () => {
    const filas = filasDeCalculo(MES_PARTIDO);

    const conFolio = filas.filter((fila) => fila.classList.contains('step-on-payslip'));
    expect(conFolio.map((fila) => celda(fila, 2))).toEqual(['101', '101']);

    // El B_CC es un BASE sin orden de folio: se calcula, se guarda y no se imprime.
    const sinFolio = filas.filter((fila) => !fila.classList.contains('step-on-payslip'));
    expect(sinFolio.map((fila) => celda(fila, 2))).toEqual(['D01', 'B_CC']);
    expect(celda(sinFolio[1], 7)).toBe('—');
  });

  it('la búsqueda del panel vale igual en los pasos, por código y por concepto', () => {
    const fixture = TestBed.createComponent(RecibosValorizacionPanelComponent);
    fixture.componentRef.setInput('steps', MES_PARTIDO);
    fixture.detectChanges();

    fixture.componentInstance.searchTerm.set('salario');
    expect(fixture.componentInstance.filteredSteps().map((s) => s.executionOrder)).toEqual([8, 9]);

    fixture.componentInstance.searchTerm.set('B_CC');
    expect(fixture.componentInstance.filteredSteps().map((s) => s.executionOrder)).toEqual([13]);
  });

  /** Y el filtro que no encuentra nada no se disfraza del recibo sin pasos. */
  it('una búsqueda sin resultados no dice que el recibo se calculara antes de la V129', () => {
    const fixture = TestBed.createComponent(RecibosValorizacionPanelComponent);
    fixture.componentRef.setInput('steps', MES_PARTIDO);
    fixture.componentRef.setInput('stepsLoaded', true);
    fixture.detectChanges();
    fixture.componentInstance.showCalculo();
    fixture.componentInstance.searchTerm.set('no-existe');
    fixture.detectChanges();

    const folio = fixture.nativeElement as HTMLElement;
    expect(folio.querySelector('.empty-with-reason')).toBeNull();
    expect(folio.textContent).toContain('Sin resultados');
  });

  /**
   * Abrir «Cálculo» es lo que pide los pasos, y abrir el cajón no.
   *
   * Son 35 o 39 filas por recibo, y quien abre la Valorización para mirar las líneas no tiene por
   * qué pagarlas.
   */
  it('los pasos se piden al abrir la pestaña, no al abrir el cajón', () => {
    const fixture = TestBed.createComponent(RecibosValorizacionPanelComponent);
    let peticiones = 0;
    fixture.componentInstance.stepsRequested.subscribe(() => peticiones++);
    fixture.detectChanges();

    expect(peticiones).toBe(0);

    fixture.componentInstance.showCalculo();
    expect(peticiones).toBe(1);
  });

  /** El «Recibo» es el documento y no se toca: sigue siendo la vista con la que el cajón abre. */
  it('el cajón abre por la pestaña «Recibo», que es la de siempre', () => {
    const fixture = TestBed.createComponent(RecibosValorizacionPanelComponent);
    fixture.componentRef.setInput('concepts', CATORCE_LINEAS);
    fixture.detectChanges();

    expect(fixture.componentInstance.view()).toBe('recibo');
    const folio = fixture.nativeElement as HTMLElement;
    expect(folio.querySelector('.steps-table')).toBeNull();
    expect(folio.querySelectorAll('.val-table tbody tr')).toHaveLength(CATORCE_LINEAS.length);
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function paso(
    overrides: Partial<PayrollCalculationStepModel> &
      Pick<PayrollCalculationStepModel, 'executionOrder' | 'conceptCode' | 'conceptMnemonic'>,
  ): PayrollCalculationStepModel {
    return {
      calculationType: 'DIRECT_AMOUNT',
      functionalNature: 'TECHNICAL',
      executionScope: 'PERIOD',
      segmentStartDate: null,
      segmentEndDate: null,
      amount: 0,
      quantity: null,
      rate: null,
      payslipOrderCode: null,
      // El caso normal desde el backend#103: un paso que no se imprime no tiene linea.
      payslipLineNumber: null,
      sourceTableCode: null,
      sourceTableRowId: null,
      ...overrides,
    };
  }

  const CATORCE_LINEAS: PayrollConceptModel[] = Array.from({ length: 14 }, (_, i) => ({
    lineNumber: i + 1,
    conceptCode: `C${i + 1}`,
    conceptMnemonic: `CONCEPTO_${i + 1}`,
    conceptLabel: `Concepto ${i + 1}`,
    amount: 10,
    quantity: null,
    rate: null,
    conceptNatureCode: 'EARNING',
    originPeriodCode: '202609',
    displayOrder: i + 1,
    // Ninguna funde nada: es el caso que no ensena marca (backend#103).
    mergedStepCount: 1,
    payslipSectionCode: 'DEVENGOS',
    payslipSubsectionCode: null,
  }));

  function render(inputs: {
    steps?: ReadonlyArray<PayrollCalculationStepModel>;
    concepts?: ReadonlyArray<PayrollConceptModel>;
    stepsLoaded?: boolean;
    stepsLoading?: boolean;
  }): HTMLElement {
    const fixture = TestBed.createComponent(RecibosValorizacionPanelComponent);
    fixture.componentRef.setInput('steps', inputs.steps ?? []);
    fixture.componentRef.setInput('concepts', inputs.concepts ?? []);
    fixture.componentRef.setInput('stepsLoaded', inputs.stepsLoaded ?? false);
    fixture.componentRef.setInput('stepsLoading', inputs.stepsLoading ?? false);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    (host as HTMLElement & { _fixture?: unknown })._fixture = fixture;
    return host;
  }

  function abrirCalculo(host: HTMLElement): void {
    const pestañas = Array.from(host.querySelectorAll('.tab')) as HTMLElement[];
    pestañas.find((t) => t.textContent?.includes('Cálculo'))!.click();
    const fixture = (host as HTMLElement & { _fixture?: { detectChanges(): void } })._fixture;
    fixture?.detectChanges();
  }

  function filasDeCalculo(steps: ReadonlyArray<PayrollCalculationStepModel>): HTMLElement[] {
    const host = render({ steps, stepsLoaded: true });
    abrirCalculo(host);
    return Array.from(host.querySelectorAll('.steps-table tbody tr')) as HTMLElement[];
  }

  function celda(fila: HTMLElement, index: number): string {
    return fila.querySelectorAll('td')[index]?.textContent?.trim() ?? '';
  }

  function textoDe(fila: HTMLElement): string {
    return fila.textContent ?? '';
  }
});
