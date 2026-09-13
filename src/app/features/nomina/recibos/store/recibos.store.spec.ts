import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { RecibosStore } from './recibos.store';

const MOCK_KEY: PayrollBusinessKey = {
  ruleSystemCode: 'MAS',
  employeeTypeCode: 'EMP',
  employeeNumber: 'MAS000001',
  payrollPeriodCode: '202604',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 1,
};

const MOCK_SUMMARY: PayrollSummaryModel = {
  ...MOCK_KEY,
  status: 'CALCULATED',
  calculatedAt: '2026-04-24T10:00:00',
};

const MOCK_CONCEPT: PayrollConceptModel = {
  lineNumber: 1,
  conceptCode: '001',
  conceptLabel: 'Salario base',
  amount: 2100,
  quantity: 30,
  rate: 70,
  conceptNatureCode: 'EARNING',
  originPeriodCode: '202604',
  displayOrder: 10,
};

function detailWith(
  concepts: ReadonlyArray<PayrollConceptModel>,
  summary: PayrollSummaryModel = MOCK_SUMMARY,
) {
  return {
    summary,
    concepts,
    companyProfile: null,
    employeeProfile: null,
    agreementProfile: null,
    presenceStartDate: null,
    presenceEndDate: null,
    seniorityDate: null,
    workCenterCode: null,
    workCenterName: null,
  };
}

describe('RecibosStore', () => {
  let store: RecibosStore;
  let gatewayMock: {
    search: ReturnType<typeof vi.fn>;
    getDetail: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
    validate: ReturnType<typeof vi.fn>;
    recalculate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      search: vi.fn(),
      getDetail: vi.fn(),
      invalidate: vi.fn(),
      validate: vi.fn(),
      recalculate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [RecibosStore, { provide: RecibosGateway, useValue: gatewayMock }],
    });

    store = TestBed.inject(RecibosStore);
  });

  it('initialises with empty state', () => {
    expect(store.payrolls()).toEqual([]);
    expect(store.selectedKey()).toBeNull();
    expect(store.concepts()).toEqual([]);
    expect(store.listLoading()).toBe(false);
  });

  it('loads payrolls on search', () => {
    gatewayMock.search.mockReturnValue(of([MOCK_SUMMARY]));

    store.search({ payrollPeriodCode: '202604', employeeNumber: '', status: '' });

    expect(store.payrolls()).toHaveLength(1);
    expect(store.payrolls()[0].employeeNumber).toBe('MAS000001');
  });

  it('sets listError on search failure', () => {
    gatewayMock.search.mockReturnValue(throwError(() => new Error('fail')));

    store.search({ payrollPeriodCode: '', employeeNumber: '', status: '' });

    expect(store.listError()).toBe('request-failed');
  });

  it('loads concepts when selecting a payroll', () => {
    gatewayMock.getDetail.mockReturnValue(of(detailWith([MOCK_CONCEPT])));

    store.selectPayroll(MOCK_KEY);

    expect(store.selectedKey()).toEqual(MOCK_KEY);
    expect(store.concepts()).toHaveLength(1);
  });

  /**
   * El criterio 2 del `frontend#64`: pegar la URL de un recibo lo abre con la aplicación recién
   * cargada. Hasta entonces el detalle era un `computed` sobre la lista, y sin búsqueda previa
   * salía vacío.
   */
  it('opens a payroll with an empty list, without searching first', () => {
    gatewayMock.getDetail.mockReturnValue(of(detailWith([MOCK_CONCEPT])));

    store.selectPayroll(MOCK_KEY);

    expect(store.payrolls()).toEqual([]);
    expect(store.selectedPayroll()).toEqual(MOCK_SUMMARY);
    expect(store.concepts()).toHaveLength(1);
  });

  /** Criterio 3: las dos presencias del mismo periodo son dos recibos distintos. */
  it('tells the two payrolls of a split month apart', () => {
    const segunda = { ...MOCK_KEY, presenceNumber: 2 };
    gatewayMock.getDetail.mockReturnValue(
      of(detailWith([MOCK_CONCEPT], { ...MOCK_SUMMARY, presenceNumber: 2 })),
    );

    store.selectPayroll(segunda);

    expect(gatewayMock.getDetail).toHaveBeenCalledWith(segunda);
    expect(store.selectedKey()?.presenceNumber).toBe(2);
    expect(store.selectedPayroll()?.presenceNumber).toBe(2);
  });

  /** Criterio 4: una dirección sin recibo detrás se dice, no se deja en blanco. */
  it('distinguishes a payroll that is not there from a request that failed', () => {
    gatewayMock.getDetail.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    store.selectPayroll(MOCK_KEY);
    expect(store.conceptsError()).toBe('not-found');
    expect(store.selectedPayroll()).toBeNull();

    gatewayMock.getDetail.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    store.selectPayroll({ ...MOCK_KEY, presenceNumber: 2 });
    expect(store.conceptsError()).toBe('request-failed');
  });

  it('clears the selection when the address has no payroll in it', () => {
    gatewayMock.getDetail.mockReturnValue(of(detailWith([MOCK_CONCEPT])));
    store.selectPayroll(MOCK_KEY);

    store.clearSelection();

    expect(store.selectedKey()).toBeNull();
    expect(store.selectedPayroll()).toBeNull();
    expect(store.concepts()).toEqual([]);
    expect(store.conceptsError()).toBeNull();
  });

  it('keeps the open payroll in step with a transition, list or no list', () => {
    gatewayMock.getDetail.mockReturnValue(of(detailWith([MOCK_CONCEPT])));
    store.selectPayroll(MOCK_KEY);

    gatewayMock.validate.mockReturnValue(of({ ...MOCK_SUMMARY, status: 'EXPLICIT_VALIDATED' }));
    store.validate(MOCK_KEY);

    expect(store.selectedPayroll()?.status).toBe('EXPLICIT_VALIDATED');
  });
});
