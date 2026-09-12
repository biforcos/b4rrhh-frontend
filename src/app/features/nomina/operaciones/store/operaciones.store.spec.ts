import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { CalculationRun } from '../models/calculation-run.model';
import { OperacionesStore } from './operaciones.store';

// Lo que contesta el backend al aceptar un lanzamiento: identidad y nada mas, porque todavia no ha
// mirado a nadie (ADR-060).
const ACCEPTED: CalculationRun = {
  runId: 42,
  status: 'REQUESTED',
  ruleSystemCode: 'ESP',
  payrollPeriodCode: '202608',
  payrollTypeCode: 'NORMAL',
  calculationEngineCode: 'GRAPH',
  calculationEngineVersion: '1.0',
  totalCandidates: 0,
  totalEligible: 0,
  totalClaimed: 0,
  totalSkippedNotEligible: 0,
  totalSkippedAlreadyClaimed: 0,
  totalCalculated: 0,
  totalNotValid: 0,
  totalErrors: 0,
  requestedAt: '2026-09-12T17:21:47',
  startedAt: null,
  finishedAt: null,
};

describe('OperacionesStore', () => {
  let store: OperacionesStore;
  let gatewayMock: {
    launchCalculation: ReturnType<typeof vi.fn>;
    getCalculationRun: ReturnType<typeof vi.fn>;
    bulkInvalidate: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    gatewayMock = {
      launchCalculation: vi.fn().mockReturnValue(of(ACCEPTED)),
      getCalculationRun: vi.fn().mockReturnValue(of(ACCEPTED)),
      bulkInvalidate: vi.fn(),
    };
    routerMock = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        OperacionesStore,
        { provide: OperacionesGateway, useValue: gatewayMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    store = TestBed.inject(OperacionesStore);
  });

  it('lanzar lleva a la pantalla de la ejecucion que acaba de crear', () => {
    store.launch();

    expect(gatewayMock.launchCalculation).toHaveBeenCalledTimes(1);
    expect(routerMock.navigate).toHaveBeenCalledWith(['/nomina/operaciones', 42]);
  });

  it('no espera a que el calculo acabe: ni sondea ni se queda lanzando', () => {
    store.launch();

    // Sondear es de la pantalla de la ejecucion, que se destruye al salir. Este store es de raiz:
    // un temporizador suyo no lo paraba nadie (frontend#62).
    expect(gatewayMock.getCalculationRun).not.toHaveBeenCalled();
    expect(store.launching()).toBe(false);
  });

  it('si el lanzamiento falla se queda donde esta y lo dice', () => {
    gatewayMock.launchCalculation.mockReturnValue(throwError(() => new Error('boom')));

    store.launch();

    expect(routerMock.navigate).not.toHaveBeenCalled();
    expect(store.launchError()).toBe('launch-failed');
    expect(store.launching()).toBe(false);
  });

  it('manda el contexto que se esta pidiendo, con el periodo en YYYYMM', () => {
    store.setRuleSystemCode('ESP');
    store.setPayrollTypeCode('EXTRA');
    store.setTargetMode('ALL');

    store.launch();

    const enviado = gatewayMock.launchCalculation.mock.calls[0][0];
    expect(enviado.ruleSystemCode).toBe('ESP');
    expect(enviado.payrollTypeCode).toBe('EXTRA');
    expect(enviado.payrollPeriodCode).toMatch(/^\d{6}$/);
    expect(enviado.targetSelection.selectionType).toBe('ALL_EMPLOYEES_WITH_PRESENCE_IN_PERIOD');
  });

  it('sin motor no se puede lanzar, y entonces el boton no pide nada', () => {
    store.setEngineCode('  ');

    expect(store.canLaunch()).toBe(false);

    store.launch();

    expect(gatewayMock.launchCalculation).not.toHaveBeenCalled();
  });
});
