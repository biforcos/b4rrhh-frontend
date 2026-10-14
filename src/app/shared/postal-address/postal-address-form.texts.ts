/**
 * Los rótulos del formulario de dirección (b4rrhh/frontend#126): los del modelo 190 en castellano,
 * y la explicación detrás del «?» (b4rrhh/frontend#108). Son los mismos en el empleado, la empresa
 * y el centro porque el formulario es uno.
 */
export const postalAddressFormTexts = {
  countryLabel: 'País',
  municipalityLabel: 'Municipio',
  municipalityPlaceholder: 'Escribe el nombre',
  municipalityNoResults: 'Ningún municipio en vigor con ese nombre.',
  provinceLabel: 'Provincia',
  regionLabel: 'Comunidad autónoma',
  provinceAndRegionMore:
    'Son las del municipio. Para cambiarlas, elige otro municipio; no se escriben a mano.',
  localityLabel: 'Localidad',
  localityOptional: '(si no es el municipio)',
  townLabel: 'Población',
  postalCodeLabel: 'Código postal',
  streetTypeLabel: 'Tipo de vía',
  streetNameLabel: 'Nombre de la vía',
  streetNumberLabel: 'Número',
  moreLabel: 'Bloque, portal, escalera, planta y puerta',
  numberQualifierLabel: 'Calificador',
  blockLabel: 'Bloque',
  portalLabel: 'Portal',
  stairLabel: 'Escalera',
  floorLabel: 'Planta',
  doorLabel: 'Puerta',
  postalCodeNotFiveDigits: 'En España el código postal son cinco cifras.',
  postalCodeWithoutProvince: (postalCode: string) =>
    `Las dos primeras cifras de ${postalCode} no son una provincia.`,
  postalCodeOfAnotherProvince: (postalCode: string, itsProvince: string, chosen: string) =>
    `${postalCode} es de ${itsProvince}; has elegido ${chosen}.`,
  postalCodeSuggests: (postalCode: string, municipality: string) =>
    `El ${postalCode} es de ${municipality}.`,
  postalCodeSuggestionAction: (municipality: string) => `Elegir ${municipality}`,
  willBeSavedNotNormalized: (reason: string) => `Se guardará «sin normalizar»: ${reason}.`,
} as const;
