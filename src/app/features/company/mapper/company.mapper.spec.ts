import {
  mapCompanyListItemResponseToModel,
  mapCompanyResponseToDetailModel,
} from './company.mapper';

describe('mapCompanyListItemResponseToModel', () => {
  it('maps all required fields', () => {
    const result = mapCompanyListItemResponseToModel({
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
      name: 'Company Spain',
      legalName: 'Company Spain SL',
      taxIdentifier: 'B12345678',
      countryCode: 'ES',
      active: true,
      startDate: '2020-01-01',
      endDate: '2025-12-31',
    });

    expect(result.ruleSystemCode).toBe('ESP');
    expect(result.companyCode).toBe('ES01');
    expect(result.name).toBe('Company Spain');
    expect(result.taxIdentifier).toBe('B12345678');
    expect(result.countryCode).toBe('ES');
    expect(result.endDate).toBe('2025-12-31');
  });

  it('normalizes null optional fields', () => {
    const result = mapCompanyListItemResponseToModel({
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
      name: 'Company',
      legalName: 'Company SL',
      taxIdentifier: undefined,
      countryCode: undefined,
      active: true,
      startDate: '2020-01-01',
      endDate: undefined,
    });

    expect(result.taxIdentifier).toBeNull();
    expect(result.countryCode).toBeNull();
    expect(result.endDate).toBeNull();
  });
});

describe('mapCompanyResponseToDetailModel', () => {
  it('maps detail fields including address', () => {
    const result = mapCompanyResponseToDetailModel({
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
      name: 'Company Spain',
      description: 'A company',
      legalName: 'Company Spain SL',
      taxIdentifier: 'B12345678',
      active: true,
      startDate: '2020-01-01',
      endDate: undefined,
      address: {
        streetTypeCode: 'CL',
        streetName: 'Mayor',
        streetNumber: '1',
        municipalityCode: '28079',
        municipalityName: 'Madrid',
        subdivisionCode: '28',
        postalCode: '28001',
        countryCode: 'ESP',
        normalized: true,
        normalizationIssue: null,
      },
    });

    expect(result.description).toBe('A company');
    expect(result.address?.streetName).toBe('Mayor');
    expect(result.address?.municipalityName).toBe('Madrid');
    expect(result.endDate).toBeNull();
  });

  // Sin dirección, el backend la manda vacía y sin país (b4rrhh/backend#155): no hay dirección.
  it('maps an empty address to no address', () => {
    const result = mapCompanyResponseToDetailModel({
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
      name: 'Company',
      description: undefined,
      legalName: 'Company SL',
      taxIdentifier: undefined,
      active: true,
      startDate: '2020-01-01',
      endDate: undefined,
      address: { normalized: false },
    });

    expect(result.description).toBeNull();
    expect(result.address).toBeNull();
  });
});
