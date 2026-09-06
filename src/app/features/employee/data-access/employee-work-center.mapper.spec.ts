import {
  mapWorkCenterCreateDraftToRequest,
  mapWorkCenterCorrectDraftToRequest,
  mapWorkCenterPlanDraftToRequest,
} from './employee-work-center.mapper';

describe('employee-work-center.mapper', () => {
  it('maps create draft to request normalizing code', () => {
    expect(
      mapWorkCenterCreateDraftToRequest({
        workCenterCode: 'wc1',
        startDate: '2026-01-01',
        endDate: '',
      }),
    ).toEqual({ workCenterCode: 'WC1', startDate: '2026-01-01', endDate: null });
  });

  it('maps correct draft to request', () => {
    expect(
      mapWorkCenterCorrectDraftToRequest({
        workCenterCode: 'wc2',
        startDate: '2026-02-01',
        endDate: '2026-12-31',
      }),
    ).toEqual({ workCenterCode: 'WC2', startDate: '2026-02-01', endDate: '2026-12-31' });
  });

  it('names the assignment by its number on a correction and on a removal', () => {
    expect(
      mapWorkCenterPlanDraftToRequest({
        operation: 'ADD',
        startDate: '2026-03-01',
        endDate: null,
      }),
    ).toEqual({ operation: 'ADD', startDate: '2026-03-01', endDate: null });

    expect(
      mapWorkCenterPlanDraftToRequest({
        operation: 'CORRECT',
        workCenterAssignmentNumber: 9,
        startDate: '2026-03-01',
        endDate: '2026-06-30',
      }),
    ).toEqual({
      operation: 'CORRECT',
      workCenterAssignmentNumber: 9,
      startDate: '2026-03-01',
      endDate: '2026-06-30',
    });

    expect(
      mapWorkCenterPlanDraftToRequest({ operation: 'REMOVE', workCenterAssignmentNumber: 9 }),
    ).toEqual({ operation: 'REMOVE', workCenterAssignmentNumber: 9 });
  });
});
