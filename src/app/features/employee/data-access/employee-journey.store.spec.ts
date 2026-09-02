import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeJourneyModel } from '../models/employee-journey.model';
import { EmployeeJourneyReadGateway } from './employee-journey-read.gateway';
import { EmployeeJourneyStore } from './employee-journey.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const employeeJourneyFixture: EmployeeJourneyModel = {
  employee: {
    ruleSystemCode: 'PA-ES',
    employeeTypeCode: 'CONTRACTOR',
    employeeNumber: '00012345',
    displayName: 'Alex Martin',
  },
  events: [
    {
      eventDate: '2024-01-01',
      eventType: 'CONTRACT_START',
      trackCode: 'CONTRACT',
      status: 'current',
      isCurrent: true,
      details: {
        contractCode: 'IND',
      },
    },
  ],
};

describe('EmployeeJourneyStore', () => {
  let store: EmployeeJourneyStore;
  let readGatewayMock: {
    readEmployeeJourneyByBusinessKey: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    readGatewayMock = {
      readEmployeeJourneyByBusinessKey: vi.fn().mockReturnValue(of(employeeJourneyFixture)),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeJourneyReadGateway, useValue: readGatewayMock }],
    });

    store = TestBed.inject(EmployeeJourneyStore);
  });

  it('loads journey by business key and exposes journey state', () => {
    store.loadJourneyByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeJourneyByBusinessKey).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeJourneyByBusinessKey).toHaveBeenCalledWith(employeeBusinessKey);
    expect(store.journey()).toEqual(employeeJourneyFixture);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('keeps empty events when backend returns empty journey', () => {
    readGatewayMock.readEmployeeJourneyByBusinessKey.mockReturnValue(
      of({
        employee: employeeJourneyFixture.employee,
        events: [],
      }),
    );

    store.loadJourneyByBusinessKey(employeeBusinessKey);

    expect(store.journey()).toEqual({
      employee: employeeJourneyFixture.employee,
      events: [],
    });
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('sets request-failed error when journey request fails', () => {
    readGatewayMock.readEmployeeJourneyByBusinessKey.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.loadJourneyByBusinessKey(employeeBusinessKey);

    expect(store.journey()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('request-failed');
  });

  it('resets journey state when route has no active business key', () => {
    store.loadJourneyByBusinessKey(employeeBusinessKey);

    store.loadJourneyByBusinessKey(null);

    expect(store.selectedEmployeeKey()).toBeNull();
    expect(store.journey()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('does not reload journey when same business key is already loaded', () => {
    store.loadJourneyByBusinessKey(employeeBusinessKey);
    store.loadJourneyByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeJourneyByBusinessKey).toHaveBeenCalledTimes(1);
  });

  it('forces journey reload when refresh is requested for the same business key', () => {
    store.loadJourneyByBusinessKey(employeeBusinessKey);
    store.refreshJourneyByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeJourneyByBusinessKey).toHaveBeenCalledTimes(2);
  });
});