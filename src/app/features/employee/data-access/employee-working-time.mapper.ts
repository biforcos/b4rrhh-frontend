import {
  CreateWorkingTimeRequest,
  PlanWorkingTimeChangeRequest,
  PlanWorkingTimeChangeRequestOperationEnum,
  UpdateWorkingTimeRequest,
  WorkingTimeOccurrence,
  WorkingTimePeriod,
  WorkingTimePlanResponse,
  WorkingTimePlanResponseOperationEnum,
  WorkingTimePlanResponseRejectionEnum,
} from '../../../core/api/generated/model/models';
import {
  EmployeeWorkingTimePlanModel,
  WorkingTimeDatePeriod,
  WorkingTimePlanOccurrence,
  WorkingTimePlanOperation,
  WorkingTimePlanRejection,
} from '../models/employee-working-time-plan.model';

export interface WorkingTimeCreateDraft {
  startDate: string;
  /** Null para una jornada que queda en vigor. */
  endDate: string | null;
  workingTimePercentage: number;
}

export interface WorkingTimeUpdateDraft {
  startDate: string;
  endDate: string | null;
  workingTimePercentage: number;
}

/** Lo que se pide planificar: la misma operación que luego se aplicaría, sin aplicarla. */
export type WorkingTimePlanDraft =
  | { operation: 'ADD'; startDate: string; endDate: string | null }
  | { operation: 'REMOVE'; workingTimeNumber: number }
  | { operation: 'CORRECT'; workingTimeNumber: number; startDate: string; endDate: string | null };

export function mapWorkingTimeCreateDraftToRequest(
  draft: WorkingTimeCreateDraft,
): CreateWorkingTimeRequest {
  return {
    startDate: draft.startDate.trim(),
    endDate: trimOptionalDate(draft.endDate),
    workingTimePercentage: draft.workingTimePercentage,
  };
}

export function mapWorkingTimeUpdateDraftToRequest(
  draft: WorkingTimeUpdateDraft,
): UpdateWorkingTimeRequest {
  return {
    startDate: draft.startDate.trim(),
    endDate: trimOptionalDate(draft.endDate),
    workingTimePercentage: draft.workingTimePercentage,
  };
}

export function mapWorkingTimePlanDraftToRequest(
  draft: WorkingTimePlanDraft,
): PlanWorkingTimeChangeRequest {
  switch (draft.operation) {
    case 'ADD':
      return {
        operation: PlanWorkingTimeChangeRequestOperationEnum.Add,
        startDate: draft.startDate.trim(),
        endDate: trimOptionalDate(draft.endDate),
      };
    case 'REMOVE':
      return {
        operation: PlanWorkingTimeChangeRequestOperationEnum.Remove,
        workingTimeNumber: draft.workingTimeNumber,
      };
    case 'CORRECT':
      return {
        operation: PlanWorkingTimeChangeRequestOperationEnum.Correct,
        workingTimeNumber: draft.workingTimeNumber,
        startDate: draft.startDate.trim(),
        endDate: trimOptionalDate(draft.endDate),
      };
  }
}

export function mapWorkingTimePlanResponseToModel(
  source: WorkingTimePlanResponse,
): EmployeeWorkingTimePlanModel {
  return {
    operation: toPlanOperation(source.operation),
    accepted: source.accepted,
    rejection: source.rejection ? toPlanRejection(source.rejection) : null,
    occurrence: toPlanOccurrence(source.occurrence),
    adjustedOccurrence: source.adjustedOccurrence
      ? {
          workingTimeNumber: source.adjustedOccurrence.workingTimeNumber,
          before: toDatePeriod(source.adjustedOccurrence.before),
          after: toDatePeriod(source.adjustedOccurrence.after),
        }
      : null,
    overlaps: source.overlaps.map(toDatePeriod),
    gaps: source.gaps.map(toDatePeriod),
    stretchCandidates: source.stretchCandidates.map(toPlanOccurrence),
    projected: source.projected.map(toPlanOccurrence),
  };
}

export function toDatePeriod(source: WorkingTimePeriod): WorkingTimeDatePeriod {
  return { startDate: source.startDate, endDate: source.endDate ?? null };
}

export function toPlanOccurrence(source: WorkingTimeOccurrence): WorkingTimePlanOccurrence {
  return {
    workingTimeNumber: source.workingTimeNumber ?? null,
    startDate: source.startDate,
    endDate: source.endDate ?? null,
  };
}

function toPlanOperation(source: WorkingTimePlanResponseOperationEnum): WorkingTimePlanOperation {
  switch (source) {
    case WorkingTimePlanResponseOperationEnum.Add:
      return 'ADD';
    case WorkingTimePlanResponseOperationEnum.Remove:
      return 'REMOVE';
    case WorkingTimePlanResponseOperationEnum.Correct:
      return 'CORRECT';
  }
}

function toPlanRejection(source: WorkingTimePlanResponseRejectionEnum): WorkingTimePlanRejection {
  switch (source) {
    case WorkingTimePlanResponseRejectionEnum.OutsidePresence:
      return 'OUTSIDE_PRESENCE';
    case WorkingTimePlanResponseRejectionEnum.Overlap:
      return 'OVERLAP';
    case WorkingTimePlanResponseRejectionEnum.GapNotAllowed:
      return 'GAP_NOT_ALLOWED';
  }
}

function trimOptionalDate(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
