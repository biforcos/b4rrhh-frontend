import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeLaborClassificationModel } from '../models/employee-labor-classification.model';
import { EmployeeLaborClassificationReadGateway } from './employee-labor-classification-read.gateway';
import { EmployeeLaborClassificationStore } from './employee-labor-classification.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const laborClassificationsFixture: ReadonlyArray<EmployeeLaborClassificationModel> = [
  {
    agreementCode: 'AGREE-01',
    agreementCategoryCode: 'CAT-A',
    startDate: '2024-06-01',
    endDate: null,
    isActive: true,
  },
  {
    agreementCode: 'AGREE-01',
    agreementCategoryCode: 'CAT-B',
    startDate: '2022-01-01',
    endDate: '2024-05-31',
    isActive: false,
  },
];

describe('EmployeeLaborClassificationStore', () => {
  let store: EmployeeLaborClassificationStore;
  let readGatewayMock: {
    readEmployeeLaborClassificationsByBusinessKey: ReturnType<typeof vi.fn>;
    replaceLaborClassificationFromDate: ReturnType<typeof vi.fn>;
    correctLaborClassificationOccurrence: ReturnType<typeof vi.fn>;
    closeLaborClassificationOccurrence: ReturnType<typeof vi.fn>;
    sortByTimelineRecency: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    readGatewayMock = {
      readEmployeeLaborClassificationsByBusinessKey: vi
        .fn()
        .mockReturnValue(of(laborClassificationsFixture)),
      replaceLaborClassificationFromDate: vi.fn().mockReturnValue(of(undefined)),
      correctLaborClassificationOccurrence: vi.fn().mockReturnValue(of(undefined)),
      closeLaborClassificationOccurrence: vi.fn().mockReturnValue(of(undefined)),
      sortByTimelineRecency: vi.fn().mockImplementation((classifications) => classifications),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeLaborClassificationReadGateway, useValue: readGatewayMock }],
    });

    store = TestBed.inject(EmployeeLaborClassificationStore);
  });

  it('loads labor classifications by business key and exposes labor classifications state', () => {
    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeLaborClassificationsByBusinessKey).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeLaborClassificationsByBusinessKey).toHaveBeenCalledWith(
      employeeBusinessKey,
    );
    expect(store.laborClassifications()).toEqual(laborClassificationsFixture);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('keeps empty labor classifications when backend returns no labor classifications', () => {
    readGatewayMock.readEmployeeLaborClassificationsByBusinessKey.mockReturnValue(of([]));

    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);

    expect(store.laborClassifications()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('sets request-failed error when labor classifications request fails', () => {
    readGatewayMock.readEmployeeLaborClassificationsByBusinessKey.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);

    expect(store.laborClassifications()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('request-failed');
  });

  it('resets labor classifications state when route has no active business key', () => {
    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);

    store.loadLaborClassificationsByBusinessKey(null);

    expect(store.selectedEmployeeKey()).toBeNull();
    expect(store.laborClassifications()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('does not reload labor classifications when same business key is already loaded', () => {
    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);
    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeLaborClassificationsByBusinessKey).toHaveBeenCalledTimes(1);
  });

  it('replaces labor classification from date and reloads data after success', () => {
    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);

    store.replaceFromDate(employeeBusinessKey, {
      effectiveDate: '2025-01-01',
      agreementCode: 'AGREE-02',
      agreementCategoryCode: 'CAT-C',
    });

    expect(readGatewayMock.replaceLaborClassificationFromDate).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeLaborClassificationsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('replaced');
    expect(store.mutating()).toBe(false);
  });

  it('corrects a historical occurrence and reloads data after success', () => {
    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);

    store.correctOccurrence(employeeBusinessKey, '2022-01-01', {
      startDate: '2022-01-01',
      agreementCode: 'AGREE-01',
      agreementCategoryCode: 'CAT-Z',
    });

    expect(readGatewayMock.correctLaborClassificationOccurrence).toHaveBeenCalledWith(
      employeeBusinessKey,
      '2022-01-01',
      {
        startDate: '2022-01-01',
        agreementCode: 'AGREE-01',
        agreementCategoryCode: 'CAT-Z',
      },
    );
    expect(readGatewayMock.readEmployeeLaborClassificationsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('corrected');
  });

  it('closes current occurrence and reloads data after success', () => {
    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);

    store.closeOccurrence(employeeBusinessKey, '2024-06-01', {
      endDate: '2025-02-15',
    });

    expect(readGatewayMock.closeLaborClassificationOccurrence).toHaveBeenCalledWith(
      employeeBusinessKey,
      '2024-06-01',
      {
        endDate: '2025-02-15',
      },
    );
    expect(readGatewayMock.readEmployeeLaborClassificationsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('closed');
  });

  it('keeps loaded context when replace fails and exposes error state', () => {
    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);
    readGatewayMock.replaceLaborClassificationFromDate.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.replaceFromDate(employeeBusinessKey, {
      effectiveDate: '2025-01-01',
      agreementCode: 'AGREE-02',
      agreementCategoryCode: 'CAT-C',
    });

    expect(store.error()).toBe('request-failed');
    expect(store.mutating()).toBe(false);
    expect(store.selectedEmployeeKey()).toEqual(employeeBusinessKey);
    expect(store.laborClassifications()).toEqual(laborClassificationsFixture);
  });

  it('clears success and error feedback without clearing loaded data', () => {
    store.loadLaborClassificationsByBusinessKey(employeeBusinessKey);
    store.replaceFromDate(employeeBusinessKey, {
      effectiveDate: '2025-01-01',
      agreementCode: 'AGREE-02',
      agreementCategoryCode: 'CAT-C',
    });

    expect(store.success()).toBe('replaced');
    expect(store.laborClassifications()).toEqual(laborClassificationsFixture);

    store.clearFeedback();

    expect(store.success()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.laborClassifications()).toEqual(laborClassificationsFixture);
  });
});
