/**
 * Un bloque del modelo oficial de recibo de salarios (`b4rrhh/backend#109`).
 *
 * Devengos, deducciones, líquido, bases de cotización y aportación empresarial. **Los declara el
 * catálogo y los sirve la API**; el folio no sabe cuáles son ni en qué orden van, y ése es el
 * punto: hasta este paso los deducía de `conceptNatureCode` en getters de TypeScript, y esa
 * deducción tiraba las cinco líneas de aportación empresarial sin que nadie se enterase.
 */
export interface PayslipSectionModel {
  sectionCode: string;
  /** Cómo se llama el bloque. Viene del catálogo; aquí no se traduce nada. */
  label: string;
  /** Dónde va este bloque respecto de los otros. El folio ordena por esto y por nada más. */
  displayOrder: number;
}
