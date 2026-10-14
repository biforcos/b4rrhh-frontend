import { CreateCompanyRequest } from '../../../core/api/generated/model/create-company-request';
import {
  emptyPostalAddressDraft,
  mapPostalAddressDraftToRequest,
  mapPostalAddressToDraft,
} from '../../../core/api/mappers/postal-address.mapper';
import { UpdateCompanyRequest } from '../../../core/api/generated/model/update-company-request';
import { CompanyDetailModel } from '../models/company-detail.model';
import { CompanyFormValue } from '../models/company-form-value.model';

export function buildEmptyCompanyFormValue(): CompanyFormValue {
  return {
    ruleSystemCode: '',
    companyCode: '',
    name: '',
    description: '',
    startDate: '',
    legalName: '',
    taxIdentifier: '',
    cnaeCode: '',
    address: emptyPostalAddressDraft(),
  };
}

export function buildCompanyFormValueFromDetail(detail: CompanyDetailModel): CompanyFormValue {
  return {
    ruleSystemCode: detail.ruleSystemCode,
    companyCode: detail.companyCode,
    name: detail.name,
    description: detail.description ?? '',
    startDate: detail.startDate,
    legalName: detail.legalName,
    taxIdentifier: detail.taxIdentifier ?? '',
    cnaeCode: detail.cnaeCode ?? '',
    address: mapPostalAddressToDraft(detail.address),
  };
}

export function mapCompanyFormValueToCreateRequest(form: CompanyFormValue): CreateCompanyRequest {
  return {
    ruleSystemCode: form.ruleSystemCode.trim().toUpperCase(),
    companyCode: form.companyCode.trim().toUpperCase(),
    name: form.name.trim(),
    description: form.description.trim() || null,
    startDate: form.startDate,
    legalName: form.legalName.trim(),
    taxIdentifier: form.taxIdentifier.trim() || null,
    address: buildAddressPayload(form),
    cnaeCode: form.cnaeCode.trim() || null,
  };
}

export function mapCompanyFormValueToUpdateRequest(form: CompanyFormValue): UpdateCompanyRequest {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    legalName: form.legalName.trim(),
    taxIdentifier: form.taxIdentifier.trim() || null,
    address: buildAddressPayload(form),
    // Se manda siempre, tambien vacio: el backend guarda lo que llega, asi que callarselo lo
    // borraria. Es un campo del formulario como el CIF, no un parche opcional
    // (`b4rrhh/backend#122`).
    cnaeCode: form.cnaeCode.trim() || null,
  };
}

function buildAddressPayload(form: CompanyFormValue) {
  return mapPostalAddressDraftToRequest(form.address) ?? undefined;
}
