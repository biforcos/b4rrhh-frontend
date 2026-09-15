import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
    calculatedAt: '2026-09-14T22:03:48.395388',
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
            selectedPayroll,
            runId: run,
            concepts: signal([]),
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
     * El caso del criterio 3, y el que se va a ver en cuanto exista «Recalcular»: recalcular un
     * recibo suelto no registra ejecución, así que este `null` no es raro — es el estado normal
     * del recibo que alguien acaba de recalcular desde la pantalla.
     */
    it('un recibo sin ejecución lo dice, y no deja un enlace roto', () => {
      const host = render(null);

      expect(host.querySelector('.calc-run')).toBeNull();
      expect(host.querySelector('.calc-run-none')?.textContent?.trim()).toBe(
        'sin ejecución registrada',
      );
    });

    it('y explica por qué no la tiene, sin acusar al recibo de estar mal', () => {
      const titulo = render(null).querySelector('.calc-run-none')?.getAttribute('title') ?? '';

      expect(titulo).toContain('se recalcula');
      expect(titulo).not.toContain('error');
    });

    /** Sin ejecución sigue habiendo fecha: son dos datos distintos y sólo falta uno. */
    it('sin ejecución la fecha se sigue viendo', () => {
      expect(render(null).querySelector('.calc-when')?.textContent ?? '').toContain('14/09/2026');
    });
  });
});
