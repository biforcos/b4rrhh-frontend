import { PostalAddressDraft } from '../../../core/api/mappers/postal-address.mapper';

export interface CompanyFormValue {
  // Identity
  ruleSystemCode: string;
  companyCode: string;
  name: string;
  description: string;
  startDate: string;
  // Fiscal
  legalName: string;
  taxIdentifier: string;
  /** La actividad economica, en CNAE (`b4rrhh/backend#122`). */
  cnaeCode: string;
  /**
   * La dirección, la del formulario común de los tres sitios (b4rrhh/frontend#126). Se manda
   * entera: el backend la sustituye y no la parchea (b4rrhh/backend#155).
   */
  address: PostalAddressDraft;
}
