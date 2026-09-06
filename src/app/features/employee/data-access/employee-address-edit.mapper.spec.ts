import {
  mapAddressCorrectDraftToUpdateAddressRequest,
  mapAddressDraftToCreateAddressRequest,
  mapAddressPlanDraftToRequest,
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
      endDate: '',
    });
    expect(result.addressTypeCode).toBe('HOME');
    expect(result.countryCode).toBe('ES');
    expect(result.street).toBe('Calle Mayor 1');
    expect(result.endDate).toBeNull();
  });

  // ADR-057, decisión 3: corregir una dirección son sus datos y su tramo. Sin las fechas en
  // el cuerpo, cambiar el inicio no cambiaba nada y nadie se enteraba.
  it('sends the corrected dates in the update request', () => {
    const result = mapAddressCorrectDraftToUpdateAddressRequest({
      street: 'Calle Mayor 1',
      city: 'Madrid',
      countryCode: 'es',
      postalCode: '',
      regionCode: '',
      startDate: '2026-03-01',
      endDate: '2026-06-30',
    });

    expect(result.startDate).toBe('2026-03-01');
    expect(result.endDate).toBe('2026-06-30');
  });

  it('names the series by type on an add and by address number on a correction or a removal', () => {
    expect(
      mapAddressPlanDraftToRequest({
        operation: 'ADD',
        addressTypeCode: 'home',
        startDate: '2026-03-01',
        endDate: null,
      }),
    ).toEqual({
      operation: 'ADD',
      addressTypeCode: 'HOME',
      startDate: '2026-03-01',
      endDate: null,
    });

    expect(
      mapAddressPlanDraftToRequest({
        operation: 'CORRECT',
        addressNumber: 4,
        startDate: '2026-03-01',
        endDate: '2026-06-30',
      }),
    ).toEqual({
      operation: 'CORRECT',
      addressNumber: 4,
      startDate: '2026-03-01',
      endDate: '2026-06-30',
    });

    expect(mapAddressPlanDraftToRequest({ operation: 'REMOVE', addressNumber: 4 })).toEqual({
      operation: 'REMOVE',
      addressNumber: 4,
    });
  });
});
