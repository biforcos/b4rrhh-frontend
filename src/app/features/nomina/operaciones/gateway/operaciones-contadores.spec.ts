import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { PayrollCalculationRunService } from '../../../../core/api/generated/api/payroll-calculation-run.service';
import { PayrollService } from '../../../../core/api/generated/api/payroll.service';
import { CalculationRun } from '../models/calculation-run.model';
import { OperacionesGateway } from './operaciones.gateway';

/**
 * Los contadores de los verbos masivos, del cliente generado al modelo de la pantalla.
 *
 * Esto no lo cubría nada y merece cubrirse, porque el fallo que deja es mudo: un campo mal
 * emparejado aquí no rompe la compilación —el cliente los declara todos opcionales y el `?? 0` los
 * apaga— y la pantalla pinta un cero perfectamente creíble. Y en el `b4rrhh/backend#102` los
 * contadores **son** el entregable: «870 cerradas y 3 no aptas por su estado» es lo que enseña la
 * máquina de estados, y «870 y 0» no enseña nada.
 *
 * Los cinco números de cada verbo son distintos entre sí a propósito: con valores repetidos, dos
 * campos cruzados darían el mismo resultado y el test no distinguiría nada.
 */
describe('Los contadores de los verbos masivos llegan a la pantalla sin cruzarse', () => {
  function gatewayCon(payrollApi: Partial<PayrollService>): OperacionesGateway {
    TestBed.configureTestingModule({
      providers: [
        OperacionesGateway,
        { provide: PayrollService, useValue: payrollApi },
        { provide: PayrollCalculationRunService, useValue: {} },
      ],
    });
    return TestBed.inject(OperacionesGateway);
  }

  it('los del cierre', async () => {
    const bulkFinalizePayroll = vi.fn().mockReturnValue(
      of({
        totalCandidates: 11,
        totalFound: 22,
        totalFinalized: 33,
        totalSkippedAlreadyDefinitive: 44,
        totalSkippedNotEligibleByStatus: 55,
        totalSkippedNotFound: 66,
      }),
    );
    const gateway = gatewayCon({ bulkFinalizePayroll } as unknown as Partial<PayrollService>);

    const result = await new Promise((resolve) =>
      gateway
        .bulkFinalize({
          ruleSystemCode: 'ESP',
          payrollPeriodCode: '202609',
          payrollTypeCode: 'NORMAL',
          targetSelection: { selectionType: 'ALL_EMPLOYEES_WITH_PRESENCE_IN_PERIOD' },
        })
        .subscribe(resolve),
    );

    expect(result).toEqual({
      totalCandidates: 11,
      totalFound: 22,
      totalFinalized: 33,
      totalSkippedAlreadyDefinitive: 44,
      totalSkippedNotEligibleByStatus: 55,
      totalSkippedNotFound: 66,
    });
  });

  it('y los de la invalidación, que llevaban sin cubrirse desde que existen', async () => {
    const bulkInvalidatePayroll = vi.fn().mockReturnValue(
      of({
        totalCandidates: 11,
        totalFound: 22,
        totalInvalidated: 33,
        totalSkippedAlreadyNotValid: 44,
        totalSkippedProtected: 55,
        totalSkippedNotFound: 66,
      }),
    );
    const gateway = gatewayCon({ bulkInvalidatePayroll } as unknown as Partial<PayrollService>);

    const result = await new Promise((resolve) =>
      gateway
        .bulkInvalidate({
          ruleSystemCode: 'ESP',
          payrollPeriodCode: '202609',
          payrollTypeCode: 'NORMAL',
          targetSelection: { selectionType: 'ALL_EMPLOYEES_WITH_PRESENCE_IN_PERIOD' },
        })
        .subscribe(resolve),
    );

    expect(result).toEqual({
      totalCandidates: 11,
      totalFound: 22,
      totalInvalidated: 33,
      totalSkippedAlreadyNotValid: 44,
      totalSkippedProtected: 55,
      totalSkippedNotFound: 66,
    });
  });
});

/**
 * Y la terna de la retro, que corre el mismo riesgo y por lo mismo (`b4rrhh/frontend#85`).
 *
 * El cliente generado los declara opcionales, el `?? 0` los apaga, y la pantalla pintaria tres ceros
 * perfectamente creibles: «esta corrida no recalculo nada» es una frase que se lee sin sospechar. Los
 * cinco valores son distintos entre si a proposito, porque con valores repetidos dos campos cruzados
 * darian el mismo resultado.
 */
describe('Los contadores de la retro llegan a la pantalla sin cruzarse', () => {
  it('los cinco campos del #132', async () => {
    const getPayrollCalculationRun = vi.fn().mockReturnValue(
      of({
        runId: 9,
        status: 'COMPLETED',
        ruleSystemCode: 'ESP',
        payrollPeriodCode: '202609',
        requestedAt: '2026-09-27T10:00:00',
        retroLimitPeriodCode: '202509',
        retroFloorPeriodCode: '202601',
        totalRetroUnits: 111,
        totalRetroRecalculated: 222,
        totalRetroNotRecalculated: 333,
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        OperacionesGateway,
        { provide: PayrollService, useValue: {} },
        {
          provide: PayrollCalculationRunService,
          useValue: { getPayrollCalculationRun } as unknown as PayrollCalculationRunService,
        },
      ],
    });

    const run = await new Promise<CalculationRun>((resolve) =>
      TestBed.inject(OperacionesGateway).getCalculationRun(9).subscribe(resolve),
    );

    expect(run.retroLimitPeriodCode).toBe('202509');
    expect(run.retroFloorPeriodCode).toBe('202601');
    expect(run.totalRetroUnits).toBe(111);
    expect(run.totalRetroRecalculated).toBe(222);
    expect(run.totalRetroNotRecalculated).toBe(333);
  });

  /** Una corrida de antes del #132 no trae ninguno de los cinco, y eso no es un cero mentiroso. */
  it('una corrida vieja no los trae, y entonces son nulos y ceros', async () => {
    const getPayrollCalculationRun = vi
      .fn()
      .mockReturnValue(of({ runId: 1, status: 'COMPLETED', requestedAt: '2026-01-01T00:00:00' }));
    TestBed.configureTestingModule({
      providers: [
        OperacionesGateway,
        { provide: PayrollService, useValue: {} },
        {
          provide: PayrollCalculationRunService,
          useValue: { getPayrollCalculationRun } as unknown as PayrollCalculationRunService,
        },
      ],
    });

    const run = await new Promise<CalculationRun>((resolve) =>
      TestBed.inject(OperacionesGateway).getCalculationRun(1).subscribe(resolve),
    );

    expect(run.retroLimitPeriodCode).toBeNull();
    expect(run.retroFloorPeriodCode).toBeNull();
    expect(run.totalRetroUnits).toBe(0);
  });
});
