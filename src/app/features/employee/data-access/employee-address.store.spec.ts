import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeAddressModel } from '../models/employee-address.model';
import { EmployeeAddressGateway } from './employee-address.gateway';
import { EmployeeAddressReadGateway } from './employee-address-read.gateway';
import { EmployeeAddressStore } from './employee-address.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const addressesFixture: ReadonlyArray<EmployeeAddressModel> = [
  {
    addressNumber: 1,
    addressTypeCode: 'HOME',
    street: 'Calle Mayor 10',
    city: 'Madrid',
    countryCode: 'ESP',
    postalCode: '28013',
    regionCode: 'M',
    startDate: '2025-01-01',
    endDate: null,
    isActive: true,
  },
];

describe('EmployeeAddressStore', () => {
  let store: EmployeeAddressStore;
  let readGatewayMock: {
    readEmployeeAddressesByBusinessKey: ReturnType<typeof vi.fn>;
  };
  let gatewayMock: {
    createAddress: ReturnType<typeof vi.fn>;
    updateAddress: ReturnType<typeof vi.fn>;
    closeAddress: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    readGatewayMock = {
      readEmployeeAddressesByBusinessKey: vi.fn().mockReturnValue(of(addressesFixture)),
    };
    gatewayMock = {
      createAddress: vi.fn().mockReturnValue(of(undefined)),
      updateAddress: vi.fn().mockReturnValue(of(undefined)),
      closeAddress: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeAddressReadGateway, useValue: readGatewayMock },
        { provide: EmployeeAddressGateway, useValue: gatewayMock },
      ],
    });

    store = TestBed.inject(EmployeeAddressStore);
  });

  it('loads addresses by business key and exposes addresses state', () => {
    store.loadAddressesByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeAddressesByBusinessKey).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeAddressesByBusinessKey).toHaveBeenCalledWith(
      employeeBusinessKey,
    );
    expect(store.addresses()).toEqual(addressesFixture);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('keeps empty addresses when backend returns no addresses', () => {
    readGatewayMock.readEmployeeAddressesByBusinessKey.mockReturnValue(of([]));

    store.loadAddressesByBusinessKey(employeeBusinessKey);

    expect(store.addresses()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('sets request-failed error when addresses request fails', () => {
    readGatewayMock.readEmployeeAddressesByBusinessKey.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.loadAddressesByBusinessKey(employeeBusinessKey);

    expect(store.addresses()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('request-failed');
  });

  it('resets addresses state when route has no active business key', () => {
    store.loadAddressesByBusinessKey(employeeBusinessKey);

    store.loadAddressesByBusinessKey(null);

    expect(store.selectedEmployeeKey()).toBeNull();
    expect(store.addresses()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('does not reload addresses when same business key is already loaded', () => {
    store.loadAddressesByBusinessKey(employeeBusinessKey);
    store.loadAddressesByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeAddressesByBusinessKey).toHaveBeenCalledTimes(1);
  });

  it('creates address and forces reload from backend after success', () => {
    store.loadAddresses(employeeBusinessKey);

    store.createAddress(employeeBusinessKey, {
      addressTypeCode: 'HOME',
      street: 'Avenida Demo 12',
      city: 'Madrid',
      countryCode: 'ESP',
      postalCode: '28001',
      regionCode: 'M',
      startDate: '2026-01-01',
    });

    expect(gatewayMock.createAddress).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeAddressesByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('created');
  });

  it('closes address and forces reload from backend after success', () => {
    store.loadAddresses(employeeBusinessKey);

    store.closeAddress(employeeBusinessKey, 1, '2026-01-31');

    expect(gatewayMock.closeAddress).toHaveBeenCalledWith(employeeBusinessKey, 1, '2026-01-31');
    expect(readGatewayMock.readEmployeeAddressesByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('closed');
  });

  it('updates address and forces reload from backend after success', () => {
    store.loadAddresses(employeeBusinessKey);

    store.updateAddress(employeeBusinessKey, 1, {
      street: 'Calle Nueva 20',
      city: 'Madrid',
      countryCode: 'ESP',
      postalCode: '28009',
      regionCode: 'M',
    });

    expect(gatewayMock.updateAddress).toHaveBeenCalledWith(employeeBusinessKey, 1, {
      street: 'Calle Nueva 20',
      city: 'Madrid',
      countryCode: 'ESP',
      postalCode: '28009',
      regionCode: 'M',
    });
    expect(readGatewayMock.readEmployeeAddressesByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('updated');
  });

  it('sets request-failed error when create address fails', () => {
    gatewayMock.createAddress.mockReturnValue(throwError(() => new Error('backend unavailable')));

    store.createAddress(employeeBusinessKey, {
      addressTypeCode: 'HOME',
      street: 'Avenida Demo 12',
      city: 'Madrid',
      countryCode: 'ESP',
      postalCode: '',
      regionCode: '',
      startDate: '2026-01-01',
    });

    expect(store.error()).toBe('request-failed');
    expect(store.mutating()).toBe(false);
  });

  it('clears success and error feedback without touching addresses data', () => {
    store.loadAddresses(employeeBusinessKey);
    store.createAddress(employeeBusinessKey, {
      addressTypeCode: 'HOME',
      street: 'Avenida Demo 12',
      city: 'Madrid',
      countryCode: 'ESP',
      postalCode: '28001',
      regionCode: 'M',
      startDate: '2026-01-01',
    });

    expect(store.success()).toBe('created');
    expect(store.addresses()).toEqual(addressesFixture);

    store.clearFeedback();

    expect(store.success()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.addresses()).toEqual(addressesFixture);
  });
});
