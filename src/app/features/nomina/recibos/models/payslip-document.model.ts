/**
 * El documento de un recibo, tal y como el backend lo entrega (`b4rrhh/frontend#78`).
 *
 * **Los tres campos vienen de la respuesta y ninguno se decide aquí.** Ésa es la regla del issue,
 * y no es una formalidad: el backend tiene dos regímenes —un `DEFINITIVE` se sirve del almacén tal
 * cual se escribió al cerrar; los demás se dibujan al vuelo y llevan marca de borrador— y sabe en
 * cuál de los dos ha contestado. La pantalla no lo sabe, sólo lo supone por el estado que tenía
 * cargado, y las dos cosas pueden discrepar: basta con que alguien cierre el recibo desde otra
 * pestaña entre que ésta se cargó y alguien pulsa.
 *
 * Deducirlo aquí sería la segunda opinión que acaba contradiciendo a la primera.
 */
export interface PayslipDocumentModel {
  /** Los bytes que el backend ha servido. No se tocan: se guardan. */
  readonly blob: Blob;

  /**
   * Con qué nombre se guarda, leído de `Content-Disposition`.
   *
   * El backend escribe `-borrador` en el nombre cuando lo es, y ese sufijo importa más de lo que
   * parece: el fichero sale del navegador y acaba en una carpeta, lejos de la pantalla que sabía
   * en qué estado estaba el recibo.
   */
  readonly fileName: string;

  /**
   * Si lo que ha llegado es el documento archivado, leído de `X-Payslip-Document-Definitive`.
   *
   * No es `status === 'DEFINITIVE'` mirado desde el cliente. Es lo que el backend dice que ha
   * servido.
   */
  readonly definitive: boolean;
}
