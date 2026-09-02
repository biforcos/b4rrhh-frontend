import {
  mapWorkCenterCreateDraftToRequest,
  mapWorkCenterCorrectDraftToRequest,
  mapWorkCenterCloseDateToRequest,
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

  it('maps close date to request', () => {
    expect(mapWorkCenterCloseDateToRequest('2026-12-31')).toEqual({ endDate: '2026-12-31' });
  });
});
