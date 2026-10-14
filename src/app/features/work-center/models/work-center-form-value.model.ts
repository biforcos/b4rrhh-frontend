import { PostalAddressDraft } from '../../../core/api/mappers/postal-address.mapper';

export interface WorkCenterFormValue {
  ruleSystemCode: string;
  workCenterCode: string;
  name: string;
  description: string;
  startDate: string;
  companyCode: string;
  /**
   * La dirección, la del formulario común de los tres sitios (b4rrhh/frontend#126). Se manda
   * entera: el backend la sustituye y no la parchea (b4rrhh/backend#155).
   */
  address: PostalAddressDraft;
}
