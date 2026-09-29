import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { OperacionesGateway } from '../../nomina/operaciones/gateway/operaciones.gateway';
import { RecibosGateway } from '../../nomina/recibos/gateway/recibos.gateway';
import { PayrollSummaryModel } from '../../nomina/recibos/models/payroll-summary.model';
import { EmployeePresenceModel } from '../models/employee-presence.model';
import { EmployeePayrollLaunchStore } from './employee-payroll-launch.store';

const KEY = { ruleSystemCode: 'ESP', employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP000001' };

function receipt(
  status: PayrollSummaryModel['status'],
  period = '202609',
  presenceNumber = 2,
): PayrollSummaryModel {
  return {
    ...KEY,
    payrollPeriodCode: period,
    payrollTypeCode: 'NORMAL',
    presenceNumber,
    status,
    calculatedAt: '2026-09-28T10:00:00',
  };
}

function presence(startDate: string, endDate: string | null): EmployeePresenceModel {
  return {
    presenceNumber: 2,
    companyCode: 'ES01',
    entryReasonCode: 'HIRING',
    exitReasonCode: null,
    startDate,
    endDate,
    isActive: endDate === null,
  };
}

/**
 * «Calcular nómina» en la ficha calcula la nómina de ese empleado (`b4rrhh/frontend#97`).
 */
describe('EmployeePayrollLaunchStore', () => {
  let store: EmployeePayrollLaunchStore;
  let recibos: { search: ReturnType<typeof vi.fn>; invalidate: ReturnType<typeof vi.fn> };
  let operaciones: { launchCalculation: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  function withReceipts(latest: PayrollSummaryModel, own: PayrollSummaryModel[]): void {
    recibos.search.mockImplementation((filters: { employeeNumber: string }) =>
      of({
        items: filters.employeeNumber ? own : [latest],
        page: 0,
        size: 1,
        total: 1,
      }),
    );
  }

  beforeEach(() => {
    recibos = { search: vi.fn(), invalidate: vi.fn(() => of(receipt('NOT_VALID'))) };
    operaciones = { launchCalculation: vi.fn(() => of({ runId: 11 })) };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      providers: [
        EmployeePayrollLaunchStore,
        { provide: RecibosGateway, useValue: recibos },
        { provide: OperacionesGateway, useValue: operaciones },
        { provide: Router, useValue: router },
      ],
    });
    store = TestBed.inject(EmployeePayrollLaunchStore);
  });

  it('lanza para él solo, en el periodo abierto, con el limite por defecto y sin suelo', async () => {
    withReceipts(receipt('CALCULATED'), []);

    await store.prepare(KEY, [presence('2026-03-22', null)]);
    const state = store.state();
    expect(state.kind).toBe('armed');
    expect(state.kind === 'armed' && state.plan.line).toContain(
      'Calcula septiembre de 2026 de EMP000001',
    );

    await store.confirm();

    expect(recibos.invalidate).not.toHaveBeenCalled();
    expect(operaciones.launchCalculation).toHaveBeenCalledWith(
      expect.objectContaining({
        payrollPeriodCode: '202609',
        targetSelection: {
          selectionType: 'SINGLE_EMPLOYEE',
          employee: { employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP000001' },
        },
        retroLimitPeriodCode: '202509',
        retroFloorPeriodCode: null,
      }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/nomina/operaciones', 11]);
  });

  it('si ya tiene recibo sin cerrar, lo invalida antes: calcular no acaba en «ya tenia recibo»', async () => {
    withReceipts(receipt('CALCULATED'), [receipt('CALCULATED')]);

    await store.prepare(KEY, [presence('2026-03-22', null)]);
    const state = store.state();
    expect(state.kind === 'armed' && state.plan.line).toContain('su recibo se invalida');

    await store.confirm();

    expect(recibos.invalidate).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeNumber: 'EMP000001',
        payrollPeriodCode: '202609',
        presenceNumber: 2,
      }),
    );
    expect(operaciones.launchCalculation).toHaveBeenCalled();
  });

  it('con el mes mas reciente cerrado, el abierto es el siguiente', async () => {
    withReceipts(receipt('DEFINITIVE', '202608'), []);

    await store.prepare(KEY, [presence('2026-03-22', null)]);
    const state = store.state();
    expect(state.kind === 'armed' && state.plan.period).toBe('202609');
  });

  it('dice que no puede si no esta de alta ningun dia del mes', async () => {
    withReceipts(receipt('CALCULATED'), []);

    await store.prepare(KEY, [presence('2025-12-08', '2026-01-27')]);

    expect(store.state()).toEqual({
      kind: 'blocked',
      reason:
        'EMP000001 no está de alta ningún día de septiembre de 2026: no hay nómina que calcular.',
    });
    await store.confirm();
    expect(operaciones.launchCalculation).not.toHaveBeenCalled();
  });

  it('dice que no puede si el mes ya esta cerrado para el', async () => {
    withReceipts(receipt('CALCULATED'), [receipt('DEFINITIVE')]);

    await store.prepare(KEY, [presence('2026-03-22', null)]);

    const state = store.state();
    expect(state.kind).toBe('blocked');
    expect(state.kind === 'blocked' && state.reason).toContain('ya está cerrado para EMP000001');
  });
});
