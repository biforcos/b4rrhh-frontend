import { EmployeeAddressApiModel } from '../clients/employee-address-read.client';
import { PostalAddressModel } from './postal-address.mapper';

export interface EmployeeAddressReadModel {
  addressNumber: number;
  addressTypeCode: string;
  addressTypeName?: string | null;
  address: PostalAddressModel;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}

export function mapEmployeeAddressApiToReadModel(
  source: EmployeeAddressApiModel,
): EmployeeAddressReadModel | null {
  if (!source.address.countryCode) {
    return null;
  }

  const endDate = normalizeOptionalValue(source.endDate);

  return {
    addressNumber: source.addressNumber,
    addressTypeCode: source.addressTypeCode.trim().toUpperCase(),
    addressTypeName: normalizeOptionalValue(source.addressTypeName),
    address: source.address,
    startDate: source.startDate.trim(),
    endDate,
    isActive: endDate === null,
  };
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}
