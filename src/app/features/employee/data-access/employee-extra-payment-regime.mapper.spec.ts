import {
  ExtraPaymentRegimePlanResponseOperationEnum,
  ExtraPaymentRegimePlanResponseRejectionEnum,
} from '../../../core/api/generated/model/models';
import {
  mapExtraPaymentRegimeCreateDraftToRequest,
  mapExtraPaymentRegimePlanDraftToRequest,
  mapExtraPaymentRegimePlanResponseToModel,
  mapExtraPaymentRegimeUpdateDraftToRequest,
} from './employee-extra-payment-regime.mapper';

describe('employee-extra-payment-regime.mapper', () => {
  it('maps create draft to request', () => {
    const request = mapExtraPaymentRegimeCreateDraftToRequest({
      startDate: '2026-04-01',
      endDate: null,
      prorated: true,
    });

    expect(request).toEqual({
      startDate: '2026-04-01',
      endDate: null,
      prorated: true,
    });
  });

  it('maps an end date on the create draft, trimmed', () => {
    const request = mapExtraPaymentRegimeCreateDraftToRequest({
      startDate: '2026-04-01',
      endDate: ' 2026-06-30 ',
      prorated: true,
    });

    expect(request.endDate).toBe('2026-06-30');
  });

  it('maps update draft to request with its end date', () => {
    expect(
      mapExtraPaymentRegimeUpdateDraftToRequest({
        startDate: '2026-04-02',
        endDate: '2026-06-30',
        prorated: true,
      }),
    ).toEqual({ startDate: '2026-04-02', endDate: '2026-06-30', prorated: true });
  });

  describe('plan draft', () => {
    it('maps ADD with its dates and no number', () => {
      expect(
        mapExtraPaymentRegimePlanDraftToRequest({
          operation: 'ADD',
          startDate: '2026-03-16',
          endDate: null,
        }),
      ).toEqual({ operation: 'ADD', startDate: '2026-03-16', endDate: null });
    });

    it('maps REMOVE with the number and no dates', () => {
      expect(
        mapExtraPaymentRegimePlanDraftToRequest({
          operation: 'REMOVE',
          extraPaymentRegimeNumber: 2,
        }),
      ).toEqual({ operation: 'REMOVE', extraPaymentRegimeNumber: 2 });
    });

    it('maps CORRECT with the number and the corrected dates', () => {
      expect(
        mapExtraPaymentRegimePlanDraftToRequest({
          operation: 'CORRECT',
          extraPaymentRegimeNumber: 2,
          startDate: '2026-03-16',
          endDate: '2026-03-31',
        }),
      ).toEqual({
        operation: 'CORRECT',
        extraPaymentRegimeNumber: 2,
        startDate: '2026-03-16',
        endDate: '2026-03-31',
      });
    });
  });

  describe('plan response', () => {
    it('maps an accepted ADD that closes the working time in force', () => {
      const plan = mapExtraPaymentRegimePlanResponseToModel({
        operation: ExtraPaymentRegimePlanResponseOperationEnum.Add,
        accepted: true,
        rejection: null,
        occurrence: { extraPaymentRegimeNumber: null, startDate: '2026-03-16' },
        adjustedOccurrence: {
          extraPaymentRegimeNumber: 1,
          before: { startDate: '2026-03-01' },
          after: { startDate: '2026-03-01', endDate: '2026-03-15' },
        },
        overlaps: [],
        gaps: [],
        stretchCandidates: [],
        projected: [
          { extraPaymentRegimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-15' },
          { extraPaymentRegimeNumber: null, startDate: '2026-03-16', endDate: null },
        ],
      });

      expect(plan).toEqual({
        operation: 'ADD',
        accepted: true,
        rejection: null,
        occurrence: { extraPaymentRegimeNumber: null, startDate: '2026-03-16', endDate: null },
        correctedOccurrence: null,
        adjustedOccurrence: {
          extraPaymentRegimeNumber: 1,
          before: { startDate: '2026-03-01', endDate: null },
          after: { startDate: '2026-03-01', endDate: '2026-03-15' },
        },
        overlaps: [],
        gaps: [],
        stretchCandidates: [],
        projected: [
          { extraPaymentRegimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-15' },
          { extraPaymentRegimeNumber: null, startDate: '2026-03-16', endDate: null },
        ],
      });
    });

    it('maps a rejected plan with its gaps and the neighbours to stretch', () => {
      const plan = mapExtraPaymentRegimePlanResponseToModel({
        operation: ExtraPaymentRegimePlanResponseOperationEnum.Remove,
        accepted: false,
        rejection: ExtraPaymentRegimePlanResponseRejectionEnum.GapNotAllowed,
        occurrence: { extraPaymentRegimeNumber: 2, startDate: '2026-03-03', endDate: '2026-03-07' },
        overlaps: [],
        gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
        stretchCandidates: [
          { extraPaymentRegimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
          { extraPaymentRegimeNumber: 3, startDate: '2026-03-08' },
        ],
        projected: [],
      });

      expect(plan.accepted).toBe(false);
      expect(plan.rejection).toBe('GAP_NOT_ALLOWED');
      expect(plan.adjustedOccurrence).toBeNull();
      expect(plan.gaps).toEqual([{ startDate: '2026-03-03', endDate: '2026-03-07' }]);
      expect(plan.stretchCandidates).toEqual([
        { extraPaymentRegimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
        { extraPaymentRegimeNumber: 3, startDate: '2026-03-08', endDate: null },
      ]);
    });

    it('maps a plan rejected because the add is the correction of an existing working time', () => {
      const plan = mapExtraPaymentRegimePlanResponseToModel({
        operation: ExtraPaymentRegimePlanResponseOperationEnum.Add,
        accepted: false,
        rejection: ExtraPaymentRegimePlanResponseRejectionEnum.IsACorrection,
        occurrence: { extraPaymentRegimeNumber: null, startDate: '2026-03-01', endDate: null },
        correctedOccurrence: {
          extraPaymentRegimeNumber: 1,
          startDate: '2026-03-01',
          endDate: null,
        },
        overlaps: [],
        gaps: [],
        stretchCandidates: [],
        projected: [],
      });

      expect(plan.accepted).toBe(false);
      expect(plan.rejection).toBe('IS_A_CORRECTION');
    });
  });
});
