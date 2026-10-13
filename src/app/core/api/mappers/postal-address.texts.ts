/**
 * Por qué una dirección está «sin normalizar» (b4rrhh/backend#155), dicho para la ficha. Las claves
 * son los códigos que manda el backend en `normalizationIssue`; uno que no esté aquí se enseña tal
 * cual, que es mejor que callarlo.
 */
export const POSTAL_ADDRESS_ISSUE_TEXTS: Readonly<Record<string, string>> = {
  SIN_DIRECCION: 'no tiene dirección',
  SIN_VALIDAR: 'se escribió sin pasar la validación',
  MUNICIPIO_DESCONOCIDO: 'falta el municipio o no está en el maestro',
  MUNICIPIO_NO_VIGENTE: 'el municipio ya no existe en esa fecha',
  PROVINCIA_DESCONOCIDA: 'falta la provincia o no está en el catálogo',
  PROVINCIA_DE_OTRO_MUNICIPIO: 'la provincia no es la del municipio',
  CP_DESCONOCIDO: 'el código postal no está en el maestro',
  CP_DE_OTRA_PROVINCIA: 'el código postal es de otra provincia',
  TIPO_DE_VIA_DESCONOCIDO: 'falta el tipo de vía o no está en el catálogo',
  DATOS_DE_ESPANA_FUERA_DE_ESPANA:
    'lleva municipio, provincia o tipo de vía españoles fuera de España',
};
