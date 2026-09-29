import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { EmployeeYearSummaryResponse } from '../../../core/api/generated/model/employee-year-summary-response';
import { EmployeeYearModel } from '../models/employee-year.model';
import { EmployeeYearGateway, toEmployeeYearModel } from './employee-year.gateway';
import { EmployeeYearStore } from './employee-year.store';

const KEY = { ruleSystemCode: 'ESP', employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP000003' };

function year(y: number): EmployeeYearModel {
  return { year: y, presences: [], months: [], absences: [] };
}

describe('El año de un empleado (frontend#109)', () => {
  function montar(getYear: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeYearGateway, useValue: { getYear } }],
    });
    return TestBed.inject(EmployeeYearStore);
  }

  it('pide el año del empleado y lo guarda', () => {
    const getYear = vi.fn().mockReturnValue(of(year(2026)));
    const store = montar(getYear);

    store.load(KEY, 2026);

    expect(getYear).toHaveBeenCalledWith(KEY, 2026);
    expect(store.year()?.year).toBe(2026);
    expect(store.loading()).toBe(false);
  });

  it('el año que llega tarde no gana: queda el último que se pidió', () => {
    const y2025 = new Subject<EmployeeYearModel>();
    const y2026 = new Subject<EmployeeYearModel>();
    const store = montar(vi.fn().mockReturnValueOnce(y2025).mockReturnValueOnce(y2026));

    store.load(KEY, 2025);
    store.load(KEY, 2026);
    y2026.next(year(2026));
    y2025.next(year(2025));

    expect(store.year()?.year).toBe(2026);
  });

  it('del contrato al modelo: el período como número y el estado del mes tal cual', () => {
    const response: EmployeeYearSummaryResponse = {
      year: 2026,
      presences: [{ presenceNumber: 1, startDate: '2025-04-25', endDate: null }],
      months: [
        {
          payrollPeriodCode: '202603',
          payrollState: 'CLOSED' as EmployeeYearSummaryResponse['months'][number]['payrollState'],
          payrollInputCount: 1,
          payrollInputConceptCount: 1,
          activeRetroMarkCount: 1,
          consumedRetroMarkCount: 2,
        },
        {
          payrollPeriodCode: '202610',
          payrollState: null,
          payrollInputCount: 0,
          payrollInputConceptCount: 0,
          activeRetroMarkCount: 0,
          consumedRetroMarkCount: 0,
        },
      ],
      absences: [
        {
          absenceTypeCode: 'IT_COMMON',
          startDate: '2026-03-28',
          endDate: '2026-04-04',
          benefitEntitled: true,
        },
      ],
    };

    const model = toEmployeeYearModel(response);

    expect(model.months[0]).toEqual({
      period: 202603,
      payrollState: 'CLOSED',
      payrollInputCount: 1,
      activeRetroMarkCount: 1,
      consumedRetroMarkCount: 2,
    });
    expect(model.months[1].payrollState).toBeNull();
    expect(model.absences[0]).toEqual({
      absenceTypeCode: 'IT_COMMON',
      startDate: '2026-03-28',
      endDate: '2026-04-04',
    });
    expect(model.presences[0]).toEqual({ startDate: '2025-04-25', endDate: null });
  });
});
