import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CalculationRun } from '../models/calculation-run.model';
import { CalculationRunMessage } from '../models/calculation-run-message.model';
import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { EJECUCION_POLL_TICK } from '../store/ejecucion.store';
import { EjecucionPageComponent } from './ejecucion-page.component';

/**
 * La ejecución dice que terminó (`b4rrhh/frontend#140`): «he estado un rato mirando la pantalla sin
 * tener claro si había terminado». Mientras corre, «Calculando…» con su barra viva; al terminar,
 * «Terminada» en grande, lo que hizo y a dónde ir; si falla, igual de grande y con el motivo.
 */
const CORRIENDO: CalculationRun = {
  runId: 9,
  status: 'RUNNING',
  ruleSystemCode: 'ESP',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  calculationEngineCode: 'GRAPH',
  calculationEngineVersion: '1.0',
  totalCandidates: 1,
  totalEligible: 0,
  totalClaimed: 0,
  totalSkippedNotEligible: 0,
  totalSkippedMissingInput: 0,
  totalSkippedAlreadyClaimed: 0,
  totalCalculated: 0,
  totalNotValid: 0,
  totalErrors: 0,
  retroLimitPeriodCode: null,
  retroFloorPeriodCode: null,
  totalRetroUnits: 0,
  totalRetroRecalculated: 0,
  totalRetroNotRecalculated: 0,
  requestedAt: '2026-10-14T10:00:00',
  startedAt: '2026-10-14T10:00:00',
  finishedAt: null,
};

const TERMINADA: CalculationRun = {
  ...CORRIENDO,
  status: 'COMPLETED',
  totalEligible: 1,
  totalClaimed: 1,
  totalCalculated: 1,
  finishedAt: '2026-10-14T10:00:02',
};

const CALCULADO: CalculationRunMessage = {
  messageCode: 'UNIT_ELIGIBLE_REAL_EXECUTED',
  messageCodeName: null,
  severityCode: 'INFO',
  message: 'Calculado',
  detailsJson: null,
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000025',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 1,
  createdAt: '2026-10-14T10:00:02',
};

describe('La ejecución dice que terminó', () => {
  function render(
    primera: CalculationRun,
    siguientes: CalculationRun[] = [],
    mensajesIniciales: CalculationRunMessage[] = [],
  ) {
    const tick = new Subject<void>();
    const navigate = vi.fn().mockResolvedValue(true);
    const getCalculationRun = vi.fn().mockReturnValueOnce(of(primera));
    siguientes.forEach((run) => getCalculationRun.mockReturnValueOnce(of(run)));
    TestBed.configureTestingModule({
      imports: [EjecucionPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: { navigate } },
        { provide: EJECUCION_POLL_TICK, useValue: tick },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['runId', '9']]) } },
        },
        {
          provide: OperacionesGateway,
          useValue: {
            getCalculationRun,
            // La primera carga trae los que haya; al terminar se releen y ya está el calculado.
            listCalculationRunMessages: vi
              .fn()
              .mockReturnValueOnce(of(mensajesIniciales))
              .mockReturnValue(of([CALCULADO])),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(EjecucionPageComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const state = () => host.querySelector('[data-testid="run-state"]') as HTMLElement;
    return { fixture, host, state, tick, navigate };
  }

  it('mientras corre: «Calculando…», ocupado y con la barra viva', () => {
    const { state } = render(CORRIENDO);

    expect(state().textContent?.trim()).toBe('Calculando…');
    expect(state().getAttribute('aria-busy')).toBe('true');
    expect(state().classList).toContain('ejecucion-page__state--running');
  });

  it('al llegar el estado final cambia a «Terminada» sin recargar, y lleva a su recibo', () => {
    const { fixture, state, tick, navigate } = render(CORRIENDO, [TERMINADA]);

    tick.next();
    fixture.detectChanges();

    expect(state().textContent).toContain('Terminada · 1 recibo calculado en 2 s');
    expect(state().getAttribute('aria-busy')).toBe('false');
    const enlace = state().querySelector('[data-testid="run-result-link"] button') as HTMLElement;
    expect(enlace.textContent).toContain('Ver el recibo de EMP000025');

    enlace.click();
    expect(navigate).toHaveBeenCalledWith([
      '/nomina/recibos',
      'ESP',
      'INTERNAL',
      'EMP000025',
      '202609',
      'NORMAL',
      1,
    ]);
  });

  it('si falla, igual de grande y con el motivo', () => {
    const { fixture, state } = render(
      { ...CORRIENDO, status: 'FAILED', finishedAt: '2026-10-14T10:00:02' },
      [],
      [
        {
          ...CALCULADO,
          messageCode: 'RUN_FAILED',
          severityCode: 'ERROR',
          message: 'El backend se reinició con la ejecución en curso.',
        },
      ],
    );
    fixture.detectChanges();

    expect(state().textContent).toContain('Fallida');
    expect(state().textContent).toContain('El backend se reinició con la ejecución en curso.');
    expect(state().classList).toContain('ejecucion-page__state--failed');
  });
});
