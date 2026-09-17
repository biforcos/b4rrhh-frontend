/**
 * Un paso que el motor dio calculando el recibo (`b4rrhh/backend#97`).
 *
 * No es una línea de recibo y no se mezcla con ellas: un recibo tiene 14 líneas y 35 pasos, y los
 * 21 que sobran —las bases y los técnicos— son justo los que explican de dónde sale el número.
 *
 * **La identidad de una fila es `executionOrder`, nunca `conceptCode`.** Un concepto de ámbito
 * `SEGMENT` se evalúa una vez por segmento, así que en los cinco empleados del mes partido el
 * `101` llega dos veces, con dos segmentos y dos precios. Cualquier `Map` o `track` por código
 * enseña uno y se come el otro, y acierta en 868 recibos de 873.
 */
export interface PayrollCalculationStepModel {
  /** Posición del paso en el plan de ejecución, desde 1. Es la clave de fila y el orden. */
  executionOrder: number;
  conceptCode: string;
  conceptMnemonic: string;
  calculationType: string;
  functionalNature: string;
  /**
   * `PERIOD` cuando el paso cubre el período entero, y entonces no lleva fechas de segmento.
   *
   * Va explícito y no se deduce de que las fechas vengan nulas — el backend lo sirve como columna
   * propia justo para que aquí no haya que adivinarlo.
   */
  executionScope: string;
  segmentStartDate: string | null;
  segmentEndDate: string | null;
  amount: number;
  quantity: number | null;
  rate: number | null;
  /**
   * El orden de folio de este concepto, o `null` si este paso no llegó al recibo.
   *
   * Es lo que distingue los pasos que se imprimen de los que no, y se usa **éste** y no la
   * naturaleza ni un cruce con la lista de conceptos.
   */
  payslipOrderCode: string | null;
  /**
   * En qué línea del folio quedó este paso, o `null` si no llegó al folio (`b4rrhh/backend#103`).
   *
   * **Dos pasos con el mismo número son los que esa línea funde.** Es lo que permite decir por qué
   * un concepto sale dos veces aquí y una sola en el recibo: mismo precio, y el folio los suma.
   *
   * Es `null` exactamente cuando `payslipOrderCode` lo es, salvo en los recibos calculados antes
   * del `backend#103`, que se quedan sin él hasta que se recalculen.
   */
  payslipLineNumber: number | null;
  /**
   * La tabla de la que este paso leyó su valor, o `null` si no lo leyó de ninguna
   * (`b4rrhh/backend#107`).
   *
   * El nulo es el caso normal y significa algo: de los 38 pasos de un recibo leen una fila dos —el
   * precio del día y el de la hora extra—. Un paso sin fila **no ofrece el salto**: un enlace que a
   * veces no lleva a ninguna parte es peor que no tenerlo.
   */
  sourceTableCode: string | null;
  /**
   * La fila que el motor leyó, tal como la tenía delante al calcular.
   *
   * No se resuelve al leer y por eso no se adivina aquí: la búsqueda es por vigencia y por
   * categoría, así que repetirla contestaría dónde estaría hoy el valor, no de dónde salió. Y puede
   * haber desaparecido desde entonces — de eso se encarga el designer al aterrizar.
   */
  sourceTableRowId: number | null;
}
