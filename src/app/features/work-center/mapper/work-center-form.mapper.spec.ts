import { PostalAddressModel } from '../../../core/api/mappers/postal-address.mapper';
import {
  buildEmptyWorkCenterFormValue,
  buildWorkCenterFormValueFromDetail,
  mapWorkCenterFormValueToCreateRequest,
  mapWorkCenterFormValueToUpdateRequest,
} from './work-center-form.mapper';
import { WorkCenterDetailModel } from '../models/work-center-detail.model';

const ADDRESS: PostalAddressModel = {
  streetTypeCode: 'CL',
  streetName: 'Mayor',
  streetNumber: '1',
  numberQualifier: null,
  block: null,
  portal: null,
  stair: null,
  floor: null,
  door: null,
  locality: null,
  municipalityCode: '28079',
  municipalityName: 'Madrid',
  subdivisionCode: '28',
  postalCode: '28001',
  countryCode: 'ESP',
  normalized: true,
  normalizationIssue: null,
};

const detail: WorkCenterDetailModel = {
  ruleSystemCode: 'ESP',
  workCenterCode: 'MAD-01',
  name: 'Madrid Central',
  description: 'Main HQ',
  startDate: '2020-01-01',
  endDate: null,
  active: true,
  companyCode: 'ES01',
  address: ADDRESS,
};

describe('buildEmptyWorkCenterFormValue', () => {
  it('returns all string fields as empty strings', () => {
    const form = buildEmptyWorkCenterFormValue();

    expect(form.workCenterCode).toBe('');
    expect(form.name).toBe('');
    expect(form.countryCode).toBe('');
  });
});

describe('buildWorkCenterFormValueFromDetail', () => {
  it('maps all detail fields to form values', () => {
    const form = buildWorkCenterFormValueFromDetail(detail);

    expect(form.ruleSystemCode).toBe('ESP');
    expect(form.workCenterCode).toBe('MAD-01');
    expect(form.streetName).toBe('Mayor');
    expect(form.countryCode).toBe('ESP');
  });

  it('converts null optional fields to empty strings', () => {
    const form = buildWorkCenterFormValueFromDetail({
      ...detail,
      description: null,
      companyCode: null,
    });

    expect(form.description).toBe('');
    expect(form.companyCode).toBe('');
  });
});

describe('mapWorkCenterFormValueToCreateRequest', () => {
  it('uppercases ruleSystemCode and workCenterCode', () => {
    const form = buildWorkCenterFormValueFromDetail(detail);
    const result = mapWorkCenterFormValueToCreateRequest({
      ...form,
      ruleSystemCode: ' esp ',
      workCenterCode: ' mad-01 ',
    });

    expect(result.ruleSystemCode).toBe('ESP');
    expect(result.workCenterCode).toBe('MAD-01');
  });

  it('returns undefined description when blank', () => {
    const form = buildWorkCenterFormValueFromDetail(detail);
    const result = mapWorkCenterFormValueToCreateRequest({ ...form, description: '   ' });

    expect(result.description).toBeUndefined();
  });

  it('returns undefined address when all address fields are blank', () => {
    const form = buildEmptyWorkCenterFormValue();
    const result = mapWorkCenterFormValueToCreateRequest({
      ...form,
      ruleSystemCode: 'ESP',
      workCenterCode: 'MAD-01',
      name: 'X',
      startDate: '2020-01-01',
    });

    expect(result.address).toBeUndefined();
  });

  it('includes address when the street is filled', () => {
    const result = mapWorkCenterFormValueToCreateRequest(
      buildWorkCenterFormValueFromDetail(detail),
    );

    expect(result.address?.streetName).toBe('Mayor');
    // Lo que el formulario no edita se conserva de la que había (b4rrhh/backend#155).
    expect(result.address?.municipalityCode).toBe('28079');
  });
});

describe('mapWorkCenterFormValueToUpdateRequest', () => {
  it('does not include ruleSystemCode or workCenterCode', () => {
    const result = mapWorkCenterFormValueToUpdateRequest(
      buildWorkCenterFormValueFromDetail(detail),
    );

    expect((result as any).ruleSystemCode).toBeUndefined();
    expect((result as any).workCenterCode).toBeUndefined();
  });

  it('uppercases countryCode in address', () => {
    const form = buildWorkCenterFormValueFromDetail({
      ...detail,
      address: { ...ADDRESS, countryCode: 'esp' },
    });
    const result = mapWorkCenterFormValueToUpdateRequest(form);

    expect(result.address?.countryCode).toBe('ESP');
  });
});
