import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { CalculationRunMessage } from '../models/calculation-run-message.model';
import { CalculationRun } from '../models/calculation-run.model';
import { EjecucionStore } from './ejecucion.store';

// La ejecucion 1 de la corrida del deploy#3, recortada: COMPLETED con dos unidades saltadas.
const RUN: CalculationRun = {
  runId: 1,
  status: 'COMPLETED',
  ruleSystemCode: 'ESP',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  calculationEngineCode: 'GRAPH',
  calculationEngineVersion: '1.0',
  totalCandidates: 873,
  totalEligible: 873,
  totalClaimed: 873,
  totalSkippedNotEligible: 2,
  totalSkippedAlreadyClaimed: 0,
  totalCalculated: 871,
  totalNotValid: 0,
  totalErrors: 0,
  requestedAt: '2026-09-07T14:48:25',
  startedAt: '2026-09-07T14:48:25',
  finishedAt: '2026-09-07T14:53:44',
};

function message(
  messageCode: string,
  employeeNumber: string,
  severityCode = 'INFO',
): CalculationRunMessage {
  return {
    messageCode,
    severityCode,
    message: `mensaje de ${employeeNumber}`,
    detailsJson: null,
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber,
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL',
    presenceNumber: 1,
    createdAt: '2026-09-07T14:50:10',
  };
}

const MESSAGES: CalculationRunMessage[] = [
  message('UNIT_ELIGIBLE_REAL_EXECUTED', 'EMP000001'),
  message('UNIT_ELIGIBLE_REAL_SKIPPED_MISSING_INPUT', 'EMP000298', 'WARNING'),
  message('UNIT_ELIGIBLE_REAL_SKIPPED_MISSING_INPUT', 'EMP000921', 'WARNING'),
];

describe('EjecucionStore', () => {
  let store: EjecucionStore;
  let gatewayMock: {
    getCalculationRun: ReturnType<typeof vi.fn>;
    listCalculationRunMessages: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      getCalculationRun: vi.fn().mockReturnValue(of(RUN)),
      listCalculationRunMessages: vi.fn().mockReturnValue(of(MESSAGES)),
    };

    TestBed.configureTestingModule({
      providers: [EjecucionStore, { provide: OperacionesGateway, useValue: gatewayMock }],
    });

    store = TestBed.inject(EjecucionStore);
  });

  it('carga la ejecucion y sus mensajes de una vez', () => {
    store.load(1);

    expect(gatewayMock.getCalculationRun).toHaveBeenCalledWith(1);
    expect(gatewayMock.listCalculationRunMessages).toHaveBeenCalledWith(1);
    expect(store.run()).toEqual(RUN);
    expect(store.totalMessages()).toBe(3);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe(false);
  });

  it('cuenta las unidades sin recibo con los contadores, no con el estado', () => {
    store.load(1);

    // «COMPLETED» dice que la ejecucion acabo, no que hayan cobrado todos (frontend#61).
    expect(store.run()?.status).toBe('COMPLETED');
    expect(store.unitsWithoutPayslip()).toBe(2);
  });

  it('sin ejecucion cargada no cuenta nada', () => expect(store.unitsWithoutPayslip()).toBe(0));

  it('el filtro de las que piden algo deja fuera las ejecutadas', () => {
    store.load(1);

    expect(store.messages()).toHaveLength(3);

    store.setFilter('ATTENTION');

    expect(store.messages().map((m) => m.employeeNumber)).toEqual(['EMP000298', 'EMP000921']);
    expect(store.totalMessages()).toBe(3);
  });

  it('marca el error y no se queda cargando si falla cualquiera de las dos peticiones', () => {
    gatewayMock.listCalculationRunMessages.mockReturnValue(throwError(() => new Error('boom')));

    store.load(1);

    expect(store.error()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.run()).toBeNull();
  });
});
