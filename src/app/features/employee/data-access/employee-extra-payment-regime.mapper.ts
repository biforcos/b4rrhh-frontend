import {
  CreateExtraPaymentRegimeRequest,
  PlanExtraPaymentRegimeChangeRequest,
  PlanExtraPaymentRegimeChangeRequestOperationEnum,
  UpdateExtraPaymentRegimeRequest,
  ExtraPaymentRegimeOccurrence,
  ExtraPaymentRegimePeriod,
  ExtraPaymentRegimePlanResponse,
  ExtraPaymentRegimePlanResponseOperationEnum,
  ExtraPaymentRegimePlanResponseRejectionEnum,
} from '../../../core/api/generated/model/models';
import {
  EmployeeExtraPaymentRegimePlanModel,
  ExtraPaymentRegimeDatePeriod,
  ExtraPaymentRegimePlanOccurrence,
  ExtraPaymentRegimePlanOperation,
  ExtraPaymentRegimePlanRejection,
} from '../models/employee-extra-payment-regime-plan.model';

export interface ExtraPaymentRegimeCreateDraft {
  startDate: string;
  /** Null para una regimen de pagas extras que queda en vigor. */
  endDate: string | null;
  prorated: boolean;
}

export interface ExtraPaymentRegimeUpdateDraft {
  startDate: string;
  endDate: string | null;
  prorated: boolean;
}

/** Lo que se pide planificar: la misma operación que luego se aplicaría, sin aplicarla. */
export type ExtraPaymentRegimePlanDraft =
  | { operation: 'ADD'; startDate: string; endDate: string | null }
  | { operation: 'REMOVE'; extraPaymentRegimeNumber: number }
  | {
      operation: 'CORRECT';
      extraPaymentRegimeNumber: number;
      startDate: string;
      endDate: string | null;
    };

export function mapExtraPaymentRegimeCreateDraftToRequest(
  draft: ExtraPaymentRegimeCreateDraft,
): CreateExtraPaymentRegimeRequest {
  return {
    startDate: draft.startDate.trim(),
    endDate: trimOptionalDate(draft.endDate),
    prorated: draft.prorated,
  };
}

export function mapExtraPaymentRegimeUpdateDraftToRequest(
  draft: ExtraPaymentRegimeUpdateDraft,
): UpdateExtraPaymentRegimeRequest {
  return {
    startDate: draft.startDate.trim(),
    endDate: trimOptionalDate(draft.endDate),
    prorated: draft.prorated,
  };
}

export function mapExtraPaymentRegimePlanDraftToRequest(
  draft: ExtraPaymentRegimePlanDraft,
): PlanExtraPaymentRegimeChangeRequest {
  switch (draft.operation) {
    case 'ADD':
      return {
        operation: PlanExtraPaymentRegimeChangeRequestOperationEnum.Add,
        startDate: draft.startDate.trim(),
        endDate: trimOptionalDate(draft.endDate),
      };
    case 'REMOVE':
      return {
        operation: PlanExtraPaymentRegimeChangeRequestOperationEnum.Remove,
        extraPaymentRegimeNumber: draft.extraPaymentRegimeNumber,
      };
    case 'CORRECT':
      return {
        operation: PlanExtraPaymentRegimeChangeRequestOperationEnum.Correct,
        extraPaymentRegimeNumber: draft.extraPaymentRegimeNumber,
        startDate: draft.startDate.trim(),
        endDate: trimOptionalDate(draft.endDate),
      };
  }
}

export function mapExtraPaymentRegimePlanResponseToModel(
  source: ExtraPaymentRegimePlanResponse,
): EmployeeExtraPaymentRegimePlanModel {
  return {
    operation: toPlanOperation(source.operation),
    accepted: source.accepted,
    rejection: source.rejection ? toPlanRejection(source.rejection) : null,
    occurrence: toPlanOccurrence(source.occurrence),
    correctedOccurrence: source.correctedOccurrence
      ? toPlanOccurrence(source.correctedOccurrence)
      : null,
    adjustedOccurrence: source.adjustedOccurrence
      ? {
          extraPaymentRegimeNumber: source.adjustedOccurrence.extraPaymentRegimeNumber,
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

export function toDatePeriod(source: ExtraPaymentRegimePeriod): ExtraPaymentRegimeDatePeriod {
  return { startDate: source.startDate, endDate: source.endDate ?? null };
}

export function toPlanOccurrence(
  source: ExtraPaymentRegimeOccurrence,
): ExtraPaymentRegimePlanOccurrence {
  return {
    extraPaymentRegimeNumber: source.extraPaymentRegimeNumber ?? null,
    startDate: source.startDate,
    endDate: source.endDate ?? null,
  };
}

function toPlanOperation(
  source: ExtraPaymentRegimePlanResponseOperationEnum,
): ExtraPaymentRegimePlanOperation {
  switch (source) {
    case ExtraPaymentRegimePlanResponseOperationEnum.Add:
      return 'ADD';
    case ExtraPaymentRegimePlanResponseOperationEnum.Remove:
      return 'REMOVE';
    case ExtraPaymentRegimePlanResponseOperationEnum.Correct:
      return 'CORRECT';
  }
}

function toPlanRejection(
  source: ExtraPaymentRegimePlanResponseRejectionEnum,
): ExtraPaymentRegimePlanRejection {
  switch (source) {
    case ExtraPaymentRegimePlanResponseRejectionEnum.OutsidePresence:
      return 'OUTSIDE_PRESENCE';
    case ExtraPaymentRegimePlanResponseRejectionEnum.Overlap:
      return 'OVERLAP';
    case ExtraPaymentRegimePlanResponseRejectionEnum.GapNotAllowed:
      return 'GAP_NOT_ALLOWED';
    case ExtraPaymentRegimePlanResponseRejectionEnum.IsACorrection:
      return 'IS_A_CORRECTION';
  }
}

function trimOptionalDate(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
