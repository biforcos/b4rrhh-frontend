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
  // Address
  street: string;
  city: string;
  postalCode: string;
  regionCode: string;
  countryCode: string;
}
