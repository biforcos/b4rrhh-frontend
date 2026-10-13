import { PostalAddressModel } from '../../../core/api/mappers/postal-address.mapper';

export interface WorkCenterDetailModel {
  ruleSystemCode: string;
  workCenterCode: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  companyCode: string | null;
  /** La dirección, la misma estructura que la del empleado; null si no tiene (b4rrhh/backend#155). */
  address: PostalAddressModel | null;
}
