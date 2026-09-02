import { CompanyListItemResponse } from '../../../core/api/generated/model/company-list-item-response';
import { CompanyResponse } from '../../../core/api/generated/model/company-response';
import { CompanyDetailModel } from '../models/company-detail.model';
import { CompanyListItemModel } from '../models/company-list-item.model';

export function mapCompanyListItemResponseToModel(
  response: CompanyListItemResponse,
): CompanyListItemModel {
  return {
    ruleSystemCode: response.ruleSystemCode,
    companyCode: response.companyCode,
    name: response.name,
    legalName: response.legalName,
    taxIdentifier: response.taxIdentifier ?? null,
    countryCode: response.countryCode ?? null,
    active: response.active,
    startDate: response.startDate,
    endDate: response.endDate ?? null,
  };
}

export function mapCompanyResponseToDetailModel(response: CompanyResponse): CompanyDetailModel {
  return {
    ruleSystemCode: response.ruleSystemCode,
    companyCode: response.companyCode,
    name: response.name,
    description: response.description ?? null,
    startDate: response.startDate,
    endDate: response.endDate ?? null,
    active: response.active,
    legalName: response.legalName,
    taxIdentifier: response.taxIdentifier ?? null,
    address: {
      street: response.address?.street ?? null,
      city: response.address?.city ?? null,
      postalCode: response.address?.postalCode ?? null,
      regionCode: response.address?.regionCode ?? null,
      countryCode: response.address?.countryCode ?? null,
    },
  };
}
