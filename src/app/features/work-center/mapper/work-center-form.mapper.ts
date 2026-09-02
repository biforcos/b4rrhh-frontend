import { CreateWorkCenterRequest } from '../../../core/api/generated/model/create-work-center-request';
import { UpdateWorkCenterRequest } from '../../../core/api/generated/model/update-work-center-request';
import { WorkCenterAddress } from '../../../core/api/generated/model/work-center-address';
import { WorkCenterDetailModel } from '../models/work-center-detail.model';
import { WorkCenterFormValue } from '../models/work-center-form-value.model';

export function buildEmptyWorkCenterFormValue(): WorkCenterFormValue {
  return {
    ruleSystemCode: '',
    workCenterCode: '',
    name: '',
    description: '',
    startDate: '',
    companyCode: '',
    street: '',
    city: '',
    postalCode: '',
    regionCode: '',
    countryCode: '',
  };
}

export function buildWorkCenterFormValueFromDetail(
  detail: WorkCenterDetailModel,
): WorkCenterFormValue {
  return {
    ruleSystemCode: detail.ruleSystemCode,
    workCenterCode: detail.workCenterCode,
    name: detail.name,
    description: detail.description ?? '',
    startDate: detail.startDate,
    companyCode: detail.companyCode ?? '',
    street: detail.address.street ?? '',
    city: detail.address.city ?? '',
    postalCode: detail.address.postalCode ?? '',
    regionCode: detail.address.regionCode ?? '',
    countryCode: detail.address.countryCode ?? '',
  };
}

export function mapWorkCenterFormValueToCreateRequest(
  formValue: WorkCenterFormValue,
): CreateWorkCenterRequest {
  return {
    ruleSystemCode: normalizeRequired(formValue.ruleSystemCode),
    workCenterCode: normalizeRequired(formValue.workCenterCode),
    name: normalizeText(formValue.name),
    description: normalizeOptional(formValue.description),
    startDate: formValue.startDate,
    companyCode: normalizeOptionalCode(formValue.companyCode),
    address: mapAddress(formValue),
  };
}

export function mapWorkCenterFormValueToUpdateRequest(
  formValue: WorkCenterFormValue,
): UpdateWorkCenterRequest {
  return {
    name: normalizeText(formValue.name),
    description: normalizeOptional(formValue.description),
    companyCode: normalizeOptionalCode(formValue.companyCode),
    address: mapAddress(formValue),
  };
}

function mapAddress(formValue: WorkCenterFormValue): WorkCenterAddress | undefined {
  const address: WorkCenterAddress = {
    street: normalizeOptional(formValue.street),
    city: normalizeOptional(formValue.city),
    postalCode: normalizeOptional(formValue.postalCode),
    regionCode: normalizeOptionalCode(formValue.regionCode),
    countryCode: normalizeOptionalCode(formValue.countryCode),
  };

  return Object.values(address).some((value) => value != null && `${value}`.trim().length > 0)
    ? address
    : undefined;
}

function normalizeRequired(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeOptionalCode(value: string): string | undefined {
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeOptional(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
