import { CreateWorkCenterContactRequest } from '../../../core/api/generated/model/create-work-center-contact-request';
import { UpdateWorkCenterContactRequest } from '../../../core/api/generated/model/update-work-center-contact-request';
import { WorkCenterContactResponse } from '../../../core/api/generated/model/work-center-contact-response';
import { WorkCenterContactFormValue } from '../models/work-center-contact-form-value.model';
import { WorkCenterContactModel } from '../models/work-center-contact.model';

export function mapWorkCenterContactResponseToModel(
  response: WorkCenterContactResponse,
): WorkCenterContactModel {
  return {
    contactNumber: response.contactNumber,
    contactTypeCode: response.contactTypeCode,
    contactTypeName: response.contactTypeName ?? null,
    contactValue: response.contactValue,
  };
}

export function buildEmptyWorkCenterContactFormValue(): WorkCenterContactFormValue {
  return {
    contactTypeCode: '',
    contactValue: '',
  };
}

export function buildWorkCenterContactFormValueFromModel(
  model: WorkCenterContactModel,
): WorkCenterContactFormValue {
  return {
    contactTypeCode: model.contactTypeCode,
    contactValue: model.contactValue,
  };
}

export function mapWorkCenterContactFormValueToCreateRequest(
  formValue: WorkCenterContactFormValue,
): CreateWorkCenterContactRequest {
  return {
    contactTypeCode: formValue.contactTypeCode.trim().toUpperCase(),
    contactValue: formValue.contactValue.trim(),
  };
}

export function mapWorkCenterContactFormValueToUpdateRequest(
  formValue: WorkCenterContactFormValue,
): UpdateWorkCenterContactRequest {
  return {
    contactTypeCode: formValue.contactTypeCode.trim().toUpperCase(),
    contactValue: formValue.contactValue.trim(),
  };
}
