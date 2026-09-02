export interface WorkCenterAddressModel {
  street: string | null;
  city: string | null;
  postalCode: string | null;
  regionCode: string | null;
  countryCode: string | null;
}

export interface WorkCenterDetailModel {
  ruleSystemCode: string;
  workCenterCode: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  companyCode: string | null;
  address: WorkCenterAddressModel;
}
