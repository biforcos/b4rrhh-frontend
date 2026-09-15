import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { PayrollCalculationRunService } from '../../../../core/api/generated/api/payroll-calculation-run.service';
import { PayrollService } from '../../../../core/api/generated/api/payroll.service';
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
          statusReasonCode: 'BULK_RESET',
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
