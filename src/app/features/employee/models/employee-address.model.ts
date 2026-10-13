import { PostalAddressModel } from '../../../core/api/mappers/postal-address.mapper';

export interface EmployeeAddressModel {
  addressNumber: number;
  addressTypeCode: string;
  addressTypeName?: string | null;
  address: PostalAddressModel;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}
