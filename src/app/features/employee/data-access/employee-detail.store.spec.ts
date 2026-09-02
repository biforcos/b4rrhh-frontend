import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeDetailModel } from '../models/employee-detail.model';
import { EmployeeDetailGateway } from './employee-detail.gateway';
import { EmployeeDetailReadGateway } from './employee-detail-read.gateway';
import { EmployeeDetailStore } from './employee-detail.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const employeeDetailFixture: EmployeeDetailModel = {
  id: 123,
  ruleSystemCode: employeeBusinessKey.ruleSystemCode,
  employeeTypeCode: employeeBusinessKey.employeeTypeCode,
  employeeNumber: employeeBusinessKey.employeeNumber,
  firstName: 'Lidia',
  lastName1: 'Lopez',
  lastName2: null,
  preferredName: 'Lidia Lopez',
  displayName: 'Lidia Lopez',
  statusLabel: 'ACTIVE',
  workCenter: 'MAD-01',
  photoUrl: null,
};

describe('EmployeeDetailStore', () => {
  let store: EmployeeDetailStore;
  let readGatewayMock: {
    readEmployeeDetailByBusinessKey: ReturnType<typeof vi.fn>;
  };
  let detailGatewayMock: {
    updateEmployeeCoreIdentity: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    readGatewayMock = {
      readEmployeeDetailByBusinessKey: vi.fn().mockReturnValue(of(employeeDetailFixture)),
    };
    detailGatewayMock = {
      updateEmployeeCoreIdentity: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeDetailReadGateway, useValue: readGatewayMock },
        { provide: EmployeeDetailGateway, useValue: detailGatewayMock },
      ],
    });

    store = TestBed.inject(EmployeeDetailStore);
  });

  it('loads detail by business key and exposes detail state', () => {
    store.loadEmployeeDetailByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeDetailByBusinessKey).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeDetailByBusinessKey).toHaveBeenCalledWith(
      employeeBusinessKey,
    );
    expect(store.selectedEmployeeDetail()).toEqual(employeeDetailFixture);
    expect(store.loadingDetail()).toBe(false);
    expect(store.detailError()).toBeNull();
  });

  it('sets not-found error when backend returns no detail for business key', () => {
    readGatewayMock.readEmployeeDetailByBusinessKey.mockReturnValue(of(null));

    store.loadEmployeeDetailByBusinessKey(employeeBusinessKey);

    expect(store.selectedEmployeeDetail()).toBeNull();
    expect(store.loadingDetail()).toBe(false);
    expect(store.detailError()).toBe('not-found');
  });

  it('sets request-failed error when detail request fails', () => {
    readGatewayMock.readEmployeeDetailByBusinessKey.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.loadEmployeeDetailByBusinessKey(employeeBusinessKey);

    expect(store.selectedEmployeeDetail()).toBeNull();
    expect(store.loadingDetail()).toBe(false);
    expect(store.detailError()).toBe('request-failed');
  });

  it('resets detail state when route has no active business key', () => {
    store.loadEmployeeDetailByBusinessKey(employeeBusinessKey);

    store.loadEmployeeDetailByBusinessKey(null);

    expect(store.selectedEmployeeKey()).toBeNull();
    expect(store.selectedEmployeeDetail()).toBeNull();
    expect(store.loadingDetail()).toBe(false);
    expect(store.detailError()).toBeNull();
  });

  it('does not reload detail when same business key is already loaded', () => {
    store.loadEmployeeDetailByBusinessKey(employeeBusinessKey);
    store.loadEmployeeDetailByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeDetailByBusinessKey).toHaveBeenCalledTimes(1);
  });

  it('forces detail reload when refresh is requested for the same business key', () => {
    store.loadEmployeeDetailByBusinessKey(employeeBusinessKey);
    store.refreshEmployeeDetailByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeDetailByBusinessKey).toHaveBeenCalledTimes(2);
  });

  it('updates employee core identity and forces detail reload after success', () => {
    store.loadEmployeeDetailByBusinessKey(employeeBusinessKey);

    store.updateEmployeeCoreIdentity(employeeBusinessKey, {
      firstName: 'Lidia',
      lastName1: 'Lopez',
      lastName2: '',
      preferredName: 'Lidia Lopez',
    });

    expect(detailGatewayMock.updateEmployeeCoreIdentity).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeDetailByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.mutating()).toBe(false);
    expect(store.mutationError()).toBeNull();
    expect(store.mutationSuccess()).toBe('updated');
  });

  it('sets mutation error when employee core identity update fails', () => {
    detailGatewayMock.updateEmployeeCoreIdentity.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.updateEmployeeCoreIdentity(employeeBusinessKey, {
      firstName: 'Lidia',
      lastName1: 'Lopez',
      lastName2: '',
      preferredName: '',
    });

    expect(store.mutating()).toBe(false);
    expect(store.mutationError()).toBe('request-failed');
    expect(store.mutationSuccess()).toBeNull();
  });

  it('clears mutation feedback without touching selected detail', () => {
    store.loadEmployeeDetailByBusinessKey(employeeBusinessKey);
    store.updateEmployeeCoreIdentity(employeeBusinessKey, {
      firstName: 'Lidia',
      lastName1: 'Lopez',
      lastName2: '',
      preferredName: '',
    });

    expect(store.selectedEmployeeDetail()).toEqual(employeeDetailFixture);
    expect(store.mutationSuccess()).toBe('updated');

    store.clearMutationFeedback();

    expect(store.selectedEmployeeDetail()).toEqual(employeeDetailFixture);
    expect(store.mutationError()).toBeNull();
    expect(store.mutationSuccess()).toBeNull();
  });
});
