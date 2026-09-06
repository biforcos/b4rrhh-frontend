import {
  mapCostCenterResponsesToHistoryModel,
  mapCostCenterDistributionCreateDraftToRequests,
  mapCostCenterDistributionCorrectDraftToRequest,
  mapCostCenterPlanDraftToRequest,
} from './employee-cost-center.mapper';
import { CostCenterDistributionWindowResponse } from '../../../core/api/generated/model/models';

const item = (code: string, pct: number) => ({
  costCenterCode: code,
  costCenterName: `Centro ${code}`,
  allocationPercentage: pct,
});

const window = (start: string, end: string | undefined, pct: number, code: string) =>
  ({
    startDate: start,
    endDate: end,
    totalAllocationPercentage: pct,
    items: [item(code, pct)],
  }) as CostCenterDistributionWindowResponse;

describe('mapCostCenterResponsesToHistoryModel', () => {
  it('maps a single open window as currentDistribution', () => {
    const result = mapCostCenterResponsesToHistoryModel([
      window('2024-01-01', undefined, 100, 'CC1'),
    ]);

    expect(result.currentDistribution).not.toBeNull();
    expect(result.currentDistribution!.startDate).toBe('2024-01-01');
    expect(result.currentDistribution!.endDate).toBeNull();
  });

  it('returns null currentDistribution when all windows are closed', () => {
    const result = mapCostCenterResponsesToHistoryModel([
      window('2023-01-01', '2023-12-31', 100, 'CC1'),
    ]);

    expect(result.currentDistribution).toBeNull();
  });

  it('merges windows with the same period key', () => {
    const responses = [
      window('2024-01-01', undefined, 60, 'CC1'),
      window('2024-01-01', undefined, 40, 'CC2'),
    ];

    const result = mapCostCenterResponsesToHistoryModel(responses);

    expect(result.distributionHistory).toHaveLength(1);
    expect(result.distributionHistory[0].totalAllocationPercentage).toBe(100);
    expect(result.distributionHistory[0].items).toHaveLength(2);
  });

  it('sorts history descending by startDate', () => {
    const responses = [
      window('2023-01-01', '2023-12-31', 100, 'CC1'),
      window('2024-01-01', undefined, 100, 'CC2'),
    ];

    const result = mapCostCenterResponsesToHistoryModel(responses);

    expect(result.distributionHistory[0].startDate).toBe('2024-01-01');
    expect(result.distributionHistory[1].startDate).toBe('2023-01-01');
  });

  it('maps item names correctly', () => {
    const result = mapCostCenterResponsesToHistoryModel([
      window('2024-01-01', undefined, 100, 'CC1'),
    ]);

    expect(result.distributionHistory[0].items[0].costCenterCode).toBe('CC1');
    expect(result.distributionHistory[0].items[0].costCenterName).toBe('Centro CC1');
  });
});

describe('mapCostCenterDistributionCreateDraftToRequests', () => {
  it('maps the window dates and normalizes item codes', () => {
    const result = mapCostCenterDistributionCreateDraftToRequests({
      startDate: '2024-01-01',
      endDate: '',
      items: [{ costCenterCode: ' cc1 ', allocationPercentage: 100 }],
    });

    expect(result.startDate).toBe('2024-01-01');
    expect(result.endDate).toBeNull();
    expect(result.items[0].costCenterCode).toBe('CC1');
    expect(result.items[0].allocationPercentage).toBe(100);
  });
});

describe('mapCostCenterDistributionCorrectDraftToRequest', () => {
  // ADR-057, decisión 3: mover la ventana es parte de corregirla, y la ventana se
  // sustituye entera por las líneas dadas.
  it('sends the corrected dates and the whole set of lines', () => {
    const result = mapCostCenterDistributionCorrectDraftToRequest({
      startDate: '2024-06-01',
      endDate: '2024-12-31',
      items: [{ costCenterCode: ' cc2 ', allocationPercentage: 50 }],
    });

    expect(result.startDate).toBe('2024-06-01');
    expect(result.endDate).toBe('2024-12-31');
    expect(result.items[0].costCenterCode).toBe('CC2');
  });
});

describe('mapCostCenterPlanDraftToRequest', () => {
  it('names the window by the day it starts on a correction and on a removal', () => {
    expect(
      mapCostCenterPlanDraftToRequest({
        operation: 'ADD',
        startDate: '2024-06-01',
        endDate: null,
      }),
    ).toEqual({ operation: 'ADD', startDate: '2024-06-01', endDate: null });

    expect(
      mapCostCenterPlanDraftToRequest({
        operation: 'CORRECT',
        windowStartDate: '2024-01-01',
        startDate: '2024-02-01',
        endDate: '2024-12-31',
      }),
    ).toEqual({
      operation: 'CORRECT',
      windowStartDate: '2024-01-01',
      startDate: '2024-02-01',
      endDate: '2024-12-31',
    });

    expect(
      mapCostCenterPlanDraftToRequest({ operation: 'REMOVE', windowStartDate: '2024-01-01' }),
    ).toEqual({ operation: 'REMOVE', windowStartDate: '2024-01-01' });
  });
});
