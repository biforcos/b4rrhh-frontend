import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeContractModel } from '../models/employee-contract.model';
import { EmployeeContractReadGateway } from './employee-contract-read.gateway';
import { EmployeeContractStore } from './employee-contract.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const contractsFixture: ReadonlyArray<EmployeeContractModel> = [
  {
    contractCode: 'INDEFINITE',
    contractSubtypeCode: 'FULL_TIME',
    startDate: '2024-06-01',
    endDate: null,
    isActive: true,
  },
  {
    contractCode: 'TEMPORARY',
    contractSubtypeCode: 'PROJECT',
    startDate: '2023-01-01',
    endDate: '2024-05-31',
    isActive: false,
  },
];

describe('EmployeeContractStore', () => {
  let store: EmployeeContractStore;
  let readGatewayMock: {
    readEmployeeContractsByBusinessKey: ReturnType<typeof vi.fn>;
    replaceContractFromDate: ReturnType<typeof vi.fn>;
    correctContractOccurrence: ReturnType<typeof vi.fn>;
    closeContractOccurrence: ReturnType<typeof vi.fn>;
    sortByTimelineRecency: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    readGatewayMock = {
      readEmployeeContractsByBusinessKey: vi.fn().mockReturnValue(of(contractsFixture)),
      replaceContractFromDate: vi.fn().mockReturnValue(of(undefined)),
      correctContractOccurrence: vi.fn().mockReturnValue(of(undefined)),
      closeContractOccurrence: vi.fn().mockReturnValue(of(undefined)),
      sortByTimelineRecency: vi.fn().mockImplementation((contracts) => contracts),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeContractReadGateway, useValue: readGatewayMock }],
    });

    store = TestBed.inject(EmployeeContractStore);
  });

  it('loads contracts by business key and exposes contracts state', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeContractsByBusinessKey).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeContractsByBusinessKey).toHaveBeenCalledWith(
      employeeBusinessKey,
    );
    expect(store.contracts()).toEqual(contractsFixture);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('keeps empty contracts when backend returns no contracts', () => {
    readGatewayMock.readEmployeeContractsByBusinessKey.mockReturnValue(of([]));

    store.loadContractsByBusinessKey(employeeBusinessKey);

    expect(store.contracts()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('sets request-failed error when contracts request fails', () => {
    readGatewayMock.readEmployeeContractsByBusinessKey.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.loadContractsByBusinessKey(employeeBusinessKey);

    expect(store.contracts()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('request-failed');
  });

  it('resets contracts state when route has no active business key', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);

    store.loadContractsByBusinessKey(null);

    expect(store.selectedEmployeeKey()).toBeNull();
    expect(store.contracts()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('does not reload contracts when same business key is already loaded', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);
    store.loadContractsByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeContractsByBusinessKey).toHaveBeenCalledTimes(1);
  });

  it('replaces contract from date and reloads after success', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);

    store.replaceFromDate(employeeBusinessKey, {
      effectiveDate: '2025-01-01',
      contractCode: 'INDEFINITE',
      contractSubtypeCode: 'PART_TIME',
    });

    expect(readGatewayMock.replaceContractFromDate).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeContractsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('replaced');
    expect(store.mutating()).toBe(false);
  });

  it('corrects an occurrence and reloads after success', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);

    store.correctOccurrence(employeeBusinessKey, '2023-01-01', {
      startDate: '2023-01-01',
      contractCode: 'TEMPORARY',
      contractSubtypeCode: 'PROJECT',
    });

    expect(readGatewayMock.correctContractOccurrence).toHaveBeenCalledWith(
      employeeBusinessKey,
      '2023-01-01',
      {
        startDate: '2023-01-01',
        contractCode: 'TEMPORARY',
        contractSubtypeCode: 'PROJECT',
      },
    );
    expect(readGatewayMock.readEmployeeContractsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('corrected');
  });

  it('closes current occurrence and reloads after success', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);

    store.closeOccurrence(employeeBusinessKey, '2024-06-01', {
      endDate: '2025-02-15',
    });

    expect(readGatewayMock.closeContractOccurrence).toHaveBeenCalledWith(
      employeeBusinessKey,
      '2024-06-01',
      {
        endDate: '2025-02-15',
      },
    );
    expect(readGatewayMock.readEmployeeContractsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('closed');
  });

  it('keeps loaded context when replace fails and exposes backend message', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);
    readGatewayMock.replaceContractFromDate.mockReturnValue(
      throwError(() => ({ error: { message: 'Contract relation invalid.' } })),
    );

    store.replaceFromDate(employeeBusinessKey, {
      effectiveDate: '2025-01-01',
      contractCode: 'INDEFINITE',
      contractSubtypeCode: 'PART_TIME',
    });

    expect(store.error()).toBe('Contract relation invalid.');
    expect(store.mutating()).toBe(false);
    expect(store.selectedEmployeeKey()).toEqual(employeeBusinessKey);
    expect(store.contracts()).toEqual(contractsFixture);
  });

  it('clears feedback without clearing loaded data', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);
    store.replaceFromDate(employeeBusinessKey, {
      effectiveDate: '2025-01-01',
      contractCode: 'INDEFINITE',
      contractSubtypeCode: 'PART_TIME',
    });

    expect(store.success()).toBe('replaced');

    store.clearFeedback();

    expect(store.success()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.contracts()).toEqual(contractsFixture);
  });
});
