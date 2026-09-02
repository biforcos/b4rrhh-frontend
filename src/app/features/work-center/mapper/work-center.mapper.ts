import { WorkCenterListItemResponse } from '../../../core/api/generated/model/work-center-list-item-response';
import { WorkCenterResponse } from '../../../core/api/generated/model/work-center-response';
import { WorkCenterDetailModel } from '../models/work-center-detail.model';
import { WorkCenterListItemModel } from '../models/work-center-list-item.model';

export function mapWorkCenterListItemResponseToModel(
  response: WorkCenterListItemResponse,
): WorkCenterListItemModel {
  return {
    ruleSystemCode: response.ruleSystemCode,
    workCenterCode: response.workCenterCode,
    name: response.name,
    companyCode: response.companyCode ?? null,
    city: response.city ?? null,
    countryCode: response.countryCode ?? null,
    active: response.active,
    startDate: response.startDate,
    endDate: response.endDate ?? null,
  };
}

export function mapWorkCenterResponseToDetailModel(
  response: WorkCenterResponse,
): WorkCenterDetailModel {
  return {
    ruleSystemCode: response.ruleSystemCode,
    workCenterCode: response.workCenterCode,
    name: response.name,
    description: response.description ?? null,
    startDate: response.startDate,
    endDate: response.endDate ?? null,
    active: response.active,
    companyCode: response.companyCode ?? null,
    address: {
      street: response.address?.street ?? null,
      city: response.address?.city ?? null,
      postalCode: response.address?.postalCode ?? null,
      regionCode: response.address?.regionCode ?? null,
      countryCode: response.address?.countryCode ?? null,
    },
  };
}
