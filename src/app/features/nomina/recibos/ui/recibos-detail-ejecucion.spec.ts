import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { RecibosStore } from '../store/recibos.store';
import { RecibosDetailComponent } from './recibos-detail.component';

/**
 * Cuándo se calculó el recibo y de qué ejecución salió (`b4rrhh/frontend#69`), que es el paso 2.
 *
 * Los dos datos llevaban persistidos desde la V53 y la V124 y el contrato los servía; lo que
 * faltaba era traerlos hasta la pantalla. Lo que este test sujeta son las tres formas de decirlo:
 *
 * 1. La fecha **en castellano**, no el ISO crudo que llega del backend.
 * 2. La ejecución **enlazada** a su pantalla, que ya existe.
 * 3. Y el recibo **sin ejecución**, que no es un hueco: el contrato dice que es lo que pasa con el
 *    cálculo provisional y con el recálculo suelto de un recibo — el que ofrece «Recalcular». Ahí
 *    no puede quedar ni un enlace roto ni un sitio vacío.
 */
describe('El recibo dice cuándo se calculó y de qué ejecución salió', () => {
  const RECIBO: PayrollSummaryModel = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP000001',
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL',
    presenceNumber: 2,
    status: 'CALCULATED',
    calculatedAt: '2026-09-14T20:03:48.395388Z',
  };

  let store: {
    selectedPayroll: ReturnType<typeof signal<PayrollSummaryModel | null>>;
    runId: ReturnType<typeof signal<number | null>>;
  };

  function render(runId: number | null): HTMLElement {
    const selectedPayroll = signal<PayrollSummaryModel | null>(RECIBO);
    const run = signal<number | null>(runId);
    store = { selectedPayroll, runId: run };

    TestBed.configureTestingModule({
      imports: [RecibosDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of({ keys: [] }) } },
        {
          provide: RecibosStore,
          useValue: {
            // Si tiene hermana de presencia lo contesta el servidor (frontend#104): no la tiene.
            selectedHasPresenceSister: signal(false),
            selectedPayroll,
            runId: run,
            rulesChanged: signal(false),
            lineasMovidas: signal(new Set<number>()),
            // De la línea a su explicación (frontend#93): ninguna explicada.
            explainedLine: signal(null),
            explainedArrear: signal(null),
            recalculoSeq: signal(0),
            concepts: signal([]),
            payslipSections: signal([]),
            conceptsLoading: signal(false),
            conceptsError: signal(null),
            companyProfile: signal(null),
            employeeProfile: signal(null),
            agreementProfile: signal(null),
            presenceStartDate: signal(null),
            presenceEndDate: signal(null),
            seniorityDate: signal(null),
            workCenterCode: signal(null),
            workCenterName: signal(null),
            steps: signal([]),
            stepsLoading: signal(false),
            stepsError: signal(null),
            stepsLoaded: signal(null),
            selectedKey: signal(null),
            transitioning: signal(false),
            transitionError: signal(null),
            // El recibo abierto sigue siendo el que hay detras (`b4rrhh/frontend#75`).
            desincronizado: signal(null),
            reciboDesaparecido: () => false,
            // La descarga del documento (b4rrhh/frontend#78). Quieta: estos tests no van de eso,
            // y el gesto no cambia nada de lo que si miran.
            descargando: signal(false),
            ultimaDescarga: signal(null),
            descargaError: signal(null),
            descargarDocumento: vi.fn(),
            revisarSiSigueAhi: vi.fn(),
            clearSelection: vi.fn(),
            selectPayroll: vi.fn(),
            loadCalculationSteps: vi.fn(),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(RecibosDetailComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => TestBed.resetTestingModule());

  describe('la fecha', () => {
    it('sale en castellano y no como ISO', () => {
      const texto = render(1).querySelector('.calc-when')?.textContent ?? '';

      expect(texto).toContain('14/09/2026');
      expect(texto).toContain('a las');
      expect(texto).not.toContain('2026-09-14T22:03');
    });
  });

  describe('la ejecución', () => {
    it('sale enlazada a su pantalla', () => {
      const enlace = render(7).querySelector('.calc-run');

      expect(enlace?.textContent?.trim()).toBe('Ejecución 7');
      expect(enlace?.getAttribute('href')).toBe('/nomina/operaciones/7');
    });

    /**
     * Este `null` ya no es el estado normal de nada que se pueda provocar desde la pantalla: desde
     * `b4rrhh/backend#99` recalcular abre su propia ejecución, así que sólo quedan los recibos del
     * cálculo provisional. La rama se queda hasta que ese endpoint se retire (`b4rrhh/backend#90`),
     * porque mientras exista puede producirlos.
     */
    it('un recibo sin ejecución lo dice, y no deja un enlace roto', () => {
      const host = render(null);

      expect(host.querySelector('.calc-run')).toBeNull();
      expect(host.querySelector('.calc-run-none')?.textContent?.trim()).toBe(
        'sin ejecución registrada',
      );
    });

    /**
     * El porqué va detrás del «?» y no en un `title` (`b4rrhh/frontend#108`): lo que hay que
     * descubrir pasando el ratón no está escrito para quien usa la pantalla (`frontend#85`).
     */
    it('y explica por qué no la tiene detrás del «?», sin acusar al recibo de estar mal', () => {
      const host = render(null);
      const porque = host.querySelector('.calc-run-none + app-ui-more')?.textContent ?? '';

      expect(porque).toContain('cálculo provisional');
      expect(porque).not.toContain('error');
      expect(host.querySelector('.calc-run-none')?.hasAttribute('title')).toBe(false);
    });

    /** Sin ejecución sigue habiendo fecha: son dos datos distintos y sólo falta uno. */
    it('sin ejecución la fecha se sigue viendo', () => {
      expect(render(null).querySelector('.calc-when')?.textContent ?? '').toContain('14/09/2026');
    });
  });

  /**
   * La barra en dos filas (`b4rrhh/frontend#102`). Con la clave, el estado, la hora, la ejecución y
   * seis botones en una sola fila de 820 px como mucho, lo único que encogía era la hora: «Calculada
   * el 27/09/2026 a las 22:26» salía en tres renglones de 64 px, y a 1280 los botones se montaban
   * encima. Arriba lo que identifica, abajo las acciones, y la hora nunca se parte.
   *
   * jsdom no maqueta, así que lo que se sujeta aquí es lo que sí puede leer: que el literal está
   * entero en el DOM, y que los estilos no lo parten ni lo recortan. Las capturas a 1280 y 1024 van
   * en el issue.
   */
  describe('la barra, en dos filas', () => {
    const estilos = readFileSync(
      resolve(process.cwd(), 'src/app/features/nomina/recibos/ui/recibos-detail.component.scss'),
      'utf8',
    );

    function regla(selector: string): string {
      const inicio = estilos.indexOf(`
${selector} {`);
      expect(inicio, `no encuentro la regla ${selector}`).toBeGreaterThanOrEqual(0);
      return estilos.slice(inicio, estilos.indexOf('}', inicio));
    }

    it('la hora está entera en el DOM', () => {
      expect(render(7).querySelector('.calc-when')?.textContent?.trim()).toBe(
        'Calculada el 14/09/2026 a las 22:03',
      );
    });

    it('la hora no se parte y nada la recorta', () => {
      expect(regla('.calc-when')).toContain('white-space: nowrap');
      expect(estilos).not.toMatch(/text-overflow/);
    });

    it('las acciones van en su propia fila, y la barra no tiene un tope más estrecho que ellas', () => {
      expect(regla('.action-bar')).toContain('flex-direction: column');
      expect(regla('.action-bar')).not.toMatch(/max-width/);
    });
  });
});
