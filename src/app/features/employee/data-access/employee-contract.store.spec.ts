import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeContractModel } from '../models/employee-contract.model';
import { EmployeeContractPlanModel } from '../models/employee-contract-plan.model';
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

const acceptedPlan: EmployeeContractPlanModel = {
  operation: 'ADD',
  accepted: true,
  rejection: null,
  occurrence: { startDate: '2025-01-01', endDate: null },
  correctedOccurrence: null,
  adjustedOccurrence: {
    before: { startDate: '2024-06-01', endDate: null },
    after: { startDate: '2024-06-01', endDate: '2024-12-31' },
  },
  overlaps: [],
  gaps: [],
  stretchCandidates: [],
  projected: [],
};

describe('EmployeeContractStore', () => {
  let store: EmployeeContractStore;
  let readGatewayMock: {
    readEmployeeContractsByBusinessKey: ReturnType<typeof vi.fn>;
    createContract: ReturnType<typeof vi.fn>;
    planContractChange: ReturnType<typeof vi.fn>;
    correctContractOccurrence: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    readGatewayMock = {
      readEmployeeContractsByBusinessKey: vi.fn().mockReturnValue(of(contractsFixture)),
      createContract: vi.fn().mockReturnValue(of(undefined)),
      planContractChange: vi.fn().mockReturnValue(of(acceptedPlan)),
      correctContractOccurrence: vi.fn().mockReturnValue(of(undefined)),
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

  it('corrects an occurrence and reloads after success', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);

    store.correctOccurrence(employeeBusinessKey, '2023-01-01', {
      startDate: '2023-01-01',
      endDate: '2024-05-31',
      contractCode: 'TEMPORARY',
      contractSubtypeCode: 'PROJECT',
    });

    expect(readGatewayMock.correctContractOccurrence).toHaveBeenCalledWith(
      employeeBusinessKey,
      '2023-01-01',
      {
        startDate: '2023-01-01',
        endDate: '2024-05-31',
        contractCode: 'TEMPORARY',
        contractSubtypeCode: 'PROJECT',
      },
    );
    expect(readGatewayMock.readEmployeeContractsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('corrected');
  });

  it('keeps loaded context when the add fails and exposes the backend code', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);
    readGatewayMock.createContract.mockReturnValue(
      throwError(() => ({ error: { code: 'CONTRACT_OVERLAP' } })),
    );

    store.createContract(employeeBusinessKey, {
      startDate: '2025-01-01',
      endDate: null,
      contractCode: 'INDEFINITE',
      contractSubtypeCode: 'PART_TIME',
    });

    expect(store.error()).toBe('CONTRACT_OVERLAP');
    expect(store.mutating()).toBe(false);
    expect(store.selectedEmployeeKey()).toEqual(employeeBusinessKey);
    expect(store.contracts()).toEqual(contractsFixture);
  });

  it('adds a contract and reloads after success', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);

    store.createContract(employeeBusinessKey, {
      startDate: '2025-01-01',
      endDate: null,
      contractCode: 'INDEFINITE',
      contractSubtypeCode: 'PART_TIME',
    });

    expect(readGatewayMock.createContract).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeContractsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('created');
  });

  it('exposes the plan of a change and nothing is written', () => {
    store.planChange(employeeBusinessKey, {
      operation: 'ADD',
      startDate: '2025-01-01',
      endDate: null,
    });

    expect(readGatewayMock.planContractChange).toHaveBeenCalledTimes(1);
    expect(store.plan()).toEqual(acceptedPlan);
    expect(store.planning()).toBe(false);
    expect(readGatewayMock.createContract).not.toHaveBeenCalled();
  });

  it('drops the plan so nobody confirms against an old one', () => {
    store.planChange(employeeBusinessKey, {
      operation: 'ADD',
      startDate: '2025-01-01',
      endDate: null,
    });
    store.clearPlan();

    expect(store.plan()).toBeNull();
    expect(store.planning()).toBe(false);
  });

  it('keeps the dates a rejected invariant names', () => {
    readGatewayMock.createContract.mockReturnValue(
      throwError(() => ({
        error: {
          code: 'CONTRACT_COVERAGE_GAP',
          details: {
            gaps: [{ startDate: '2026-02-01', endDate: '2026-02-28' }],
            stretchCandidates: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
          },
        },
      })),
    );

    store.createContract(employeeBusinessKey, {
      startDate: '2026-03-01',
      endDate: null,
      contractCode: 'INDEFINITE',
      contractSubtypeCode: 'PART_TIME',
    });

    expect(store.error()).toBe('CONTRACT_COVERAGE_GAP');
    expect(store.errorConflict()?.gaps).toEqual([
      { startDate: '2026-02-01', endDate: '2026-02-28' },
    ]);
  });

  it('clears feedback without clearing loaded data', () => {
    store.loadContractsByBusinessKey(employeeBusinessKey);
    store.createContract(employeeBusinessKey, {
      startDate: '2025-01-01',
      endDate: null,
      contractCode: 'INDEFINITE',
      contractSubtypeCode: 'PART_TIME',
    });

    expect(store.success()).toBe('created');

    store.clearFeedback();

    expect(store.success()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.contracts()).toEqual(contractsFixture);
  });
});
