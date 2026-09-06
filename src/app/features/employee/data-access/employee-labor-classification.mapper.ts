import {
  CreateLaborClassificationRequest,
  LaborClassificationPeriod,
  LaborClassificationPlanResponse,
  LaborClassificationPlanResponseOperationEnum,
  LaborClassificationPlanResponseRejectionEnum,
  PlanLaborClassificationChangeRequest,
  PlanLaborClassificationChangeRequestOperationEnum,
  UpdateLaborClassificationRequest,
} from '../../../core/api/generated/model/models';
import { EmployeeLaborClassificationModel } from '../models/employee-labor-classification.model';
import {
  EmployeeLaborClassificationPlanModel,
  LaborClassificationDatePeriod,
  LaborClassificationPlanOperation,
  LaborClassificationPlanRejection,
} from '../models/employee-labor-classification-plan.model';

/** El alta de una clasificación: su tramo y sus códigos. Lo que se cierra lo dice el plan (ADR-057). */
export interface LaborClassificationCreateDraft {
  startDate: string;
  /** Null para una clasificación que queda en vigor. */
  endDate: string | null;
  agreementCode: string;
  agreementCategoryCode: string;
}

export interface LaborClassificationCorrectDraft {
  startDate: string;
  endDate: string | null;
  agreementCode: string;
  agreementCategoryCode: string;
}

/**
 * Lo que se pide planificar: la misma operación que luego se aplicaría, sin aplicarla. La
 * clasificación a corregir se identifica por el día en que empieza, y el backend llama a ese
 * campo `laborClassificationStartDate` —en contrato se llama de otra forma (backend#56); el
 * nombre es suyo y aquí se respeta, no se unifica—.
 */
export type LaborClassificationPlanDraft =
  | { operation: 'ADD'; startDate: string; endDate: string | null }
  | {
      operation: 'CORRECT';
      laborClassificationStartDate: string;
      startDate: string;
      endDate: string | null;
    };

export function createEmptyLaborClassificationCorrectDraft(): LaborClassificationCorrectDraft {
  return {
    startDate: '',
    endDate: null,
    agreementCode: '',
    agreementCategoryCode: '',
  };
}

export function mapLaborClassificationCorrectDraftToRequest(
  source: LaborClassificationCorrectDraft,
): UpdateLaborClassificationRequest {
  return {
    startDate: source.startDate.trim() || null,
    endDate: trimOptionalDate(source.endDate),
    agreementCode: source.agreementCode.trim().toUpperCase(),
    agreementCategoryCode: source.agreementCategoryCode.trim().toUpperCase(),
  };
}

export function mapLaborClassificationPlanDraftToRequest(
  draft: LaborClassificationPlanDraft,
): PlanLaborClassificationChangeRequest {
  switch (draft.operation) {
    case 'ADD':
      return {
        operation: PlanLaborClassificationChangeRequestOperationEnum.Add,
        startDate: draft.startDate.trim(),
        endDate: trimOptionalDate(draft.endDate),
      };
    case 'CORRECT':
      return {
        operation: PlanLaborClassificationChangeRequestOperationEnum.Correct,
        laborClassificationStartDate: draft.laborClassificationStartDate.trim(),
        startDate: draft.startDate.trim(),
        endDate: trimOptionalDate(draft.endDate),
      };
  }
}

export function mapLaborClassificationPlanResponseToModel(
  source: LaborClassificationPlanResponse,
): EmployeeLaborClassificationPlanModel {
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

export function toDatePeriod(source: LaborClassificationPeriod): LaborClassificationDatePeriod {
  return { startDate: source.startDate, endDate: source.endDate ?? null };
}

function toPlanOperation(
  source: LaborClassificationPlanResponseOperationEnum,
): LaborClassificationPlanOperation {
  switch (source) {
    case LaborClassificationPlanResponseOperationEnum.Add:
      return 'ADD';
    case LaborClassificationPlanResponseOperationEnum.Remove:
      return 'REMOVE';
    case LaborClassificationPlanResponseOperationEnum.Correct:
      return 'CORRECT';
  }
}

function toPlanRejection(
  source: LaborClassificationPlanResponseRejectionEnum,
): LaborClassificationPlanRejection {
  switch (source) {
    case LaborClassificationPlanResponseRejectionEnum.OutsidePresence:
      return 'OUTSIDE_PRESENCE';
    case LaborClassificationPlanResponseRejectionEnum.Overlap:
      return 'OVERLAP';
    case LaborClassificationPlanResponseRejectionEnum.GapNotAllowed:
      return 'GAP_NOT_ALLOWED';
    case LaborClassificationPlanResponseRejectionEnum.IsACorrection:
      return 'IS_A_CORRECTION';
  }
}

function trimOptionalDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function mapLaborClassificationCreateDraftToRequest(
  source: LaborClassificationCreateDraft,
): CreateLaborClassificationRequest {
  return {
    agreementCode: source.agreementCode.trim().toUpperCase(),
    agreementCategoryCode: source.agreementCategoryCode.trim().toUpperCase(),
    startDate: source.startDate.trim(),
    endDate: trimOptionalDate(source.endDate),
  };
}
