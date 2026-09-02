import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeePresenceModel } from '../models/employee-presence.model';
import { EmployeePresenceReadGateway } from './employee-presence-read.gateway';
import { EmployeePresenceStore } from './employee-presence.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const presencesFixture: ReadonlyArray<EmployeePresenceModel> = [
  {
    presenceNumber: 3,
    companyCode: 'COMP-ES',
    entryReasonCode: 'HIRE',
    exitReasonCode: null,
    startDate: '2024-06-01',
    endDate: null,
    isActive: true,
  },
  {
    presenceNumber: 2,
    companyCode: 'COMP-ES',
    entryReasonCode: 'TRANSFER',
    exitReasonCode: 'END',
    startDate: '2022-01-01',
    endDate: '2024-05-31',
    isActive: false,
  },
];

describe('EmployeePresenceStore', () => {
  let store: EmployeePresenceStore;
  let readGatewayMock: {
    readEmployeePresencesByBusinessKey: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    readGatewayMock = {
      readEmployeePresencesByBusinessKey: vi.fn().mockReturnValue(of(presencesFixture)),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: EmployeePresenceReadGateway, useValue: readGatewayMock }],
    });

    store = TestBed.inject(EmployeePresenceStore);
  });

  it('loads presences by business key and exposes presence state', () => {
    store.loadPresencesByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeePresencesByBusinessKey).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeePresencesByBusinessKey).toHaveBeenCalledWith(
      employeeBusinessKey,
    );
    expect(store.presences()).toEqual(presencesFixture);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('keeps empty presences when backend returns no presences', () => {
    readGatewayMock.readEmployeePresencesByBusinessKey.mockReturnValue(of([]));

    store.loadPresencesByBusinessKey(employeeBusinessKey);

    expect(store.presences()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('sets request-failed error when presences request fails', () => {
    readGatewayMock.readEmployeePresencesByBusinessKey.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.loadPresencesByBusinessKey(employeeBusinessKey);

    expect(store.presences()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('request-failed');
  });

  it('resets presences state when route has no active business key', () => {
    store.loadPresencesByBusinessKey(employeeBusinessKey);

    store.loadPresencesByBusinessKey(null);

    expect(store.selectedEmployeeKey()).toBeNull();
    expect(store.presences()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('does not reload presences when same business key is already loaded', () => {
    store.loadPresencesByBusinessKey(employeeBusinessKey);
    store.loadPresencesByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeePresencesByBusinessKey).toHaveBeenCalledTimes(1);
  });

  it('forces presence reload when refresh is requested for the same business key', () => {
    store.loadPresencesByBusinessKey(employeeBusinessKey);
    store.refreshPresencesByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeePresencesByBusinessKey).toHaveBeenCalledTimes(2);
  });
});
