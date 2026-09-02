import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeIdentifierModel } from '../models/employee-identifier.model';
import { EmployeeIdentifierGateway } from './employee-identifier.gateway';
import { EmployeeIdentifierReadGateway } from './employee-identifier-read.gateway';
import { EmployeeIdentifierStore } from './employee-identifier.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const identifiersFixture: ReadonlyArray<EmployeeIdentifierModel> = [
  {
    typeCode: 'NIF',
    value: '12345678A',
    issuingCountryCode: 'ESP',
    expirationDate: null,
    isPrimary: true,
  },
  {
    typeCode: 'PASSPORT',
    value: 'XK000001',
    issuingCountryCode: 'ESP',
    expirationDate: '2030-12-31',
    isPrimary: false,
  },
];

describe('EmployeeIdentifierStore', () => {
  let store: EmployeeIdentifierStore;
  let readGatewayMock: {
    readEmployeeIdentifiersByBusinessKey: ReturnType<typeof vi.fn>;
  };
  let gatewayMock: {
    createIdentifier: ReturnType<typeof vi.fn>;
    updateIdentifier: ReturnType<typeof vi.fn>;
    deleteIdentifier: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    readGatewayMock = {
      readEmployeeIdentifiersByBusinessKey: vi.fn().mockReturnValue(of(identifiersFixture)),
    };
    gatewayMock = {
      createIdentifier: vi.fn().mockReturnValue(of(undefined)),
      updateIdentifier: vi.fn().mockReturnValue(of(undefined)),
      deleteIdentifier: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeIdentifierReadGateway, useValue: readGatewayMock },
        { provide: EmployeeIdentifierGateway, useValue: gatewayMock },
      ],
    });

    store = TestBed.inject(EmployeeIdentifierStore);
  });

  it('loads identifiers by business key and exposes identifier state', () => {
    store.loadIdentifiersByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeIdentifiersByBusinessKey).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeIdentifiersByBusinessKey).toHaveBeenCalledWith(
      employeeBusinessKey,
    );
    expect(store.identifiers()).toEqual(identifiersFixture);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('keeps empty identifiers when backend returns no identifiers', () => {
    readGatewayMock.readEmployeeIdentifiersByBusinessKey.mockReturnValue(of([]));

    store.loadIdentifiersByBusinessKey(employeeBusinessKey);

    expect(store.identifiers()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('sets request-failed error when identifiers request fails', () => {
    readGatewayMock.readEmployeeIdentifiersByBusinessKey.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.loadIdentifiersByBusinessKey(employeeBusinessKey);

    expect(store.identifiers()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('request-failed');
  });

  it('resets identifiers state when route has no active business key', () => {
    store.loadIdentifiersByBusinessKey(employeeBusinessKey);

    store.loadIdentifiersByBusinessKey(null);

    expect(store.selectedEmployeeKey()).toBeNull();
    expect(store.identifiers()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('does not reload identifiers when same business key is already loaded', () => {
    store.loadIdentifiersByBusinessKey(employeeBusinessKey);
    store.loadIdentifiersByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeIdentifiersByBusinessKey).toHaveBeenCalledTimes(1);
  });

  it('creates identifier and forces reload from backend after success', () => {
    store.loadIdentifiers(employeeBusinessKey);

    store.createIdentifier(employeeBusinessKey, {
      key: 'NIF',
      value: '12345678A',
      issuingCountryCode: 'ESP',
      expirationDate: '',
      isPrimary: true,
    });

    expect(gatewayMock.createIdentifier).toHaveBeenCalledWith(employeeBusinessKey, {
      key: 'NIF',
      value: '12345678A',
      issuingCountryCode: 'ESP',
      expirationDate: '',
      isPrimary: true,
    });
    expect(readGatewayMock.readEmployeeIdentifiersByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('created');
  });

  it('updates identifier and forces reload from backend after success', () => {
    store.loadIdentifiers(employeeBusinessKey);

    store.updateIdentifier(employeeBusinessKey, 'NIF', {
      key: 'NIF',
      value: '87654321Z',
      issuingCountryCode: 'ESP',
      expirationDate: '',
      isPrimary: true,
    });

    expect(gatewayMock.updateIdentifier).toHaveBeenCalledWith(employeeBusinessKey, 'NIF', {
      key: 'NIF',
      value: '87654321Z',
      issuingCountryCode: 'ESP',
      expirationDate: '',
      isPrimary: true,
    });
    expect(readGatewayMock.readEmployeeIdentifiersByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('updated');
  });

  it('deletes identifier and forces reload from backend after success', () => {
    store.loadIdentifiers(employeeBusinessKey);

    store.deleteIdentifier(employeeBusinessKey, 'PASSPORT');

    expect(gatewayMock.deleteIdentifier).toHaveBeenCalledWith(employeeBusinessKey, 'PASSPORT');
    expect(readGatewayMock.readEmployeeIdentifiersByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('deleted');
  });

  it('sets request-failed error when create identifier fails', () => {
    gatewayMock.createIdentifier.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.createIdentifier(employeeBusinessKey, {
      key: 'NIF',
      value: '12345678A',
      issuingCountryCode: 'ESP',
      expirationDate: '',
      isPrimary: true,
    });

    expect(store.error()).toBe('request-failed');
    expect(store.mutating()).toBe(false);
  });

  it('clears success and error feedback without touching identifier data', () => {
    store.loadIdentifiers(employeeBusinessKey);
    store.createIdentifier(employeeBusinessKey, {
      key: 'NIF',
      value: '12345678A',
      issuingCountryCode: 'ESP',
      expirationDate: '',
      isPrimary: true,
    });

    expect(store.success()).toBe('created');
    expect(store.identifiers()).toEqual(identifiersFixture);

    store.clearFeedback();

    expect(store.success()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.identifiers()).toEqual(identifiersFixture);
  });
});
