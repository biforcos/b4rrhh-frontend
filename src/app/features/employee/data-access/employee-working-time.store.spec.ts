import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeWorkingTimeModel } from '../models/employee-working-time.model';
import { EmployeeWorkingTimeGateway } from './employee-working-time.gateway';
import { EmployeeWorkingTimeStore } from './employee-working-time.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const workingTimesFixture: ReadonlyArray<EmployeeWorkingTimeModel> = [
  {
    workingTimeNumber: 2,
    startDate: '2026-01-01',
    endDate: null,
    workingTimePercentage: 80,
    weeklyHours: 32,
    dailyHours: 6.4,
    monthlyHours: 133.33,
    isActive: true,
  },
  {
    workingTimeNumber: 1,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    workingTimePercentage: 50,
    weeklyHours: 20,
    dailyHours: 4,
    monthlyHours: 83.33,
    isActive: false,
  },
];

describe('EmployeeWorkingTimeStore', () => {
  let store: EmployeeWorkingTimeStore;
  let gatewayMock: {
    getEmployeeWorkingTimes: ReturnType<typeof vi.fn>;
    createEmployeeWorkingTime: ReturnType<typeof vi.fn>;
    closeEmployeeWorkingTime: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      getEmployeeWorkingTimes: vi.fn().mockReturnValue(of(workingTimesFixture)),
      createEmployeeWorkingTime: vi.fn().mockReturnValue(of(undefined)),
      closeEmployeeWorkingTime: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeWorkingTimeGateway, useValue: gatewayMock }],
    });

    store = TestBed.inject(EmployeeWorkingTimeStore);
  });

  it('loads working times by business key', () => {
    store.loadWorkingTimesByBusinessKey(employeeBusinessKey);

    expect(gatewayMock.getEmployeeWorkingTimes).toHaveBeenCalledWith(employeeBusinessKey);
    expect(store.workingTimes()).toEqual(workingTimesFixture);
    expect(store.error()).toBeNull();
  });

  it('creates working time and refreshes list on success', () => {
    store.loadWorkingTimesByBusinessKey(employeeBusinessKey);

    store.createWorkingTime(employeeBusinessKey, {
      startDate: '2026-04-01',
      workingTimePercentage: 90,
    });

    expect(gatewayMock.createEmployeeWorkingTime).toHaveBeenCalledWith(employeeBusinessKey, {
      startDate: '2026-04-01',
      workingTimePercentage: 90,
    });
    expect(gatewayMock.getEmployeeWorkingTimes).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('created');
  });

  it('closes active working time and refreshes list on success', () => {
    store.loadWorkingTimesByBusinessKey(employeeBusinessKey);

    store.closeWorkingTime(employeeBusinessKey, 2, { endDate: '2026-05-31' });

    expect(gatewayMock.closeEmployeeWorkingTime).toHaveBeenCalledWith(employeeBusinessKey, 2, {
      endDate: '2026-05-31',
    });
    expect(gatewayMock.getEmployeeWorkingTimes).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('closed');
  });

  it('maps known functional backend code on mutation failure', () => {
    gatewayMock.closeEmployeeWorkingTime.mockReturnValue(
      throwError(() => ({ error: { code: 'WORKING_TIME_OUTSIDE_PRESENCE' } })),
    );

    store.loadWorkingTimesByBusinessKey(employeeBusinessKey);
    store.closeWorkingTime(employeeBusinessKey, 2, { endDate: '2024-01-01' });

    expect(store.error()).toBe('WORKING_TIME_OUTSIDE_PRESENCE');
    expect(store.workingTimes()).toEqual(workingTimesFixture);
    expect(store.mutating()).toBe(false);
  });

  it('falls back to request-failed for unknown backend code', () => {
    gatewayMock.createEmployeeWorkingTime.mockReturnValue(
      throwError(() => ({ error: { code: 'UNKNOWN_WORKING_TIME_CODE' } })),
    );

    store.loadWorkingTimesByBusinessKey(employeeBusinessKey);
    store.createWorkingTime(employeeBusinessKey, {
      startDate: '2026-04-01',
      workingTimePercentage: 90,
    });

    expect(store.error()).toBe('request-failed');
    expect(store.workingTimes()).toEqual(workingTimesFixture);
    expect(store.mutating()).toBe(false);
  });
});
