import {
  mapAddressDraftToCreateAddressRequest,
  mapAddressCloseDateToRequest,
} from './employee-address-edit.mapper';

describe('employee-address-edit.mapper', () => {
  it('maps address create draft to request normalizing codes', () => {
    const result = mapAddressDraftToCreateAddressRequest({
      addressTypeCode: 'home',
      street: '  Calle Mayor 1  ',
      city: 'Madrid',
      countryCode: 'es',
      postalCode: '28001',
      regionCode: 'mad',
      startDate: '2026-01-01',
    });
    expect(result.addressTypeCode).toBe('HOME');
    expect(result.countryCode).toBe('ES');
    expect(result.street).toBe('Calle Mayor 1');
    expect(result.endDate).toBeNull();
  });

  it('maps close date to request', () => {
    expect(mapAddressCloseDateToRequest('2026-12-31')).toEqual({ endDate: '2026-12-31' });
  });
});
