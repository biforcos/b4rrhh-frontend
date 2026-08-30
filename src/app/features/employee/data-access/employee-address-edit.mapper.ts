import {
  CloseAddressRequest,
  CreateAddressRequest,
  UpdateAddressRequest,
} from '../../../core/api/generated/model/models';

export interface AddressCreateDraft {
  addressTypeCode: string;
  street: string;
  city: string;
  countryCode: string;
  postalCode: string;
  regionCode: string;
  startDate: string;
}

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
    endDate: null,
  };
}

export function mapAddressCloseDateToRequest(endDate: string): CloseAddressRequest {
  return {
    endDate: normalizeRequiredValue(endDate),
  };
}

export function mapAddressEditCurrentDraftToUpdateAddressRequest(
  draft: AddressEditCurrentDraft,
): UpdateAddressRequest {
  return {
    street: normalizeRequiredValue(draft.street),
    city: normalizeRequiredValue(draft.city),
    countryCode: normalizeCode(draft.countryCode),
    postalCode: normalizeOptionalValue(draft.postalCode),
    regionCode: normalizeOptionalValue(draft.regionCode),
  };
}

export interface AddressEditCurrentDraft {
  street: string;
  city: string;
  countryCode: string;
  postalCode: string;
  regionCode: string;
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
