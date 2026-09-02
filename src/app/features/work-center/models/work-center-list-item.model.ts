export interface WorkCenterListItemModel {
  ruleSystemCode: string;
  workCenterCode: string;
  name: string;
  companyCode: string | null;
  city: string | null;
  countryCode: string | null;
  active: boolean;
  startDate: string;
  endDate: string | null;
}
