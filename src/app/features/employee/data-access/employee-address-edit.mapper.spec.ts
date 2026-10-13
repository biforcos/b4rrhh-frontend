import {
  mapAddressCorrectDraftToUpdateAddressRequest,
  mapAddressDraftToCreateAddressRequest,
  mapAddressPlanDraftToRequest,
} from './employee-address-edit.mapper';

describe('employee-address-edit.mapper', () => {
  it('maps address create draft to request normalizing codes', () => {
    const result = mapAddressDraftToCreateAddressRequest({
      addressTypeCode: 'home',
      streetName: '  Mayor  ',
      streetNumber: '1',
      floor: '',
      door: '',
      locality: 'Madrid',
      countryCode: 'esp',
      postalCode: '28001',
      startDate: '2026-01-01',
      endDate: '',
    });
    expect(result.addressTypeCode).toBe('HOME');
    expect(result.address.countryCode).toBe('ESP');
    expect(result.address.streetName).toBe('Mayor');
    expect(result.address.floor).toBeNull();
    expect(result.endDate).toBeNull();
  });

  // ADR-057, decisión 3: corregir una dirección son sus datos y su tramo. Sin las fechas en
  // el cuerpo, cambiar el inicio no cambiaba nada y nadie se enteraba.
  it('sends the corrected dates in the update request', () => {
    const result = mapAddressCorrectDraftToUpdateAddressRequest({
      streetName: 'Mayor',
      streetNumber: '1',
      floor: '',
      door: '',
      locality: '',
      countryCode: 'esp',
      postalCode: '',
      startDate: '2026-03-01',
      endDate: '2026-06-30',
      previous: {
        streetTypeCode: 'CL',
        streetName: 'Mayor',
        streetNumber: '1',
        numberQualifier: null,
        block: null,
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
      },
    });

    expect(result.startDate).toBe('2026-03-01');
    expect(result.endDate).toBe('2026-06-30');
    // La corrección manda la dirección entera (b4rrhh/backend#155): lo que el formulario no edita
    // se conserva de la que había, y lo que vació se manda vacío.
    expect(result.address.municipalityCode).toBe('28079');
    expect(result.address.streetTypeCode).toBe('CL');
    expect(result.address.postalCode).toBeNull();
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
