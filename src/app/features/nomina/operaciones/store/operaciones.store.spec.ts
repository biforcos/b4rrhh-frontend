import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { BulkFinalizeResult } from '../models/bulk-finalize-result.model';
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
  totalSkippedMissingInput: 0,
  totalSkippedAlreadyClaimed: 0,
  totalCalculated: 0,
  totalNotValid: 0,
  totalErrors: 0,
  requestedAt: '2026-09-12T17:21:47',
  startedAt: null,
  finishedAt: null,
};

/**
 * Lo que contesta un cierre masivo (`b4rrhh/backend#102`). Los contadores son el entregable: sobre
 * cinco candidatas se cierran dos, una ya estaba cerrada, una es inválida —`NOT_VALID → DEFINITIVE`
 * no existe— y una no tenía recibo. Nada cae en un «fallidas» genérico porque no falla nada.
 */
const CIERRE: BulkFinalizeResult = {
  totalCandidates: 5,
  totalFound: 4,
  totalFinalized: 2,
  totalSkippedAlreadyDefinitive: 1,
  totalSkippedNotEligibleByStatus: 1,
  totalSkippedNotFound: 1,
};

describe('OperacionesStore', () => {
  let store: OperacionesStore;
  let gatewayMock: {
    launchCalculation: ReturnType<typeof vi.fn>;
    getCalculationRun: ReturnType<typeof vi.fn>;
    bulkInvalidate: ReturnType<typeof vi.fn>;
    bulkFinalize: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    gatewayMock = {
      launchCalculation: vi.fn().mockReturnValue(of(ACCEPTED)),
      getCalculationRun: vi.fn().mockReturnValue(of(ACCEPTED)),
      bulkInvalidate: vi.fn(),
      bulkFinalize: vi.fn().mockReturnValue(of(CIERRE)),
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

  describe('el tercer verbo: cerrar el periodo', () => {
    it('manda el mismo contexto y el mismo selector que los otros dos, y ningun campo propio', () => {
      store.setRuleSystemCode('ESP');
      store.setPayrollTypeCode('EXTRA');
      store.setTargetMode('ALL');

      store.armFinalize();
      store.finalize();

      const enviado = gatewayMock.bulkFinalize.mock.calls[0][0];
      expect(enviado.ruleSystemCode).toBe('ESP');
      expect(enviado.payrollTypeCode).toBe('EXTRA');
      expect(enviado.payrollPeriodCode).toMatch(/^\d{6}$/);
      expect(enviado.targetSelection.selectionType).toBe('ALL_EMPLOYEES_WITH_PRESENCE_IN_PERIOD');
      // Cerrar no da un motivo: conserva el que el recibo tuviera.
      expect(enviado.statusReasonCode).toBeUndefined();
    });

    it('guarda los contadores tal cual vienen, sin sumar lo que el backend separo', () => {
      store.armFinalize();
      store.finalize();

      expect(store.finalizeResult()).toEqual(CIERRE);
      expect(store.finalizeResult()?.totalSkippedNotEligibleByStatus).toBe(1);
      expect(store.finalizing()).toBe(false);
    });

    /**
     * El primer clic no cierra nada. Es el único de los tres verbos que no se deshace —invalidar se
     * arregla recalculando, y un cierre no se abre—, así que pide confirmarlo.
     */
    it('el primer clic arma la confirmacion y no llama al backend', () => {
      store.armFinalize();

      expect(store.finalizeArmed()).toBe(true);
      expect(gatewayMock.bulkFinalize).not.toHaveBeenCalled();
    });

    it('sin armar, cerrar no hace nada', () => {
      store.finalize();

      expect(gatewayMock.bulkFinalize).not.toHaveBeenCalled();
    });

    it('cancelar desarma y deja la pantalla como estaba', () => {
      store.armFinalize();
      store.disarmFinalize();
      store.finalize();

      expect(store.finalizeArmed()).toBe(false);
      expect(gatewayMock.bulkFinalize).not.toHaveBeenCalled();
    });

    /**
     * Y cambiar a quien apunta el encargo desarma: una confirmacion armada para un periodo no vale
     * para otro, y ese es justo el clic que cerraria el mes equivocado.
     */
    it('cambiar de periodo o de objetivo desarma la confirmacion', () => {
      store.armFinalize();
      store.nextPeriod();
      expect(store.finalizeArmed()).toBe(false);

      store.armFinalize();
      store.setTargetMode('SINGLE');
      expect(store.finalizeArmed()).toBe(false);

      store.armFinalize();
      store.setRuleSystemCode('MAS');
      expect(store.finalizeArmed()).toBe(false);
    });

    it('si el cierre falla lo dice y no deja contadores viejos a la vista', () => {
      gatewayMock.bulkFinalize.mockReturnValue(throwError(() => new Error('boom')));

      store.armFinalize();
      store.finalize();

      expect(store.finalizeError()).toBe('request-failed');
      expect(store.finalizeResult()).toBeNull();
      expect(store.finalizing()).toBe(false);
    });
  });

  it('sin motor no se puede lanzar, y entonces el boton no pide nada', () => {
    store.setEngineCode('  ');

    expect(store.canLaunch()).toBe(false);

    store.launch();

    expect(gatewayMock.launchCalculation).not.toHaveBeenCalled();
  });
});
