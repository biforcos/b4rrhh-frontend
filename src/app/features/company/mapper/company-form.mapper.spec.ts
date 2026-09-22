import {
  buildEmptyCompanyFormValue,
  buildCompanyFormValueFromDetail,
  mapCompanyFormValueToCreateRequest,
  mapCompanyFormValueToUpdateRequest,
} from './company-form.mapper';
import { CompanyDetailModel } from '../models/company-detail.model';

const detail: CompanyDetailModel = {
  ruleSystemCode: 'ESP',
  companyCode: 'ES01',
  name: 'Company Spain',
  description: 'A company',
  startDate: '2020-01-01',
  endDate: null,
  active: true,
  legalName: 'Company Spain SL',
  taxIdentifier: 'B12345678',
  cnaeCode: '4719',
  address: {
    street: 'Calle Mayor 1',
    city: 'Madrid',
    postalCode: '28001',
    regionCode: 'MD',
    countryCode: 'ES',
  },
};

describe('buildEmptyCompanyFormValue', () => {
  it('returns an object with all string fields empty', () => {
    const form = buildEmptyCompanyFormValue();

    expect(form.ruleSystemCode).toBe('');
    expect(form.name).toBe('');
    expect(form.countryCode).toBe('');
  });
});

describe('buildCompanyFormValueFromDetail', () => {
  it('maps all detail fields to form values', () => {
    const form = buildCompanyFormValueFromDetail(detail);

    expect(form.ruleSystemCode).toBe('ESP');
    expect(form.companyCode).toBe('ES01');
    expect(form.name).toBe('Company Spain');
    expect(form.street).toBe('Calle Mayor 1');
    expect(form.countryCode).toBe('ES');
  });

  it('converts null optional fields to empty strings', () => {
    const form = buildCompanyFormValueFromDetail({
      ...detail,
      description: null,
      taxIdentifier: null,
      cnaeCode: null,
    });

    expect(form.description).toBe('');
    expect(form.taxIdentifier).toBe('');
  });
});

describe('mapCompanyFormValueToCreateRequest', () => {
  it('trims and uppercases codes', () => {
    const form = buildCompanyFormValueFromDetail(detail);
    const result = mapCompanyFormValueToCreateRequest({
      ...form,
      ruleSystemCode: ' esp ',
      companyCode: ' es01 ',
    });

    expect(result.ruleSystemCode).toBe('ESP');
    expect(result.companyCode).toBe('ES01');
  });

  it('normalizes empty description to null', () => {
    const result = mapCompanyFormValueToCreateRequest({
      ...buildCompanyFormValueFromDetail(detail),
      description: '   ',
    });

    expect(result.description).toBeNull();
  });

  it('returns undefined address when all address fields are blank', () => {
    const form = buildEmptyCompanyFormValue();
    const result = mapCompanyFormValueToCreateRequest({
      ...form,
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
      name: 'X',
      legalName: 'X SL',
      startDate: '2020-01-01',
    });

    expect(result.address).toBeUndefined();
  });

  it('includes address when at least one address field is filled', () => {
    const form = buildCompanyFormValueFromDetail(detail);
    const result = mapCompanyFormValueToCreateRequest(form);

    expect(result.address).toBeDefined();
    expect(result.address?.city).toBe('Madrid');
  });
});

describe('mapCompanyFormValueToUpdateRequest', () => {
  it('does not include ruleSystemCode or companyCode', () => {
    const result = mapCompanyFormValueToUpdateRequest(buildCompanyFormValueFromDetail(detail));

    expect((result as any).ruleSystemCode).toBeUndefined();
    expect((result as any).companyCode).toBeUndefined();
  });

  it('uppercases countryCode in address', () => {
    const form = buildCompanyFormValueFromDetail({
      ...detail,
      address: { ...detail.address, countryCode: 'es' },
    });
    const result = mapCompanyFormValueToUpdateRequest(form);

    expect(result.address?.countryCode).toBe('ES');
  });
});
