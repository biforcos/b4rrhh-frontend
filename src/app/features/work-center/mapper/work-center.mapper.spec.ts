import {
  mapWorkCenterListItemResponseToModel,
  mapWorkCenterResponseToDetailModel,
} from './work-center.mapper';

describe('mapWorkCenterListItemResponseToModel', () => {
  it('maps all required fields', () => {
    const result = mapWorkCenterListItemResponseToModel({
      ruleSystemCode: 'ESP',
      workCenterCode: 'MAD-01',
      name: 'Madrid Central',
      companyCode: 'ES01',
      city: 'Madrid',
      countryCode: 'ES',
      active: true,
      startDate: '2020-01-01',
      endDate: '2025-12-31',
    });

    expect(result.ruleSystemCode).toBe('ESP');
    expect(result.workCenterCode).toBe('MAD-01');
    expect(result.companyCode).toBe('ES01');
    expect(result.endDate).toBe('2025-12-31');
  });

  it('normalizes undefined optional fields to null', () => {
    const result = mapWorkCenterListItemResponseToModel({
      ruleSystemCode: 'ESP',
      workCenterCode: 'MAD-01',
      name: 'Madrid',
      companyCode: undefined,
      city: undefined,
      countryCode: undefined,
      active: true,
      startDate: '2020-01-01',
      endDate: undefined,
    });

    expect(result.companyCode).toBeNull();
    expect(result.city).toBeNull();
    expect(result.endDate).toBeNull();
  });
});

describe('mapWorkCenterResponseToDetailModel', () => {
  it('maps address fields', () => {
    const result = mapWorkCenterResponseToDetailModel({
      ruleSystemCode: 'ESP',
      workCenterCode: 'MAD-01',
      name: 'Madrid Central',
      description: 'HQ',
      startDate: '2020-01-01',
      endDate: undefined,
      active: true,
      companyCode: 'ES01',
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

    expect(result.address?.streetName).toBe('Mayor');
    expect(result.address?.countryCode).toBe('ESP');
    expect(result.description).toBe('HQ');
    expect(result.endDate).toBeNull();
  });

  // Sin dirección, el backend la manda vacía y sin país (b4rrhh/backend#155): no hay dirección.
  it('maps an empty address to no address', () => {
    const result = mapWorkCenterResponseToDetailModel({
      ruleSystemCode: 'ESP',
      workCenterCode: 'MAD-01',
      name: 'Madrid',
      description: undefined,
      startDate: '2020-01-01',
      endDate: undefined,
      active: true,
      companyCode: undefined,
      address: { normalized: false },
    });

    expect(result.description).toBeNull();
    expect(result.address).toBeNull();
    expect(result.companyCode).toBeNull();
  });
});
