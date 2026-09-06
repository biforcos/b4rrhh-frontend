import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeAddressModel } from '../models/employee-address.model';
import { EmployeeAddressPlanModel } from '../models/employee-address-plan.model';
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

const planFixture: EmployeeAddressPlanModel = {
  operation: 'ADD',
  accepted: true,
  rejection: null,
  occurrence: { addressNumber: null, startDate: '2026-03-01', endDate: null },
  correctedOccurrence: null,
  adjustedOccurrence: null,
  overlaps: [],
  gaps: [],
  stretchCandidates: [],
  projected: [],
};

describe('EmployeeAddressStore', () => {
  let store: EmployeeAddressStore;
  let readGatewayMock: {
    readEmployeeAddressesByBusinessKey: ReturnType<typeof vi.fn>;
  };
  let gatewayMock: {
    createAddress: ReturnType<typeof vi.fn>;
    correctAddress: ReturnType<typeof vi.fn>;
    deleteAddress: ReturnType<typeof vi.fn>;
    planAddressChange: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    readGatewayMock = {
      readEmployeeAddressesByBusinessKey: vi.fn().mockReturnValue(of(addressesFixture)),
    };
    gatewayMock = {
      createAddress: vi.fn().mockReturnValue(of(undefined)),
      correctAddress: vi.fn().mockReturnValue(of(undefined)),
      deleteAddress: vi.fn().mockReturnValue(of(undefined)),
      planAddressChange: vi.fn().mockReturnValue(of(planFixture)),
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
      endDate: '',
    });

    expect(gatewayMock.createAddress).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeAddressesByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('created');
  });

  it('corrects address and forces reload from backend after success', () => {
    store.loadAddresses(employeeBusinessKey);

    const correction = {
      street: 'Calle Nueva 20',
      city: 'Madrid',
      countryCode: 'ESP',
      postalCode: '28009',
      regionCode: 'M',
      startDate: '2025-01-01',
      endDate: '',
    };
    store.correctAddress(employeeBusinessKey, 1, correction);

    expect(gatewayMock.correctAddress).toHaveBeenCalledWith(employeeBusinessKey, 1, correction);
    expect(readGatewayMock.readEmployeeAddressesByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('corrected');
  });

  it('removes address and forces reload from backend after success', () => {
    store.loadAddresses(employeeBusinessKey);

    store.deleteAddress(employeeBusinessKey, 1);

    expect(gatewayMock.deleteAddress).toHaveBeenCalledWith(employeeBusinessKey, 1);
    expect(readGatewayMock.readEmployeeAddressesByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('deleted');
  });

  it('asks the backend for the plan and keeps it until it is cleared', () => {
    const draft = {
      operation: 'ADD' as const,
      addressTypeCode: 'HOME',
      startDate: '2026-03-01',
      endDate: null,
    };
    store.planChange(employeeBusinessKey, draft);

    expect(gatewayMock.planAddressChange).toHaveBeenCalledWith(employeeBusinessKey, draft);
    expect(store.plan()).toBe(planFixture);
    expect(store.planning()).toBe(false);

    store.clearPlan();

    expect(store.plan()).toBeNull();
  });

  // El 409 de invariante trae las fechas del hueco o del solape: se guardan para contarlo.
  it('keeps the dates a rejection names alongside its code', () => {
    gatewayMock.createAddress.mockReturnValue(
      throwError(() => ({
        error: {
          code: 'ADDRESS_COVERAGE_GAP',
          details: { gaps: [{ startDate: '2026-02-01', endDate: '2026-02-28' }] },
        },
      })),
    );

    store.createAddress(employeeBusinessKey, {
      addressTypeCode: 'HOME',
      street: 'Avenida Demo 12',
      city: 'Madrid',
      countryCode: 'ESP',
      postalCode: '',
      regionCode: '',
      startDate: '2026-03-01',
      endDate: '',
    });

    expect(store.error()).toBe('ADDRESS_COVERAGE_GAP');
    expect(store.errorConflict()?.gaps).toEqual([
      { startDate: '2026-02-01', endDate: '2026-02-28' },
    ]);
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
      endDate: '',
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
      endDate: '',
    });

    expect(store.success()).toBe('created');
    expect(store.addresses()).toEqual(addressesFixture);

    store.clearFeedback();

    expect(store.success()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.addresses()).toEqual(addressesFixture);
  });
});
