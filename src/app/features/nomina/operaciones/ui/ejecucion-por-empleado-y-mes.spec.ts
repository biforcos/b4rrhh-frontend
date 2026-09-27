import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EJECUCION_POLL_TICK } from '../store/ejecucion.store';
import { CalculationRun } from '../models/calculation-run.model';
import { EjecucionPageComponent } from './ejecucion-page.component';
import { OperacionesGateway } from '../gateway/operaciones.gateway';

/**
 * La pantalla de la ejecución cuenta **empleado × mes** (`b4rrhh/frontend#85`).
 *
 * El suelo para todos es el lanzamiento más caro del sistema: 873 empleados desde enero son 873
 * recibos y siete mil vigentes, y siete mil es el número que cuesta el tiempo. Una pantalla que
 * enseñara sólo los 873 estaría diciendo que la corrida va por el 1 % cuando lleva media hora, y eso
 * es lo que hace que alguien la dé por colgada y la mate.
 *
 * La terna de la retro es **suya** y no se suma a los nueve contadores del recibo: una unidad de
 * retro no escribe recibo, escribe cálculo vigente, así que meterla en los nueve habría roto su
 * partición sin que nada avisara (`b4rrhh/backend#132`).
 */
const CON_RETRO: CalculationRun = {
  runId: 9,
  status: 'RUNNING',
  ruleSystemCode: 'ESP',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  calculationEngineCode: 'GRAPH',
  calculationEngineVersion: '1.0',
  totalCandidates: 873,
  totalEligible: 400,
  totalClaimed: 400,
  totalSkippedNotEligible: 0,
  totalSkippedMissingInput: 0,
  totalSkippedAlreadyClaimed: 0,
  totalCalculated: 400,
  totalNotValid: 0,
  totalErrors: 0,
  retroLimitPeriodCode: '202509',
  retroFloorPeriodCode: '202601',
  totalRetroUnits: 6984,
  totalRetroRecalculated: 3200,
  totalRetroNotRecalculated: 0,
  requestedAt: '2026-09-27T10:00:00',
  startedAt: '2026-09-27T10:00:01',
  finishedAt: null,
};

const SIN_RETRO: CalculationRun = {
  ...CON_RETRO,
  retroLimitPeriodCode: null,
  retroFloorPeriodCode: null,
  totalRetroUnits: 0,
  totalRetroRecalculated: 0,
  totalRetroNotRecalculated: 0,
};

describe('La ejecución cuenta por empleado y mes', () => {
  function render(run: CalculationRun): HTMLElement {
    TestBed.configureTestingModule({
      imports: [EjecucionPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EJECUCION_POLL_TICK, useValue: EMPTY },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['runId', '9']]) } },
        },
        {
          provide: OperacionesGateway,
          useValue: {
            getCalculationRun: vi.fn().mockReturnValue(of(run)),
            listCalculationRunMessages: vi.fn().mockReturnValue(of([])),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(EjecucionPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('enseña el universo de la retro y su partición, aparte de los nueve del recibo', () => {
    const host = render(CON_RETRO);
    const texto = host.textContent ?? '';

    expect(texto).toContain('6984');
    expect(texto).toContain('3200');
    expect(texto).toContain('empleado × mes');
  });

  it('el trabajo de la corrida es la suma de los dos universos, y lo dice', () => {
    const host = render(CON_RETRO);

    const total = host.querySelector('[data-testid="run-total-work"]');
    expect(total).not.toBeNull();
    // 873 recibos + 6.984 vigentes.
    expect(total!.textContent).toContain('7857');
  });

  it('enseña los dos parámetros con los que corre', () => {
    const host = render(CON_RETRO);

    const limite = host.querySelector('[data-testid="run-retro-limit"]');
    const suelo = host.querySelector('[data-testid="run-retro-floor"]');
    expect(limite!.textContent).toContain('202509');
    expect(suelo!.textContent).toContain('202601');
  });

  /**
   * Una corrida sin retro es la normal, y no tiene que enseñar tres ceros y dos huecos: lo que no
   * hubo no se cuenta. El suelo se dice como «sin suelo» y no como un guion, porque «no hubo suelo»
   * es una respuesta y un guion es un hueco.
   */
  it('una corrida sin retro no pinta la terna de la retro', () => {
    const host = render(SIN_RETRO);

    expect(host.querySelector('[data-testid="run-retro-units"]')).toBeNull();
    expect(host.querySelector('[data-testid="run-total-work"]')).toBeNull();
    expect(host.querySelector('[data-testid="run-retro-limit"]')!.textContent).toContain('sin');
  });

  /**
   * Y el avance se mide sobre los dos universos. Con la barra contando sólo los recibos, un
   * lanzamiento con suelo para todos se queda parado en el mismo número mientras recalcula siete mil
   * meses, que es exactamente cuando hace falta saber que avanza.
   */
  it('la barra cuenta los dos universos', () => {
    const host = render(CON_RETRO);

    const barra = host.querySelector('[role="progressbar"]');
    // (400 recibos + 3.200 vigentes) de 7.857 = 46 %.
    expect(barra!.getAttribute('aria-valuenow')).toBe('46');
  });
});
