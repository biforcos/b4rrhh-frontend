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
  /**
   * Las partes en las que se divide este bloque (`b4rrhh/backend#121`).
   *
   * Vacío en cuatro de los cinco, que es el caso normal: los devengos se imprimen seguidos. El
   * recuadro de bases tiene cuatro apartados numerados, y lo que coloca una línea en uno de
   * ellos es su `payslipSubsectionCode`, congelado con la línea igual que el del bloque.
   */
  subsections: ReadonlyArray<PayslipSubsectionModel>;
}

/** Una parte de un bloque del recibo (`b4rrhh/backend#121`). */
export interface PayslipSubsectionModel {
  subsectionCode: string;
  /** Cómo se llama el apartado. Viene del catálogo; aquí no se traduce nada. */
  label: string;
  /** Dónde va dentro de su bloque. */
  displayOrder: number;
}
