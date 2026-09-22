export interface CompanyAddressModel {
  street: string | null;
  city: string | null;
  postalCode: string | null;
  regionCode: string | null;
  countryCode: string | null;
}

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
  address: CompanyAddressModel;
  /**
   * La actividad economica de la empresa, en CNAE (`b4rrhh/backend#122`).
   *
   * De el sale el tipo de la cuota de accidentes de trabajo de sus empleados, asi que una
   * empresa sin el no puede calcular nomina. Se llamaba `epigrafeAtCode` y el nombre estaba mal:
   * el «epigrafe» es la tarifa anterior a 2007 y hoy no significa nada.
   */
  cnaeCode: string | null;
}
