import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeWorkCenterModel } from '../models/employee-work-center.model';
import { EmployeeWorkCenterGateway } from './employee-work-center.gateway';
import { EmployeeWorkCenterStore } from './employee-work-center.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const workCentersFixture: ReadonlyArray<EmployeeWorkCenterModel> = [
  {
    workCenterAssignmentNumber: 10,
    workCenterCode: 'MAD-01',
    startDate: '2025-01-01',
    endDate: null,
    isActive: true,
    canDelete: true,
    startsAtPresenceStart: false,
    deleteForbiddenReason: null,
  },
  {
    workCenterAssignmentNumber: 9,
    workCenterCode: 'BCN-02',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    isActive: false,
    canDelete: true,
    startsAtPresenceStart: false,
    deleteForbiddenReason: null,
  },
];

describe('EmployeeWorkCenterStore', () => {
  let store: EmployeeWorkCenterStore;
  let gatewayMock: {
    readWorkCenters: ReturnType<typeof vi.fn>;
    createWorkCenter: ReturnType<typeof vi.fn>;
    closeWorkCenter: ReturnType<typeof vi.fn>;
    correctWorkCenter: ReturnType<typeof vi.fn>;
    deleteWorkCenter: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      readWorkCenters: vi.fn().mockReturnValue(of(workCentersFixture)),
      createWorkCenter: vi.fn().mockReturnValue(of(undefined)),
      closeWorkCenter: vi.fn().mockReturnValue(of(undefined)),
      correctWorkCenter: vi.fn().mockReturnValue(of(undefined)),
      deleteWorkCenter: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeWorkCenterGateway, useValue: gatewayMock }],
    });

    store = TestBed.inject(EmployeeWorkCenterStore);
  });

  it('loads work centers by business key', () => {
    store.loadWorkCenters(employeeBusinessKey);

    expect(gatewayMock.readWorkCenters).toHaveBeenCalledWith(employeeBusinessKey);
    expect(store.workCenters()).toEqual(workCentersFixture);
    expect(store.error()).toBeNull();
  });

  it('forces work center reload when refresh is requested for the same business key', () => {
    store.loadWorkCenters(employeeBusinessKey);
    store.refreshWorkCenters(employeeBusinessKey);

    expect(gatewayMock.readWorkCenters).toHaveBeenCalledTimes(2);
  });

  it('creates work center and refreshes list on success', () => {
    store.loadWorkCenters(employeeBusinessKey);

    store.createWorkCenter(employeeBusinessKey, {
      workCenterCode: 'VAL-03',
      startDate: '2026-01-01',
      endDate: '',
    });

    expect(gatewayMock.createWorkCenter).toHaveBeenCalledWith(employeeBusinessKey, {
      workCenterCode: 'VAL-03',
      startDate: '2026-01-01',
      endDate: '',
    });
    expect(gatewayMock.readWorkCenters).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('created');
  });

  it('closes current work center and refreshes list on success', () => {
    store.loadWorkCenters(employeeBusinessKey);

    store.closeWorkCenter(employeeBusinessKey, 10, '2026-06-30');

    expect(gatewayMock.closeWorkCenter).toHaveBeenCalledWith(employeeBusinessKey, 10, '2026-06-30');
    expect(gatewayMock.readWorkCenters).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('closed');
  });

  it('corrects existing work center occurrence and refreshes list on success', () => {
    store.loadWorkCenters(employeeBusinessKey);

    store.correctWorkCenter(employeeBusinessKey, 9, {
      workCenterCode: 'BCN-03',
      startDate: '2024-01-15',
      endDate: '2024-12-15',
    });

    expect(gatewayMock.correctWorkCenter).toHaveBeenCalledWith(employeeBusinessKey, 9, {
      workCenterCode: 'BCN-03',
      startDate: '2024-01-15',
      endDate: '2024-12-15',
    });
    expect(gatewayMock.readWorkCenters).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('corrected');
  });

  it('deletes work center occurrence and refreshes list on success', () => {
    store.loadWorkCenters(employeeBusinessKey);

    store.deleteWorkCenter(employeeBusinessKey, 9);

    expect(gatewayMock.deleteWorkCenter).toHaveBeenCalledWith(employeeBusinessKey, 9);
    expect(gatewayMock.readWorkCenters).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('deleted');
  });

  it('keeps context and sets request-failed when mutation fails', () => {
    gatewayMock.correctWorkCenter.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.loadWorkCenters(employeeBusinessKey);
    store.correctWorkCenter(employeeBusinessKey, 9, {
      workCenterCode: 'BCN-03',
      startDate: '2024-01-15',
      endDate: '',
    });

    expect(store.error()).toBe('request-failed');
    expect(store.workCenters()).toEqual(workCentersFixture);
    expect(store.mutating()).toBe(false);
  });

  it('maps known functional backend code on mutation failure', () => {
    gatewayMock.closeWorkCenter.mockReturnValue(
      throwError(() => ({
        error: {
          code: 'WORK_CENTER_OUTSIDE_PRESENCE',
        },
      })),
    );

    store.loadWorkCenters(employeeBusinessKey);
    store.closeWorkCenter(employeeBusinessKey, 10, '2023-01-01');

    expect(store.error()).toBe('WORK_CENTER_OUTSIDE_PRESENCE');
    expect(store.workCenters()).toEqual(workCentersFixture);
    expect(store.mutating()).toBe(false);
  });

  it('falls back to request-failed for unknown backend functional code', () => {
    gatewayMock.createWorkCenter.mockReturnValue(
      throwError(() => ({
        error: {
          code: 'SOME_UNKNOWN_CODE',
        },
      })),
    );

    store.loadWorkCenters(employeeBusinessKey);
    store.createWorkCenter(employeeBusinessKey, {
      workCenterCode: 'VAL-03',
      startDate: '2026-01-01',
      endDate: '',
    });

    expect(store.error()).toBe('request-failed');
    expect(store.workCenters()).toEqual(workCentersFixture);
    expect(store.mutating()).toBe(false);
  });

  it('maps delete forbidden functional backend code on delete failure', () => {
    gatewayMock.deleteWorkCenter.mockReturnValue(
      throwError(() => ({
        error: {
          code: 'WORK_CENTER_DELETE_FORBIDDEN_AT_PRESENCE_START',
        },
      })),
    );

    store.loadWorkCenters(employeeBusinessKey);
    store.deleteWorkCenter(employeeBusinessKey, 9);

    expect(store.error()).toBe('WORK_CENTER_DELETE_FORBIDDEN_AT_PRESENCE_START');
    expect(store.workCenters()).toEqual(workCentersFixture);
    expect(store.mutating()).toBe(false);
  });
});
