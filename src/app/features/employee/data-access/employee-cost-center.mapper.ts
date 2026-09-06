import {
  CostCenterDistributionItemRequest,
  CostCenterDistributionItemResponse,
  CostCenterDistributionPeriod,
  CostCenterDistributionPlanResponse,
  CostCenterDistributionPlanResponseOperationEnum,
  CostCenterDistributionPlanResponseRejectionEnum,
  CostCenterDistributionWindowResponse,
  CreateCostCenterDistributionRequest,
  PlanCostCenterDistributionChangeRequest,
  PlanCostCenterDistributionChangeRequestOperationEnum,
  UpdateCostCenterDistributionRequest,
} from '../../../core/api/generated/model/models';
import {
  CostCenterDatePeriod,
  CostCenterPlanOperation,
  CostCenterPlanRejection,
  EmployeeCostCenterPlanModel,
} from '../models/employee-cost-center-plan.model';
import {
  EmployeeCostCenterHistoryModel,
  EmployeeCostCenterItemModel,
  EmployeeCostCenterWindowModel,
} from '../models/employee-cost-center.model';

export interface CostCenterDistributionItemDraft {
  costCenterCode: string;
  allocationPercentage: number;
}

/** El alta de una ventana: su tramo y sus líneas. Lo que se cierra lo dice el plan (ADR-057). */
export interface CostCenterDistributionCreateDraft {
  startDate: string;
  /** Vacía para una ventana que queda en vigor. */
  endDate: string;
  items: ReadonlyArray<CostCenterDistributionItemDraft>;
}

/**
 * La corrección de una ventana: corregir una línea es corregir el conjunto, así que la ventana
 * se sustituye entera por las líneas dadas (ADR-057, decisión 3).
 */
export interface CostCenterDistributionCorrectDraft {
  startDate: string;
  endDate: string;
  items: ReadonlyArray<CostCenterDistributionItemDraft>;
}

/**
 * Lo que se pide planificar: la misma operación que luego se aplicaría, sin aplicarla. La
 * ventana a corregir o a borrar se identifica por el día en que empieza, que es como la nombra
 * la ruta.
 */
export type CostCenterPlanDraft =
  | { operation: 'ADD'; startDate: string; endDate: string | null }
  | {
      operation: 'CORRECT';
      windowStartDate: string;
      startDate: string;
      endDate: string | null;
    }
  | { operation: 'REMOVE'; windowStartDate: string };

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
    startDate: normalizeRequiredValue(draft.startDate),
    endDate: normalizeOptionalValue(draft.endDate),
    items: draft.items.map((item) => mapCostCenterDistributionItemDraftToRequest(item)),
  };
}

export function mapCostCenterDistributionCorrectDraftToRequest(
  draft: CostCenterDistributionCorrectDraft,
): UpdateCostCenterDistributionRequest {
  return {
    // Las fechas corregidas viajan: mover la ventana es parte de corregirla (ADR-057,
    // decisión 3), y sin ellas el backend deja el tramo como estaba.
    startDate: normalizeRequiredValue(draft.startDate),
    endDate: normalizeOptionalValue(draft.endDate),
    items: draft.items.map((item) => mapCostCenterDistributionItemDraftToRequest(item)),
  };
}

export function mapCostCenterPlanDraftToRequest(
  draft: CostCenterPlanDraft,
): PlanCostCenterDistributionChangeRequest {
  switch (draft.operation) {
    case 'ADD':
      return {
        operation: PlanCostCenterDistributionChangeRequestOperationEnum.Add,
        startDate: normalizeRequiredValue(draft.startDate),
        endDate: normalizeOptionalValue(draft.endDate),
      };
    case 'CORRECT':
      return {
        operation: PlanCostCenterDistributionChangeRequestOperationEnum.Correct,
        windowStartDate: normalizeRequiredValue(draft.windowStartDate),
        startDate: normalizeRequiredValue(draft.startDate),
        endDate: normalizeOptionalValue(draft.endDate),
      };
    case 'REMOVE':
      return {
        operation: PlanCostCenterDistributionChangeRequestOperationEnum.Remove,
        windowStartDate: normalizeRequiredValue(draft.windowStartDate),
      };
  }
}

export function mapCostCenterPlanResponseToModel(
  source: CostCenterDistributionPlanResponse,
): EmployeeCostCenterPlanModel {
  return {
    operation: toPlanOperation(source.operation),
    accepted: source.accepted,
    rejection: source.rejection ? toPlanRejection(source.rejection) : null,
    occurrence: toDatePeriod(source.occurrence),
    correctedOccurrence: source.correctedOccurrence
      ? toDatePeriod(source.correctedOccurrence)
      : null,
    adjustedOccurrence: source.adjustedOccurrence
      ? {
          before: toDatePeriod(source.adjustedOccurrence.before),
          after: toDatePeriod(source.adjustedOccurrence.after),
        }
      : null,
    overlaps: source.overlaps.map(toDatePeriod),
    gaps: source.gaps.map(toDatePeriod),
    stretchCandidates: source.stretchCandidates.map(toDatePeriod),
    projected: source.projected.map(toDatePeriod),
  };
}

function toDatePeriod(source: CostCenterDistributionPeriod): CostCenterDatePeriod {
  return { startDate: source.startDate, endDate: source.endDate ?? null };
}

function toPlanOperation(
  source: CostCenterDistributionPlanResponseOperationEnum,
): CostCenterPlanOperation {
  switch (source) {
    case CostCenterDistributionPlanResponseOperationEnum.Add:
      return 'ADD';
    case CostCenterDistributionPlanResponseOperationEnum.Remove:
      return 'REMOVE';
    case CostCenterDistributionPlanResponseOperationEnum.Correct:
      return 'CORRECT';
  }
}

function toPlanRejection(
  source: CostCenterDistributionPlanResponseRejectionEnum,
): CostCenterPlanRejection {
  switch (source) {
    case CostCenterDistributionPlanResponseRejectionEnum.OutsidePresence:
      return 'OUTSIDE_PRESENCE';
    case CostCenterDistributionPlanResponseRejectionEnum.Overlap:
      return 'OVERLAP';
    case CostCenterDistributionPlanResponseRejectionEnum.GapNotAllowed:
      return 'GAP_NOT_ALLOWED';
    case CostCenterDistributionPlanResponseRejectionEnum.IsACorrection:
      return 'IS_A_CORRECTION';
  }
}

function mapCostCenterDistributionItemDraftToRequest(
  draft: CostCenterDistributionItemDraft,
): CostCenterDistributionItemRequest {
  return {
    costCenterCode: draft.costCenterCode.trim().toUpperCase(),
    allocationPercentage: draft.allocationPercentage,
  };
}

function normalizeRequiredValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}
