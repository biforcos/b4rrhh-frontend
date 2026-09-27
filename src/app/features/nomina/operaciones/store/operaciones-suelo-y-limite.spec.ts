import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { CalculationRun } from '../models/calculation-run.model';
import { OperacionesStore } from './operaciones.store';

/**
 * Los dos parámetros de la retro en la petición de lanzamiento (`b4rrhh/frontend#85`, paso 6 de
 * `b4rrhh/workspace#9`).
 *
 * Van en la petición y no en la empresa: una revisión de convenio —«todos desde enero»— es una cosa
 * que pasa una vez, y ponerla en la empresa la convertiría en una configuración que alguien deja
 * puesta (`b4rrhh/backend#132`).
 *
 * Lo que se comprueba aquí es lo que el formulario **no** deja salir. El backend rechaza un suelo
 * más antiguo que el límite con un 400, y eso no basta: el formulario tiene dos campos a la vista
 * que se contradicen entre sí, y quien lanza tiene derecho a saberlo antes de esperar una respuesta.
 */
const ACEPTADA: CalculationRun = {
  runId: 77,
  status: 'REQUESTED',
  ruleSystemCode: 'ESP',
  payrollPeriodCode: '202609',
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
  retroLimitPeriodCode: null,
  retroFloorPeriodCode: null,
  totalRetroUnits: 0,
  totalRetroRecalculated: 0,
  totalRetroNotRecalculated: 0,
  requestedAt: '2026-09-27T10:00:00',
  startedAt: null,
  finishedAt: null,
};

describe('El lanzamiento dice hasta dónde atrás recalcula', () => {
  let store: OperacionesStore;
  let gatewayMock: {
    listEmployeeTypes: ReturnType<typeof vi.fn>;
    launchCalculation: ReturnType<typeof vi.fn>;
    getCalculationRun: ReturnType<typeof vi.fn>;
    bulkInvalidate: ReturnType<typeof vi.fn>;
    bulkFinalize: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      listEmployeeTypes: vi.fn().mockReturnValue(of(['EXTERNAL', 'INTERNAL'])),
      launchCalculation: vi.fn().mockReturnValue(of(ACEPTADA)),
      getCalculationRun: vi.fn(),
      bulkInvalidate: vi.fn(),
      bulkFinalize: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        OperacionesStore,
        { provide: OperacionesGateway, useValue: gatewayMock },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
      ],
    });

    store = TestBed.inject(OperacionesStore);
  });

  it('propone doce meses antes del período que se va a lanzar, y el motivo es un texto y no un doce mágico', () => {
    store.setPeriod(202609);

    expect(store.retroLimitProposal()).toBe(202509);
    expect(store.retroLimitPeriod()).toBe(202509);
    expect(store.retroLimitProposalReason().length).toBeGreaterThan(40);
  });

  it('mover el período mueve el propuesto, mientras nadie lo haya tocado', () => {
    store.setPeriod(202609);
    store.nextPeriod();

    expect(store.retroLimitPeriod()).toBe(202510);
  });

  it('una vez tocado, el límite se queda donde lo pusieron aunque el período se mueva', () => {
    store.setPeriod(202609);
    store.setRetroLimitPeriod(202601);
    store.nextPeriod();

    expect(store.retroLimitPeriod()).toBe(202601);
  });

  it('el suelo es opcional: sin suelo no se manda el campo', () => {
    store.setPeriod(202609);

    store.launch();

    const enviado = gatewayMock.launchCalculation.mock.calls[0][0];
    expect(enviado.retroLimitPeriodCode).toBe('202509');
    expect(enviado.retroFloorPeriodCode).toBeNull();
  });

  it('con suelo para todos, los dos van en la petición como yyyyMM', () => {
    store.setPeriod(202609);
    store.setRetroLimitPeriod(202512);
    store.setRetroFloorPeriod(202601);

    store.launch();

    const enviado = gatewayMock.launchCalculation.mock.calls[0][0];
    expect(enviado.retroLimitPeriodCode).toBe('202512');
    expect(enviado.retroFloorPeriodCode).toBe('202601');
  });

  /**
   * El caso del issue. Un suelo más antiguo que el límite pide dos cosas contrarias, y el
   * formulario lo dice **antes que el servidor**: no se llama al backend.
   */
  it('un suelo más antiguo que el límite no se puede enviar, y el botón no pide nada', () => {
    store.setPeriod(202609);
    store.setRetroLimitPeriod(202601);
    store.setRetroFloorPeriod(202512);

    expect(store.retroFloorOlderThanLimit()).toBe(true);
    expect(store.canLaunch()).toBe(false);

    store.launch();

    expect(gatewayMock.launchCalculation).not.toHaveBeenCalled();
  });

  it('un suelo igual al límite sí se puede enviar: el límite es un hasta dónde, no un antes de', () => {
    store.setPeriod(202609);
    store.setRetroLimitPeriod(202601);
    store.setRetroFloorPeriod(202601);

    expect(store.retroFloorOlderThanLimit()).toBe(false);
    expect(store.canLaunch()).toBe(true);
  });

  it('el límite es obligatorio: vaciarlo deja el lanzamiento parado', () => {
    store.setPeriod(202609);
    store.setRetroLimitPeriod(null);

    expect(store.retroLimitPeriod()).toBeNull();
    expect(store.canLaunch()).toBe(false);

    store.launch();

    expect(gatewayMock.launchCalculation).not.toHaveBeenCalled();
  });

  /**
   * Los otros dos verbos no llevan retro: invalidar y cerrar no calculan nada, así que un límite
   * vacío no puede dejarlos parados.
   */
  it('vaciar el límite no bloquea invalidar ni cerrar', () => {
    store.setRetroLimitPeriod(null);

    expect(store.canInvalidate()).toBe(true);
    expect(store.canFinalize()).toBe(true);
  });
});
