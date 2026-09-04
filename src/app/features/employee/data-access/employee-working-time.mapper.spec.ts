import {
  WorkingTimePlanResponseOperationEnum,
  WorkingTimePlanResponseRejectionEnum,
} from '../../../core/api/generated/model/models';
import {
  mapWorkingTimeCreateDraftToRequest,
  mapWorkingTimePlanDraftToRequest,
  mapWorkingTimePlanResponseToModel,
  mapWorkingTimeUpdateDraftToRequest,
} from './employee-working-time.mapper';

describe('employee-working-time.mapper', () => {
  it('maps create draft to request', () => {
    const request = mapWorkingTimeCreateDraftToRequest({
      startDate: '2026-04-01',
      endDate: null,
      workingTimePercentage: 80,
    });

    expect(request).toEqual({
      startDate: '2026-04-01',
      endDate: null,
      workingTimePercentage: 80,
    });
  });

  it('maps an end date on the create draft, trimmed', () => {
    const request = mapWorkingTimeCreateDraftToRequest({
      startDate: '2026-04-01',
      endDate: ' 2026-06-30 ',
      workingTimePercentage: 80,
    });

    expect(request.endDate).toBe('2026-06-30');
  });

  it('maps update draft to request with its end date', () => {
    expect(
      mapWorkingTimeUpdateDraftToRequest({
        startDate: '2026-04-02',
        endDate: '2026-06-30',
        workingTimePercentage: 50,
      }),
    ).toEqual({ startDate: '2026-04-02', endDate: '2026-06-30', workingTimePercentage: 50 });
  });

  describe('plan draft', () => {
    it('maps ADD with its dates and no number', () => {
      expect(
        mapWorkingTimePlanDraftToRequest({
          operation: 'ADD',
          startDate: '2026-03-16',
          endDate: null,
        }),
      ).toEqual({ operation: 'ADD', startDate: '2026-03-16', endDate: null });
    });

    it('maps REMOVE with the number and no dates', () => {
      expect(
        mapWorkingTimePlanDraftToRequest({ operation: 'REMOVE', workingTimeNumber: 2 }),
      ).toEqual({ operation: 'REMOVE', workingTimeNumber: 2 });
    });

    it('maps CORRECT with the number and the corrected dates', () => {
      expect(
        mapWorkingTimePlanDraftToRequest({
          operation: 'CORRECT',
          workingTimeNumber: 2,
          startDate: '2026-03-16',
          endDate: '2026-03-31',
        }),
      ).toEqual({
        operation: 'CORRECT',
        workingTimeNumber: 2,
        startDate: '2026-03-16',
        endDate: '2026-03-31',
      });
    });
  });

  describe('plan response', () => {
    it('maps an accepted ADD that closes the working time in force', () => {
      const plan = mapWorkingTimePlanResponseToModel({
        operation: WorkingTimePlanResponseOperationEnum.Add,
        accepted: true,
        rejection: null,
        occurrence: { workingTimeNumber: null, startDate: '2026-03-16' },
        adjustedOccurrence: {
          workingTimeNumber: 1,
          before: { startDate: '2026-03-01' },
          after: { startDate: '2026-03-01', endDate: '2026-03-15' },
        },
        overlaps: [],
        gaps: [],
        stretchCandidates: [],
        projected: [
          { workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-15' },
          { workingTimeNumber: null, startDate: '2026-03-16', endDate: null },
        ],
      });

      expect(plan).toEqual({
        operation: 'ADD',
        accepted: true,
        rejection: null,
        occurrence: { workingTimeNumber: null, startDate: '2026-03-16', endDate: null },
        adjustedOccurrence: {
          workingTimeNumber: 1,
          before: { startDate: '2026-03-01', endDate: null },
          after: { startDate: '2026-03-01', endDate: '2026-03-15' },
        },
        overlaps: [],
        gaps: [],
        stretchCandidates: [],
        projected: [
          { workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-15' },
          { workingTimeNumber: null, startDate: '2026-03-16', endDate: null },
        ],
      });
    });

    it('maps a rejected plan with its gaps and the neighbours to stretch', () => {
      const plan = mapWorkingTimePlanResponseToModel({
        operation: WorkingTimePlanResponseOperationEnum.Remove,
        accepted: false,
        rejection: WorkingTimePlanResponseRejectionEnum.GapNotAllowed,
        occurrence: { workingTimeNumber: 2, startDate: '2026-03-03', endDate: '2026-03-07' },
        overlaps: [],
        gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
        stretchCandidates: [
          { workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
          { workingTimeNumber: 3, startDate: '2026-03-08' },
        ],
        projected: [],
      });

      expect(plan.accepted).toBe(false);
      expect(plan.rejection).toBe('GAP_NOT_ALLOWED');
      expect(plan.adjustedOccurrence).toBeNull();
      expect(plan.gaps).toEqual([{ startDate: '2026-03-03', endDate: '2026-03-07' }]);
      expect(plan.stretchCandidates).toEqual([
        { workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
        { workingTimeNumber: 3, startDate: '2026-03-08', endDate: null },
      ]);
    });
  });
});
