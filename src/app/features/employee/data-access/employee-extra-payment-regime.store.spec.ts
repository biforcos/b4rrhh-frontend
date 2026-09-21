import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { EmployeeExtraPaymentRegimeModel } from '../models/employee-extra-payment-regime.model';
import { EmployeeExtraPaymentRegimePlanModel } from '../models/employee-extra-payment-regime-plan.model';
import { EmployeeExtraPaymentRegimeGateway } from './employee-extra-payment-regime.gateway';
import { EmployeeExtraPaymentRegimeStore } from './employee-extra-payment-regime.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const extraPaymentRegimesFixture: ReadonlyArray<EmployeeExtraPaymentRegimeModel> = [
  {
    extraPaymentRegimeNumber: 2,
    startDate: '2026-01-01',
    endDate: null,
    prorated: true,
    isActive: true,
  },
  {
    extraPaymentRegimeNumber: 1,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    prorated: true,
    isActive: false,
  },
];

const acceptedPlan: EmployeeExtraPaymentRegimePlanModel = {
  operation: 'ADD',
  accepted: true,
  rejection: null,
  occurrence: { extraPaymentRegimeNumber: null, startDate: '2026-04-01', endDate: null },
  correctedOccurrence: null,
  adjustedOccurrence: {
    extraPaymentRegimeNumber: 2,
    before: { startDate: '2026-01-01', endDate: null },
    after: { startDate: '2026-01-01', endDate: '2026-03-31' },
  },
  overlaps: [],
  gaps: [],
  stretchCandidates: [],
  projected: [],
};

describe('EmployeeExtraPaymentRegimeStore', () => {
  let store: EmployeeExtraPaymentRegimeStore;
  let gatewayMock: {
    getEmployeeExtraPaymentRegimes: ReturnType<typeof vi.fn>;
    createEmployeeExtraPaymentRegime: ReturnType<typeof vi.fn>;
    deleteEmployeeExtraPaymentRegime: ReturnType<typeof vi.fn>;
    planEmployeeExtraPaymentRegimeChange: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      getEmployeeExtraPaymentRegimes: vi.fn().mockReturnValue(of(extraPaymentRegimesFixture)),
      createEmployeeExtraPaymentRegime: vi.fn().mockReturnValue(of(undefined)),
      deleteEmployeeExtraPaymentRegime: vi.fn().mockReturnValue(of(undefined)),
      planEmployeeExtraPaymentRegimeChange: vi.fn().mockReturnValue(of(acceptedPlan)),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeExtraPaymentRegimeGateway, useValue: gatewayMock }],
    });

    store = TestBed.inject(EmployeeExtraPaymentRegimeStore);
  });

  it('loads working times by business key', () => {
    store.loadExtraPaymentRegimesByBusinessKey(employeeBusinessKey);

    expect(gatewayMock.getEmployeeExtraPaymentRegimes).toHaveBeenCalledWith(employeeBusinessKey);
    expect(store.extraPaymentRegimes()).toEqual(extraPaymentRegimesFixture);
    expect(store.error()).toBeNull();
  });

  it('creates working time and refreshes list on success', () => {
    store.loadExtraPaymentRegimesByBusinessKey(employeeBusinessKey);

    store.createExtraPaymentRegime(employeeBusinessKey, {
      startDate: '2026-04-01',
      endDate: null,
      prorated: true,
    });

    expect(gatewayMock.createEmployeeExtraPaymentRegime).toHaveBeenCalledWith(employeeBusinessKey, {
      startDate: '2026-04-01',
      endDate: null,
      prorated: true,
    });
    expect(gatewayMock.getEmployeeExtraPaymentRegimes).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('created');
  });

  it('maps known functional backend code on mutation failure', () => {
    gatewayMock.createEmployeeExtraPaymentRegime.mockReturnValue(
      throwError(() => ({ error: { code: 'EXTRA_PAYMENT_REGIME_OUTSIDE_PRESENCE' } })),
    );

    store.loadExtraPaymentRegimesByBusinessKey(employeeBusinessKey);
    store.createExtraPaymentRegime(employeeBusinessKey, {
      startDate: '2024-01-01',
      endDate: null,
      prorated: true,
    });

    expect(store.error()).toBe('EXTRA_PAYMENT_REGIME_OUTSIDE_PRESENCE');
    expect(store.extraPaymentRegimes()).toEqual(extraPaymentRegimesFixture);
    expect(store.mutating()).toBe(false);
  });

  it('falls back to request-failed for unknown backend code', () => {
    gatewayMock.createEmployeeExtraPaymentRegime.mockReturnValue(
      throwError(() => ({ error: { code: 'UNKNOWN_EXTRA_PAYMENT_REGIME_CODE' } })),
    );

    store.loadExtraPaymentRegimesByBusinessKey(employeeBusinessKey);
    store.createExtraPaymentRegime(employeeBusinessKey, {
      startDate: '2026-04-01',
      endDate: null,
      prorated: true,
    });

    expect(store.error()).toBe('request-failed');
    expect(store.extraPaymentRegimes()).toEqual(extraPaymentRegimesFixture);
    expect(store.mutating()).toBe(false);
  });

  it('deletes a working time and refreshes list on success', () => {
    store.loadExtraPaymentRegimesByBusinessKey(employeeBusinessKey);

    store.deleteExtraPaymentRegime(employeeBusinessKey, 2);

    expect(gatewayMock.deleteEmployeeExtraPaymentRegime).toHaveBeenCalledWith(
      employeeBusinessKey,
      2,
    );
    expect(gatewayMock.getEmployeeExtraPaymentRegimes).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('deleted');
  });

  it('keeps the dates of an invariant rejection next to its code', () => {
    gatewayMock.deleteEmployeeExtraPaymentRegime.mockReturnValue(
      throwError(() => ({
        error: {
          code: 'EXTRA_PAYMENT_REGIME_COVERAGE_GAP',
          details: {
            gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
            stretchCandidates: [
              { extraPaymentRegimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
            ],
          },
        },
      })),
    );

    store.loadExtraPaymentRegimesByBusinessKey(employeeBusinessKey);
    store.deleteExtraPaymentRegime(employeeBusinessKey, 2);

    expect(store.error()).toBe('EXTRA_PAYMENT_REGIME_COVERAGE_GAP');
    expect(store.errorConflict()).toEqual({
      overlaps: [],
      gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
      stretchCandidates: [
        { extraPaymentRegimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
      ],
      correctedOccurrence: null,
    });

    store.clearFeedback();

    expect(store.errorConflict()).toBeNull();
  });

  describe('planning a change', () => {
    it('asks the gateway and exposes the plan', () => {
      store.planChange(employeeBusinessKey, {
        operation: 'ADD',
        startDate: '2026-04-01',
        endDate: null,
      });

      expect(gatewayMock.planEmployeeExtraPaymentRegimeChange).toHaveBeenCalledWith(
        employeeBusinessKey,
        {
          operation: 'ADD',
          startDate: '2026-04-01',
          endDate: null,
        },
      );
      expect(store.plan()).toEqual(acceptedPlan);
      expect(store.planning()).toBe(false);
    });

    it('has no plan while the answer is pending, and ignores an answer that was overtaken', () => {
      const first = new Subject<EmployeeExtraPaymentRegimePlanModel>();
      const second = new Subject<EmployeeExtraPaymentRegimePlanModel>();
      gatewayMock.planEmployeeExtraPaymentRegimeChange
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(second);

      store.planChange(employeeBusinessKey, { operation: 'REMOVE', extraPaymentRegimeNumber: 2 });
      expect(store.plan()).toBeNull();
      expect(store.planning()).toBe(true);

      store.planChange(employeeBusinessKey, { operation: 'REMOVE', extraPaymentRegimeNumber: 1 });
      first.next({ ...acceptedPlan, operation: 'REMOVE' });

      expect(store.plan()).toBeNull();
      expect(store.planning()).toBe(true);

      second.next({ ...acceptedPlan, accepted: false, rejection: 'GAP_NOT_ALLOWED' });

      expect(store.plan()?.rejection).toBe('GAP_NOT_ALLOWED');
      expect(store.planning()).toBe(false);
    });

    it('clearPlan drops the plan and whatever answer is still on its way', () => {
      const pending = new Subject<EmployeeExtraPaymentRegimePlanModel>();
      gatewayMock.planEmployeeExtraPaymentRegimeChange.mockReturnValueOnce(pending);

      store.planChange(employeeBusinessKey, { operation: 'REMOVE', extraPaymentRegimeNumber: 2 });
      store.clearPlan();
      pending.next(acceptedPlan);

      expect(store.plan()).toBeNull();
      expect(store.planning()).toBe(false);
    });

    it('reports a failed plan request as an error and leaves no plan', () => {
      gatewayMock.planEmployeeExtraPaymentRegimeChange.mockReturnValue(
        throwError(() => ({ status: 500 })),
      );

      store.planChange(employeeBusinessKey, { operation: 'REMOVE', extraPaymentRegimeNumber: 2 });

      expect(store.plan()).toBeNull();
      expect(store.planning()).toBe(false);
      expect(store.error()).toBe('request-failed');
    });
  });
});
