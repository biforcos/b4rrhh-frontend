import {
  AddressOccurrence,
  AddressPeriod,
  AddressPlanResponse,
  AddressPlanResponseOperationEnum,
  AddressPlanResponseRejectionEnum,
  CreateAddressRequest,
  PlanAddressChangeRequest,
  PlanAddressChangeRequestOperationEnum,
  UpdateAddressRequest,
} from '../../../core/api/generated/model/models';
import {
  AddressDatePeriod,
  AddressOccurrencePeriod,
  AddressPlanOperation,
  AddressPlanRejection,
  EmployeeAddressPlanModel,
} from '../models/employee-address-plan.model';

/** El alta de una dirección: su tipo, su tramo y sus datos. Lo que se cierra lo dice el plan (ADR-057). */
export interface AddressCreateDraft {
  addressTypeCode: string;
  street: string;
  city: string;
  countryCode: string;
  postalCode: string;
  regionCode: string;
  startDate: string;
  /** Vacío para una dirección que queda en vigor. */
  endDate: string;
}

/**
 * La corrección de una dirección: sus datos y su tramo. El tipo no está: nombra la serie a la
 * que pertenece la ocurrencia y una corrección no la cambia de serie.
 */
export interface AddressCorrectDraft {
  street: string;
  city: string;
  countryCode: string;
  postalCode: string;
  regionCode: string;
  startDate: string;
  endDate: string;
}

/**
 * Lo que se pide planificar: la misma operación que luego se aplicaría, sin aplicarla. Un alta
 * nombra la serie por su tipo; una corrección y un borrado, por el número de la dirección, que
 * ya lleva el suyo.
 */
export type AddressPlanDraft =
  | { operation: 'ADD'; addressTypeCode: string; startDate: string; endDate: string | null }
  | { operation: 'CORRECT'; addressNumber: number; startDate: string; endDate: string | null }
  | { operation: 'REMOVE'; addressNumber: number };

export function mapAddressDraftToCreateAddressRequest(
  draft: AddressCreateDraft,
): CreateAddressRequest {
  return {
    addressTypeCode: normalizeCode(draft.addressTypeCode),
    street: normalizeRequiredValue(draft.street),
    city: normalizeRequiredValue(draft.city),
    countryCode: normalizeCode(draft.countryCode),
    postalCode: normalizeOptionalValue(draft.postalCode),
    regionCode: normalizeOptionalValue(draft.regionCode),
    startDate: normalizeRequiredValue(draft.startDate),
    endDate: normalizeOptionalValue(draft.endDate),
  };
}

export function mapAddressCorrectDraftToUpdateAddressRequest(
  draft: AddressCorrectDraft,
): UpdateAddressRequest {
  return {
    street: normalizeRequiredValue(draft.street),
    city: normalizeRequiredValue(draft.city),
    countryCode: normalizeCode(draft.countryCode),
    postalCode: normalizeOptionalValue(draft.postalCode),
    regionCode: normalizeOptionalValue(draft.regionCode),
    // Las fechas corregidas viajan: corregir una dirección son sus datos y su tramo (ADR-057,
    // decisión 3). Dejarlas fuera hacía que cambiar el inicio no cambiara nada. El inicio
    // además es obligatorio en el contrato desde el backend#69: omitirlo es un 400, no un
    // «déjala como está».
    startDate: normalizeRequiredValue(draft.startDate),
    endDate: normalizeOptionalValue(draft.endDate),
  };
}

export function mapAddressPlanDraftToRequest(draft: AddressPlanDraft): PlanAddressChangeRequest {
  switch (draft.operation) {
    case 'ADD':
      return {
        operation: PlanAddressChangeRequestOperationEnum.Add,
        addressTypeCode: normalizeCode(draft.addressTypeCode),
        startDate: normalizeRequiredValue(draft.startDate),
        endDate: normalizeOptionalValue(draft.endDate),
      };
    case 'CORRECT':
      return {
        operation: PlanAddressChangeRequestOperationEnum.Correct,
        addressNumber: draft.addressNumber,
        startDate: normalizeRequiredValue(draft.startDate),
        endDate: normalizeOptionalValue(draft.endDate),
      };
    case 'REMOVE':
      return {
        operation: PlanAddressChangeRequestOperationEnum.Remove,
        addressNumber: draft.addressNumber,
      };
  }
}

export function mapAddressPlanResponseToModel(
  source: AddressPlanResponse,
): EmployeeAddressPlanModel {
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

function toDatePeriod(source: AddressPeriod): AddressDatePeriod {
  return { startDate: source.startDate, endDate: source.endDate ?? null };
}

function toOccurrencePeriod(source: AddressOccurrence): AddressOccurrencePeriod {
  return {
    addressNumber: source.addressNumber ?? null,
    startDate: source.startDate,
    endDate: source.endDate ?? null,
  };
}

function toPlanOperation(source: AddressPlanResponseOperationEnum): AddressPlanOperation {
  switch (source) {
    case AddressPlanResponseOperationEnum.Add:
      return 'ADD';
    case AddressPlanResponseOperationEnum.Remove:
      return 'REMOVE';
    case AddressPlanResponseOperationEnum.Correct:
      return 'CORRECT';
  }
}

function toPlanRejection(source: AddressPlanResponseRejectionEnum): AddressPlanRejection {
  switch (source) {
    case AddressPlanResponseRejectionEnum.Overlap:
      return 'OVERLAP';
    case AddressPlanResponseRejectionEnum.GapNotAllowed:
      return 'GAP_NOT_ALLOWED';
    case AddressPlanResponseRejectionEnum.IsACorrection:
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
