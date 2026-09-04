import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { EmployeeWorkingTimeModel } from '../models/employee-working-time.model';
import { EmployeeWorkingTimePlanModel } from '../models/employee-working-time-plan.model';
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

const acceptedPlan: EmployeeWorkingTimePlanModel = {
  operation: 'ADD',
  accepted: true,
  rejection: null,
  occurrence: { workingTimeNumber: null, startDate: '2026-04-01', endDate: null },
  adjustedOccurrence: {
    workingTimeNumber: 2,
    before: { startDate: '2026-01-01', endDate: null },
    after: { startDate: '2026-01-01', endDate: '2026-03-31' },
  },
  overlaps: [],
  gaps: [],
  stretchCandidates: [],
  projected: [],
};

describe('EmployeeWorkingTimeStore', () => {
  let store: EmployeeWorkingTimeStore;
  let gatewayMock: {
    getEmployeeWorkingTimes: ReturnType<typeof vi.fn>;
    createEmployeeWorkingTime: ReturnType<typeof vi.fn>;
    deleteEmployeeWorkingTime: ReturnType<typeof vi.fn>;
    planEmployeeWorkingTimeChange: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      getEmployeeWorkingTimes: vi.fn().mockReturnValue(of(workingTimesFixture)),
      createEmployeeWorkingTime: vi.fn().mockReturnValue(of(undefined)),
      deleteEmployeeWorkingTime: vi.fn().mockReturnValue(of(undefined)),
      planEmployeeWorkingTimeChange: vi.fn().mockReturnValue(of(acceptedPlan)),
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
      endDate: null,
      workingTimePercentage: 90,
    });

    expect(gatewayMock.createEmployeeWorkingTime).toHaveBeenCalledWith(employeeBusinessKey, {
      startDate: '2026-04-01',
      endDate: null,
      workingTimePercentage: 90,
    });
    expect(gatewayMock.getEmployeeWorkingTimes).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('created');
  });

  it('maps known functional backend code on mutation failure', () => {
    gatewayMock.createEmployeeWorkingTime.mockReturnValue(
      throwError(() => ({ error: { code: 'WORKING_TIME_OUTSIDE_PRESENCE' } })),
    );

    store.loadWorkingTimesByBusinessKey(employeeBusinessKey);
    store.createWorkingTime(employeeBusinessKey, {
      startDate: '2024-01-01',
      endDate: null,
      workingTimePercentage: 90,
    });

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
      endDate: null,
      workingTimePercentage: 90,
    });

    expect(store.error()).toBe('request-failed');
    expect(store.workingTimes()).toEqual(workingTimesFixture);
    expect(store.mutating()).toBe(false);
  });

  it('deletes a working time and refreshes list on success', () => {
    store.loadWorkingTimesByBusinessKey(employeeBusinessKey);

    store.deleteWorkingTime(employeeBusinessKey, 2);

    expect(gatewayMock.deleteEmployeeWorkingTime).toHaveBeenCalledWith(employeeBusinessKey, 2);
    expect(gatewayMock.getEmployeeWorkingTimes).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('deleted');
  });

  it('keeps the dates of an invariant rejection next to its code', () => {
    gatewayMock.deleteEmployeeWorkingTime.mockReturnValue(
      throwError(() => ({
        error: {
          code: 'WORKING_TIME_COVERAGE_GAP',
          details: {
            gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
            stretchCandidates: [
              { workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
            ],
          },
        },
      })),
    );

    store.loadWorkingTimesByBusinessKey(employeeBusinessKey);
    store.deleteWorkingTime(employeeBusinessKey, 2);

    expect(store.error()).toBe('WORKING_TIME_COVERAGE_GAP');
    expect(store.errorConflict()).toEqual({
      overlaps: [],
      gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
      stretchCandidates: [{ workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' }],
    });

    store.clearFeedback();

    expect(store.errorConflict()).toBeNull();
  });

  describe('planning a change', () => {
    it('asks the gateway and exposes the plan', () => {
      store.planChange(employeeBusinessKey, {
        operation: 'ADD',
        startDate: '2026-04-01',
        endDate: null,
      });

      expect(gatewayMock.planEmployeeWorkingTimeChange).toHaveBeenCalledWith(employeeBusinessKey, {
        operation: 'ADD',
        startDate: '2026-04-01',
        endDate: null,
      });
      expect(store.plan()).toEqual(acceptedPlan);
      expect(store.planning()).toBe(false);
    });

    it('has no plan while the answer is pending, and ignores an answer that was overtaken', () => {
      const first = new Subject<EmployeeWorkingTimePlanModel>();
      const second = new Subject<EmployeeWorkingTimePlanModel>();
      gatewayMock.planEmployeeWorkingTimeChange
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(second);

      store.planChange(employeeBusinessKey, { operation: 'REMOVE', workingTimeNumber: 2 });
      expect(store.plan()).toBeNull();
      expect(store.planning()).toBe(true);

      store.planChange(employeeBusinessKey, { operation: 'REMOVE', workingTimeNumber: 1 });
      first.next({ ...acceptedPlan, operation: 'REMOVE' });

      expect(store.plan()).toBeNull();
      expect(store.planning()).toBe(true);

      second.next({ ...acceptedPlan, accepted: false, rejection: 'GAP_NOT_ALLOWED' });

      expect(store.plan()?.rejection).toBe('GAP_NOT_ALLOWED');
      expect(store.planning()).toBe(false);
    });

    it('clearPlan drops the plan and whatever answer is still on its way', () => {
      const pending = new Subject<EmployeeWorkingTimePlanModel>();
      gatewayMock.planEmployeeWorkingTimeChange.mockReturnValueOnce(pending);

      store.planChange(employeeBusinessKey, { operation: 'REMOVE', workingTimeNumber: 2 });
      store.clearPlan();
      pending.next(acceptedPlan);

      expect(store.plan()).toBeNull();
      expect(store.planning()).toBe(false);
    });

    it('reports a failed plan request as an error and leaves no plan', () => {
      gatewayMock.planEmployeeWorkingTimeChange.mockReturnValue(
        throwError(() => ({ status: 500 })),
      );

      store.planChange(employeeBusinessKey, { operation: 'REMOVE', workingTimeNumber: 2 });

      expect(store.plan()).toBeNull();
      expect(store.planning()).toBe(false);
      expect(store.error()).toBe('request-failed');
    });
  });
});
