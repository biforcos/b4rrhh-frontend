import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollCalculationStepModel } from '../models/payroll-calculation-step.model';
import { NODE_CLICKED_MESSAGE } from '../embed/designer-embed';
import { DESIGNER_FRAME_DEADLINE } from './recibos-valorizacion-grafo.component';
import { RecibosValorizacionPanelComponent } from './recibos-valorizacion-panel.component';

/**
 * Las dos vistas enlazadas: «Cálculo» y «Grafo» (`b4rrhh/frontend#66`, punto 2).
 *
 * El enlace en los dos sentidos es **lo que convierte dos vistas en una**, y el sitio donde se
 * rompe es el mes partido. Un nodo del grafo es UN concepto; en el mes partido a ese concepto le
 * corresponden DOS pasos, con dos segmentos y dos precios. De ahí salen las dos mitades del
 * criterio 4 del issue:
 *
 * - **Ida**: los dos pasos del `101` llevan al MISMO nodo. Cualquiera de los dos.
 * - **Vuelta**: el nodo del `101` señala los DOS pasos, no uno. Señalar uno escondería el segundo
 *   segmento, que es justo lo que esta pestaña está para enseñar.
 *
 * Se prueba con uno de los cinco del mes partido y no con un recibo cualquiera porque una
 * implementación que indexe por `conceptCode` acierta en 868 recibos de 873.
 */
describe('El enlace entre «Cálculo» y «Grafo»', () => {
  const EMP1: PayrollBusinessKey = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP000001',
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL',
    presenceNumber: 2,
  };

  /** Un trozo de recibo del mes partido: el `101` dos veces, con sus dos segmentos. */
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

  let fixture: ComponentFixture<RecibosValorizacionPanelComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RecibosValorizacionPanelComponent],
      providers: [
        { provide: DESIGNER_FRAME_DEADLINE, useValue: new Subject<void>().asObservable() },
      ],
    });

    fixture = TestBed.createComponent(RecibosValorizacionPanelComponent);
    fixture.componentRef.setInput('steps', MES_PARTIDO);
    fixture.componentRef.setInput('stepsLoaded', true);
    fixture.componentRef.setInput('payrollAddress', EMP1);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  describe('la tercera pestaña', () => {
    it('se suma a las dos que ya estaban, y no las sustituye', () => {
      const rotulos = Array.from(host.querySelectorAll('.tab')).map((t) => t.textContent?.trim());

      expect(rotulos).toEqual(['Recibo', 'Cálculo', 'Grafo']);
    });

    it('el cajón sigue abriendo por «Recibo»', () => {
      expect(fixture.componentInstance.view()).toBe('recibo');
    });

    /** Carga perezosa: quien no abre la pestaña no se descarga el diseñador entero. */
    it('no hay marco hasta que alguien abre «Grafo»', () => {
      expect(host.querySelector('iframe')).toBeNull();

      abrirGrafo();

      expect(host.querySelector('iframe')).not.toBeNull();
    });

    it('el marco apunta al recibo abierto, con su presencia', () => {
      abrirGrafo();

      const src = host.querySelector('iframe')?.getAttribute('src') ?? '';
      expect(src).toBe('/designer/recibo/ESP/INTERNAL/EMP000001/202609/NORMAL/2');
    });

    /**
     * Abrir «Grafo» pide los pasos, y no por el grafo —el diseñador pide los suyos— sino por el
     * enlace de vuelta: no se puede saltar al paso de un nodo si la lista no se ha pedido.
     */
    it('abrir «Grafo» pide los pasos, igual que «Cálculo»', () => {
      let peticiones = 0;
      fixture.componentInstance.stepsRequested.subscribe(() => peticiones++);

      abrirGrafo();

      expect(peticiones).toBe(1);
    });

    /**
     * Al cambiar de pestaña el marco se esconde, **no se desmonta**. Desmontarlo volvería a
     * descargar el bundle de React cada vez que se vuelve, y con él la espera que el issue mide.
     */
    it('al volver a «Cálculo» el marco sigue montado, sólo escondido', () => {
      abrirGrafo();
      const marco = host.querySelector('iframe');

      abrirCalculo();

      expect(host.querySelector('iframe')).toBe(marco);
      expect(host.querySelector('.grafo-host')?.classList.contains('grafo-hidden')).toBe(true);
    });
  });

  describe('ida: de un paso de «Cálculo» a su nodo del grafo', () => {
    it('pinchar un paso lleva a «Grafo» y pide centrarse en su concepto', () => {
      abrirCalculo();

      filaDe('B_CC').click();
      fixture.detectChanges();

      expect(fixture.componentInstance.view()).toBe('grafo');
      expect(fixture.componentInstance.focusRequest()?.conceptCode).toBe('B_CC');
    });

    /**
     * La mitad de ida del criterio 4: el `101` tiene un nodo y dos pasos, y **cualquiera de los
     * dos** lleva a ese nodo.
     */
    it('los dos pasos del 101 del mes partido llevan al mismo nodo', () => {
      abrirCalculo();
      const filas = filasDe('101');
      expect(filas).toHaveLength(2);

      filas[0].click();
      fixture.detectChanges();
      const primera = fixture.componentInstance.focusRequest();

      abrirCalculo();
      filasDe('101')[1].click();
      fixture.detectChanges();
      const segunda = fixture.componentInstance.focusRequest();

      expect(primera?.conceptCode).toBe('101');
      expect(segunda?.conceptCode).toBe('101');
      // Dos peticiones y no una: pinchar otra vez es pedir que se centre otra vez.
      expect(segunda?.seq).toBeGreaterThan(primera!.seq);
    });

    it('pinchar un paso monta el marco si la pestaña no se había abierto nunca', () => {
      abrirCalculo();
      expect(host.querySelector('iframe')).toBeNull();

      filaDe('B_CC').click();
      fixture.detectChanges();

      expect(host.querySelector('iframe')).not.toBeNull();
    });
  });

  describe('vuelta: de un nodo del grafo a su paso de «Cálculo»', () => {
    it('pinchar un nodo salta a «Cálculo» y señala el paso', () => {
      abrirGrafo();

      pincharNodo('B_CC');

      expect(fixture.componentInstance.view()).toBe('calculo');
      expect(filaDe('B_CC').classList.contains('step-highlighted')).toBe(true);
    });

    /**
     * La mitad de vuelta del criterio 4: el nodo es uno y los pasos son dos, así que se señalan los
     * dos. Quedarse con uno esconderia que el mes está partido.
     */
    it('el nodo del 101 señala los dos pasos, no uno', () => {
      abrirGrafo();

      pincharNodo('101');

      const señalados = filasDe('101').filter((f) => f.classList.contains('step-highlighted'));
      expect(señalados).toHaveLength(2);
    });

    it('no señala los pasos de otros conceptos', () => {
      abrirGrafo();

      pincharNodo('101');

      expect(filaDe('B_CC').classList.contains('step-highlighted')).toBe(false);
      expect(filaDe('D01').classList.contains('step-highlighted')).toBe(false);
    });

    it('un mensaje de otro origen no mueve la pestaña', () => {
      abrirGrafo();

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: NODE_CLICKED_MESSAGE, conceptCode: '101' },
          origin: 'https://otro.sitio',
        }),
      );
      fixture.detectChanges();

      expect(fixture.componentInstance.view()).toBe('grafo');
    });
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function pestaña(rotulo: string): HTMLElement {
    const pestañas = Array.from(host.querySelectorAll('.tab')) as HTMLElement[];
    return pestañas.find((t) => t.textContent?.includes(rotulo))!;
  }

  function abrirGrafo(): void {
    pestaña('Grafo').click();
    fixture.detectChanges();
  }

  function abrirCalculo(): void {
    pestaña('Cálculo').click();
    fixture.detectChanges();
  }

  function pincharNodo(conceptCode: string): void {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: NODE_CLICKED_MESSAGE, conceptCode },
        origin: window.location.origin,
      }),
    );
    fixture.detectChanges();
  }

  function filasDe(conceptCode: string): HTMLElement[] {
    return Array.from(
      host.querySelectorAll(`.steps-table tbody tr[data-concept="${conceptCode}"]`),
    ) as HTMLElement[];
  }

  function filaDe(conceptCode: string): HTMLElement {
    return filasDe(conceptCode)[0];
  }

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
      ...overrides,
    };
  }
});
