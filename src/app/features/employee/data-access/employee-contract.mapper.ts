import {
  CloseContractRequest,
  ContractPeriod,
  ContractPlanResponse,
  ContractPlanResponseOperationEnum,
  ContractPlanResponseRejectionEnum,
  CreateContractRequest,
  PlanContractChangeRequest,
  PlanContractChangeRequestOperationEnum,
  ReplaceContractFromDateRequest,
  UpdateContractRequest,
} from '../../../core/api/generated/model/models';
import { EmployeeContractModel } from '../models/employee-contract.model';
import {
  ContractDatePeriod,
  ContractPlanOperation,
  ContractPlanRejection,
  EmployeeContractPlanModel,
} from '../models/employee-contract-plan.model';

export interface ContractReplaceDraft {
  effectiveDate: string;
  contractCode: string;
  contractSubtypeCode: string;
}

/** El alta de un contrato: su tramo y sus códigos. Lo que se cierra lo dice el plan (ADR-057). */
export interface ContractCreateDraft {
  startDate: string;
  /** Null para un contrato que queda en vigor. */
  endDate: string | null;
  contractCode: string;
  contractSubtypeCode: string;
}

export interface ContractCorrectDraft {
  startDate: string;
  endDate: string | null;
  contractCode: string;
  contractSubtypeCode: string;
}

/**
 * Lo que se pide planificar: la misma operación que luego se aplicaría, sin aplicarla. El
 * contrato a corregir se identifica por el día en que empieza, y el backend llama a ese campo
 * `contractStartDate` —en clasificación laboral se llama de otra forma (backend#56); el nombre
 * es suyo y aquí se respeta, no se unifica—.
 */
export type ContractPlanDraft =
  | { operation: 'ADD'; startDate: string; endDate: string | null }
  | {
      operation: 'CORRECT';
      contractStartDate: string;
      startDate: string;
      endDate: string | null;
    };

export interface ContractCloseDraft {
  endDate: string;
}

export function createEmptyContractReplaceDraft(): ContractReplaceDraft {
  return {
    effectiveDate: '',
    contractCode: '',
    contractSubtypeCode: '',
  };
}

export function createEmptyContractCorrectDraft(): ContractCorrectDraft {
  return {
    startDate: '',
    endDate: null,
    contractCode: '',
    contractSubtypeCode: '',
  };
}

export function createEmptyContractCloseDraft(): ContractCloseDraft {
  return {
    endDate: '',
  };
}

export function mapContractReplaceDraftToRequest(
  source: ContractReplaceDraft,
): ReplaceContractFromDateRequest {
  return {
    effectiveDate: source.effectiveDate.trim(),
    contractCode: source.contractCode.trim().toUpperCase(),
    contractSubtypeCode: source.contractSubtypeCode.trim().toUpperCase(),
  };
}

export function mapContractCorrectDraftToRequest(
  source: ContractCorrectDraft,
): UpdateContractRequest {
  return {
    startDate: source.startDate.trim() || null,
    endDate: trimOptionalDate(source.endDate),
    contractCode: source.contractCode.trim().toUpperCase(),
    contractSubtypeCode: source.contractSubtypeCode.trim().toUpperCase(),
  };
}

export function mapContractPlanDraftToRequest(draft: ContractPlanDraft): PlanContractChangeRequest {
  switch (draft.operation) {
    case 'ADD':
      return {
        operation: PlanContractChangeRequestOperationEnum.Add,
        startDate: draft.startDate.trim(),
        endDate: trimOptionalDate(draft.endDate),
      };
    case 'CORRECT':
      return {
        operation: PlanContractChangeRequestOperationEnum.Correct,
        contractStartDate: draft.contractStartDate.trim(),
        startDate: draft.startDate.trim(),
        endDate: trimOptionalDate(draft.endDate),
      };
  }
}

export function mapContractPlanResponseToModel(
  source: ContractPlanResponse,
): EmployeeContractPlanModel {
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

export function toDatePeriod(source: ContractPeriod): ContractDatePeriod {
  return { startDate: source.startDate, endDate: source.endDate ?? null };
}

function toPlanOperation(source: ContractPlanResponseOperationEnum): ContractPlanOperation {
  switch (source) {
    case ContractPlanResponseOperationEnum.Add:
      return 'ADD';
    case ContractPlanResponseOperationEnum.Remove:
      return 'REMOVE';
    case ContractPlanResponseOperationEnum.Correct:
      return 'CORRECT';
  }
}

function toPlanRejection(source: ContractPlanResponseRejectionEnum): ContractPlanRejection {
  switch (source) {
    case ContractPlanResponseRejectionEnum.OutsidePresence:
      return 'OUTSIDE_PRESENCE';
    case ContractPlanResponseRejectionEnum.Overlap:
      return 'OVERLAP';
    case ContractPlanResponseRejectionEnum.GapNotAllowed:
      return 'GAP_NOT_ALLOWED';
    case ContractPlanResponseRejectionEnum.IsACorrection:
      return 'IS_A_CORRECTION';
  }
}

function trimOptionalDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function mapContractCloseDraftToRequest(source: ContractCloseDraft): CloseContractRequest {
  return {
    endDate: source.endDate.trim(),
  };
}

export function mapContractCreateDraftToRequest(
  source: ContractCreateDraft,
): CreateContractRequest {
  return {
    contractCode: source.contractCode.trim().toUpperCase(),
    contractSubtypeCode: source.contractSubtypeCode.trim().toUpperCase(),
    startDate: source.startDate.trim(),
    endDate: trimOptionalDate(source.endDate),
  };
}
