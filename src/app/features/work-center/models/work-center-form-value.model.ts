import { PostalAddressModel } from '../../../core/api/mappers/postal-address.mapper';

export interface WorkCenterFormValue {
  ruleSystemCode: string;
  workCenterCode: string;
  name: string;
  description: string;
  startDate: string;
  companyCode: string;
  streetName: string;
  streetNumber: string;
  floor: string;
  door: string;
  locality: string;
  postalCode: string;
  countryCode: string;
  /**
   * La dirección que había al abrir el formulario. Se manda entera (b4rrhh/backend#155), y lo que
   * aquí no se edita —municipio, provincia, tipo de vía— se conserva de ella.
   */
  previousAddress: PostalAddressModel | null;
}
