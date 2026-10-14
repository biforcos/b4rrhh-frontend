import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { RuleSystemScopeStore } from '../../../../core/scope/rule-system-scope.store';
import { OpenPayrollPeriodService } from '../../recibos/store/open-payroll-period.service';
import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { OperacionesStore } from './operaciones.store';

/**
 * Operaciones abre en el período abierto, no en el mes de hoy (`b4rrhh/frontend#143`): con
 * septiembre abierto y octubre en el calendario, abría en octubre y había que retroceder para
 * operar. Recibos ya abría en el abierto (`frontend#93`).
 */
describe('Operaciones: dónde abre', () => {
  function montar(abierto: Promise<string | null>): OperacionesStore {
    TestBed.configureTestingModule({
      providers: [
        OperacionesStore,
        {
          provide: OperacionesGateway,
          useValue: { listEmployeeTypes: vi.fn().mockReturnValue(of(['INTERNAL'])) },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: RuleSystemScopeStore, useValue: { whenResolved: () => of('ESP') } },
        { provide: OpenPayrollPeriodService, useValue: { find: () => abierto } },
      ],
    });
    return TestBed.inject(OperacionesStore);
  }

  it('en el período abierto, con su límite de retro', async () => {
    const store = montar(Promise.resolve('202609'));

    await vi.waitFor(() => expect(store.period()).toBe(202609));
    expect(store.retroLimitPeriod()).toBe(202509);
  });

  it('si alguien ya ha movido el período, el abierto no lo pisa al llegar', async () => {
    let contestar: (v: string) => void = () => undefined;
    const store = montar(new Promise((r) => (contestar = r)));

    store.setPeriod(202512);
    contestar('202609');
    await Promise.resolve();
    await Promise.resolve();

    expect(store.period()).toBe(202512);
  });

  it('sin recibos todavía no hay abierto que decir: se queda en el mes de hoy', async () => {
    const hoy = new Date();
    const store = montar(Promise.resolve(null));
    await Promise.resolve();

    expect(store.period()).toBe(hoy.getFullYear() * 100 + hoy.getMonth() + 1);
  });
});
