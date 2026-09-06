import {
  EmployeeCreateWorkCenterRequest,
  EmployeeUpdateWorkCenterRequest,
  EmployeeWorkCenterOccurrence,
  EmployeeWorkCenterPeriod,
  EmployeeWorkCenterPlanResponse,
  EmployeeWorkCenterPlanResponseOperationEnum,
  EmployeeWorkCenterPlanResponseRejectionEnum,
  PlanWorkCenterChangeRequest,
  PlanWorkCenterChangeRequestOperationEnum,
} from '../../../core/api/generated/model/models';
import {
  EmployeeWorkCenterPlanModel,
  WorkCenterDatePeriod,
  WorkCenterOccurrencePeriod,
  WorkCenterPlanOperation,
  WorkCenterPlanRejection,
} from '../models/employee-work-center-plan.model';

export interface WorkCenterCreateDraft {
  workCenterCode: string;
  startDate: string;
  /** Vacía para una asignación que queda en vigor. */
  endDate: string;
}

export interface WorkCenterCorrectDraft {
  workCenterCode: string;
  startDate: string;
  endDate: string;
}

/**
 * Lo que se pide planificar: la misma operación que luego se aplicaría, sin aplicarla. La
 * asignación a corregir o a borrar se identifica por su número, que es como la nombra la ruta.
 */
export type WorkCenterPlanDraft =
  | { operation: 'ADD'; startDate: string; endDate: string | null }
  | {
      operation: 'CORRECT';
      workCenterAssignmentNumber: number;
      startDate: string;
      endDate: string | null;
    }
  | { operation: 'REMOVE'; workCenterAssignmentNumber: number };

export function mapWorkCenterCreateDraftToRequest(
  draft: WorkCenterCreateDraft,
): EmployeeCreateWorkCenterRequest {
  return {
    workCenterCode: normalizeCode(draft.workCenterCode),
    startDate: normalizeRequiredValue(draft.startDate),
    endDate: normalizeOptionalValue(draft.endDate),
  };
}

export function mapWorkCenterCorrectDraftToRequest(
  draft: WorkCenterCorrectDraft,
): EmployeeUpdateWorkCenterRequest {
  return {
    workCenterCode: normalizeCode(draft.workCenterCode),
    startDate: normalizeRequiredValue(draft.startDate),
    endDate: normalizeOptionalValue(draft.endDate),
  };
}

export function mapWorkCenterPlanDraftToRequest(
  draft: WorkCenterPlanDraft,
): PlanWorkCenterChangeRequest {
  switch (draft.operation) {
    case 'ADD':
      return {
        operation: PlanWorkCenterChangeRequestOperationEnum.Add,
        startDate: normalizeRequiredValue(draft.startDate),
        endDate: normalizeOptionalValue(draft.endDate),
      };
    case 'CORRECT':
      return {
        operation: PlanWorkCenterChangeRequestOperationEnum.Correct,
        workCenterAssignmentNumber: draft.workCenterAssignmentNumber,
        startDate: normalizeRequiredValue(draft.startDate),
        endDate: normalizeOptionalValue(draft.endDate),
      };
    case 'REMOVE':
      return {
        operation: PlanWorkCenterChangeRequestOperationEnum.Remove,
        workCenterAssignmentNumber: draft.workCenterAssignmentNumber,
      };
  }
}

export function mapWorkCenterPlanResponseToModel(
  source: EmployeeWorkCenterPlanResponse,
): EmployeeWorkCenterPlanModel {
  return {
    operation: toPlanOperation(source.operation),
    accepted: source.accepted,
    rejection: source.rejection ? toPlanRejection(source.rejection) : null,
    occurrence: toOccurrencePeriod(source.occurrence),
    correctedOccurrence: source.correctedOccurrence
      ? toOccurrencePeriod(source.correctedOccurrence)
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

function toDatePeriod(source: EmployeeWorkCenterPeriod): WorkCenterDatePeriod {
  return { startDate: source.startDate, endDate: source.endDate ?? null };
}

function toOccurrencePeriod(source: EmployeeWorkCenterOccurrence): WorkCenterOccurrencePeriod {
  return {
    workCenterAssignmentNumber: source.workCenterAssignmentNumber ?? null,
    startDate: source.startDate,
    endDate: source.endDate ?? null,
  };
}

function toPlanOperation(
  source: EmployeeWorkCenterPlanResponseOperationEnum,
): WorkCenterPlanOperation {
  switch (source) {
    case EmployeeWorkCenterPlanResponseOperationEnum.Add:
      return 'ADD';
    case EmployeeWorkCenterPlanResponseOperationEnum.Remove:
      return 'REMOVE';
    case EmployeeWorkCenterPlanResponseOperationEnum.Correct:
      return 'CORRECT';
  }
}

function toPlanRejection(
  source: EmployeeWorkCenterPlanResponseRejectionEnum,
): WorkCenterPlanRejection {
  switch (source) {
    case EmployeeWorkCenterPlanResponseRejectionEnum.OutsidePresence:
      return 'OUTSIDE_PRESENCE';
    case EmployeeWorkCenterPlanResponseRejectionEnum.Overlap:
      return 'OVERLAP';
    case EmployeeWorkCenterPlanResponseRejectionEnum.GapNotAllowed:
      return 'GAP_NOT_ALLOWED';
    case EmployeeWorkCenterPlanResponseRejectionEnum.IsACorrection:
      return 'IS_A_CORRECTION';
  }
}

function normalizeCode(value: string | null | undefined): string {
  return normalizeRequiredValue(value).toUpperCase();
}

function normalizeRequiredValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}
