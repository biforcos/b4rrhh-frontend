import {
  CloseCostCenterDistributionRequest,
  CostCenterDistributionItemRequest,
  CostCenterDistributionItemResponse,
  CostCenterDistributionWindowResponse,
  CreateCostCenterDistributionRequest,
  ReplaceCostCenterDistributionFromDateRequest,
} from '../../../core/api/generated/model/models';
import {
  EmployeeCostCenterHistoryModel,
  EmployeeCostCenterItemModel,
  EmployeeCostCenterWindowModel,
} from '../models/employee-cost-center.model';

export interface CostCenterDistributionItemDraft {
  costCenterCode: string;
  allocationPercentage: number;
}

export interface CostCenterDistributionCreateDraft {
  startDate: string;
  items: ReadonlyArray<CostCenterDistributionItemDraft>;
}

export interface CostCenterDistributionReplaceDraft {
  effectiveDate: string;
  items: ReadonlyArray<CostCenterDistributionItemDraft>;
}

export function mapCostCenterResponsesToHistoryModel(
  responses: ReadonlyArray<CostCenterDistributionWindowResponse>,
): EmployeeCostCenterHistoryModel {
  const windowsByPeriod = new Map<string, EmployeeCostCenterWindowModel>();

  for (const response of responses) {
    const key = `${response.startDate}|${response.endDate ?? ''}`;
    const existing = windowsByPeriod.get(key);
    const mappedItems = response.items.map((item) => mapCostCenterResponseToItemModel(item));

    if (existing) {
      existing.totalAllocationPercentage += response.totalAllocationPercentage;
      existing.items = [...existing.items, ...mappedItems];
      continue;
    }

    windowsByPeriod.set(key, {
      startDate: response.startDate,
      endDate: response.endDate ?? null,
      totalAllocationPercentage: response.totalAllocationPercentage,
      items: mappedItems,
    });
  }

  const history = Array.from(windowsByPeriod.values()).sort((a, b) => {
    if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate);
    const aEnd = a.endDate ?? '';
    const bEnd = b.endDate ?? '';
    return bEnd.localeCompare(aEnd);
  });
  const current = history.find((w) => !w.endDate) ?? null;

  return {
    currentDistribution: current,
    distributionHistory: history,
  };
}

export function mapCostCenterResponsesToWindowModel(
  response: CostCenterDistributionWindowResponse,
): EmployeeCostCenterWindowModel {
  const items = response.items.map((item) => mapCostCenterResponseToItemModel(item));

  return {
    startDate: response.startDate,
    endDate: response.endDate ?? null,
    totalAllocationPercentage: response.totalAllocationPercentage,
    items,
  };
}

function mapCostCenterResponseToItemModel(
  response: CostCenterDistributionItemResponse,
): EmployeeCostCenterItemModel {
  return {
    costCenterCode: response.costCenterCode,
    costCenterName: response.costCenterName ?? '',
    allocationPercentage: response.allocationPercentage,
  };
}

export function mapCostCenterDistributionCreateDraftToRequests(
  draft: CostCenterDistributionCreateDraft,
): CreateCostCenterDistributionRequest {
  return {
    startDate: draft.startDate,
    items: draft.items.map((item) => mapCostCenterDistributionItemDraftToRequest(item)),
  };
}

export function mapCostCenterDistributionReplaceDraftToRequests(
  draft: CostCenterDistributionReplaceDraft,
): ReplaceCostCenterDistributionFromDateRequest {
  return {
    effectiveDate: draft.effectiveDate,
    items: draft.items.map((item) => mapCostCenterDistributionItemDraftToRequest(item)),
  };
}

function mapCostCenterDistributionItemDraftToRequest(
  draft: CostCenterDistributionItemDraft,
): CostCenterDistributionItemRequest {
  return {
    costCenterCode: draft.costCenterCode.trim().toUpperCase(),
    allocationPercentage: draft.allocationPercentage,
  };
}

export function mapCostCenterDistributionCloseDateToRequest(
  endDate: string,
): CloseCostCenterDistributionRequest {
  return {
    endDate: endDate.trim(),
  };
}
