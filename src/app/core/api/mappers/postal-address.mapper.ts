import { PostalAddressRequest, PostalAddressResponse } from '../generated/model/models';

/**
 * Una dirección, la misma en el domicilio del empleado, la empresa y el centro (b4rrhh/backend#155).
 * `normalized` a false es «sin normalizar»: el backend la guardó sin pasar la validación, y la
 * pantalla lo enseña.
 */
export interface PostalAddressModel {
  streetTypeCode: string | null;
  streetName: string | null;
  streetNumber: string | null;
  numberQualifier: string | null;
  block: string | null;
  stair: string | null;
  floor: string | null;
  door: string | null;
  locality: string | null;
  municipalityCode: string | null;
  municipalityName: string | null;
  subdivisionCode: string | null;
  postalCode: string | null;
  countryCode: string;
  normalized: boolean;
}

/**
 * Lo que hoy se edita de una dirección. Municipio, provincia y tipo de vía llegan con el
 * formulario de verdad (b4rrhh/frontend#126); mientras, se conservan los que ya tenía.
 */
export interface PostalAddressDraft {
  streetName: string;
  streetNumber: string;
  floor: string;
  door: string;
  locality: string;
  postalCode: string;
  countryCode: string;
}

export function mapPostalAddressResponseToModel(source: PostalAddressResponse): PostalAddressModel {
  return {
    streetTypeCode: optional(source.streetTypeCode),
    streetName: optional(source.streetName),
    streetNumber: optional(source.streetNumber),
    numberQualifier: optional(source.numberQualifier),
    block: optional(source.block),
    stair: optional(source.stair),
    floor: optional(source.floor),
    door: optional(source.door),
    locality: optional(source.locality),
    municipalityCode: optional(source.municipalityCode),
    municipalityName: optional(source.municipalityName),
    subdivisionCode: optional(source.subdivisionCode),
    postalCode: optional(source.postalCode),
    countryCode: (source.countryCode ?? '').trim().toUpperCase(),
    normalized: source.normalized,
  };
}

/**
 * La de una empresa o un centro: el backend la manda vacía cuando no tienen, y entonces no hay
 * dirección que enseñar. Sin país no se guarda ninguna (b4rrhh/backend#155).
 */
export function mapOptionalPostalAddressResponseToModel(
  source: PostalAddressResponse | null | undefined,
): PostalAddressModel | null {
  return source?.countryCode ? mapPostalAddressResponseToModel(source) : null;
}

export function emptyPostalAddressDraft(): PostalAddressDraft {
  return {
    streetName: '',
    streetNumber: '',
    floor: '',
    door: '',
    locality: '',
    postalCode: '',
    countryCode: '',
  };
}

export function mapPostalAddressToDraft(source: PostalAddressModel | null): PostalAddressDraft {
  if (!source) return emptyPostalAddressDraft();
  return {
    streetName: source.streetName ?? '',
    streetNumber: source.streetNumber ?? '',
    floor: source.floor ?? '',
    door: source.door ?? '',
    // Sin municipio, la población que se escribió está en la localidad.
    locality: source.locality ?? '',
    postalCode: source.postalCode ?? '',
    countryCode: source.countryCode,
  };
}

/**
 * La dirección que se envía: entera, porque el backend la sustituye y no la parchea. Lo que este
 * formulario no edita se conserva de `previous`; null si el formulario está vacío.
 */
export function mapPostalAddressDraftToRequest(
  draft: PostalAddressDraft,
  previous: PostalAddressModel | null = null,
): PostalAddressRequest | null {
  const edited = {
    streetName: optional(draft.streetName),
    streetNumber: optional(draft.streetNumber),
    floor: optional(draft.floor),
    door: optional(draft.door),
    locality: optional(draft.locality),
    postalCode: optional(draft.postalCode),
    countryCode: optional(draft.countryCode)?.toUpperCase() ?? null,
  };
  if (Object.values(edited).every((value) => value === null)) return null;

  return {
    streetTypeCode: previous?.streetTypeCode ?? null,
    numberQualifier: previous?.numberQualifier ?? null,
    block: previous?.block ?? null,
    stair: previous?.stair ?? null,
    municipalityCode: previous?.municipalityCode ?? null,
    subdivisionCode: previous?.subdivisionCode ?? null,
    ...edited,
    countryCode: edited.countryCode ?? '',
  };
}

/** La vía en una línea: «CL Mayor, 3, 3º D». Vacía si no hay vía. */
export function describeStreetLine(address: PostalAddressModel | null): string {
  if (!address) return '';
  const head = [address.streetTypeCode, address.streetName].filter(present).join(' ');
  const number = [address.streetNumber, address.numberQualifier].filter(present).join(' ');
  const parts = [
    head,
    number,
    address.block ? `bl. ${address.block}` : null,
    address.stair ? `esc. ${address.stair}` : null,
    [address.floor ? `${address.floor}º` : null, address.door].filter(present).join(' '),
  ].filter(present);
  return parts.join(', ');
}

/** El código postal y la población: el municipio, con la localidad delante si la hay. */
export function describeTownLine(address: PostalAddressModel | null): string {
  if (!address) return '';
  const town =
    address.locality &&
    address.municipalityName &&
    address.locality.toLowerCase() !== address.municipalityName.toLowerCase()
      ? `${address.locality}, ${address.municipalityName}`
      : (address.municipalityName ?? address.locality);
  return [address.postalCode, town].filter(present).join(' ');
}

function present(value: string | null | undefined): value is string {
  return !!value && value.trim().length > 0;
}

function optional(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}
