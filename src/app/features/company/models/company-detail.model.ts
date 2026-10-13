import { PostalAddressModel } from '../../../core/api/mappers/postal-address.mapper';

export interface CompanyDetailModel {
  ruleSystemCode: string;
  companyCode: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  legalName: string;
  taxIdentifier: string | null;
  /** La dirección, la misma estructura que la del empleado; null si no tiene (b4rrhh/backend#155). */
  address: PostalAddressModel | null;
  /**
   * La actividad economica de la empresa, en CNAE (`b4rrhh/backend#122`).
   *
   * De el sale el tipo de la cuota de accidentes de trabajo de sus empleados, asi que una
   * empresa sin el no puede calcular nomina. Se llamaba `epigrafeAtCode` y el nombre estaba mal:
   * el «epigrafe» es la tarifa anterior a 2007 y hoy no significa nada.
   */
  cnaeCode: string | null;
}
