import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { PayrollEngineService } from '../../../../core/api/generated/api/payroll-engine.service';
import { PayrollService } from '../../../../core/api/generated/api/payroll.service';
import { RecibosClient } from './recibos.client';

/**
 * «Número o nombre…» busca por lo escrito, en parte (b4rrhh/frontend#141): va como `q`, no como la
 * matrícula exacta, que sólo encontraba «EMP000025» entero.
 */
describe('RecibosClient', () => {
  it('manda lo escrito como q, sin espacios alrededor', () => {
    const searchPayrolls = vi.fn().mockReturnValue(of({ items: [], page: 0, size: 50, total: 0 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: PayrollService, useValue: { searchPayrolls } },
        { provide: PayrollEngineService, useValue: {} },
      ],
    });

    TestBed.inject(RecibosClient)
      .search({ payrollPeriodCode: '202609', employeeNumber: ' 0025 ', status: '' }, 0, 50)
      .subscribe();

    expect(searchPayrolls).toHaveBeenCalledWith(
      expect.objectContaining({ q: '0025', payrollPeriodCode: '202609' }),
    );
    expect(searchPayrolls.mock.calls[0][0]).not.toHaveProperty('employeeNumber');
  });
});
