import {
  PostalAddressModel,
  describeNormalizationIssue,
  describeStreetLine,
  describeTownLine,
  mapOptionalPostalAddressResponseToModel,
  mapPostalAddressDraftToRequest,
  mapPostalAddressToDraft,
} from './postal-address.mapper';

const address: PostalAddressModel = {
  streetTypeCode: 'CL',
  streetName: 'Mayor',
  streetNumber: '3',
  numberQualifier: null,
  block: null,
  portal: null,
  stair: null,
  floor: '3',
  door: 'D',
  locality: null,
  municipalityCode: '28079',
  municipalityName: 'Madrid',
  subdivisionCode: '28',
  postalCode: '28001',
  countryCode: 'ESP',
  normalized: true,
  normalizationIssue: null,
};

describe('postal-address.mapper (b4rrhh/backend#155)', () => {
  it('describes the street and the town in one line each', () => {
    expect(describeStreetLine(address)).toBe('CL Mayor, 3, 3º D');
    expect(describeTownLine(address)).toBe('28001 Madrid');
    expect(describeTownLine({ ...address, locality: 'Aravaca' })).toBe('28001 Aravaca, Madrid');
    expect(describeTownLine({ ...address, municipalityName: null, locality: 'Lisboa' })).toBe(
      '28001 Lisboa',
    );
  });

  it('says why an address is not normalized, and shows the portal in the street line', () => {
    expect(describeNormalizationIssue(address)).toBe('');
    expect(
      describeNormalizationIssue({
        ...address,
        normalized: false,
        normalizationIssue: 'CP_DESCONOCIDO',
      }),
    ).toBe('el código postal no está en el maestro');
    expect(
      describeNormalizationIssue({ ...address, normalized: false, normalizationIssue: 'NUEVO' }),
    ).toBe('NUEVO');
    expect(describeStreetLine({ ...address, portal: '2' })).toBe('CL Mayor, 3, portal 2, 3º D');
  });

  it('reads an empty address of a company or a work center as no address', () => {
    expect(mapOptionalPostalAddressResponseToModel({ normalized: false })).toBeNull();
    expect(
      mapOptionalPostalAddressResponseToModel({ countryCode: 'esp', normalized: true })
        ?.countryCode,
    ).toBe('ESP');
  });

  it('sends the whole address, keeping what the form does not edit', () => {
    const request = mapPostalAddressDraftToRequest(
      { ...mapPostalAddressToDraft(address), streetNumber: '5', floor: '' },
      address,
    );

    expect(request).toEqual({
      streetTypeCode: 'CL',
      numberQualifier: null,
      block: null,
      portal: null,
      stair: null,
      municipalityCode: '28079',
      subdivisionCode: '28',
      streetName: 'Mayor',
      streetNumber: '5',
      floor: null,
      door: 'D',
      locality: null,
      postalCode: '28001',
      countryCode: 'ESP',
    });
  });

  it('sends nothing for an empty form', () => {
    expect(mapPostalAddressDraftToRequest(mapPostalAddressToDraft(null))).toBeNull();
  });
});
