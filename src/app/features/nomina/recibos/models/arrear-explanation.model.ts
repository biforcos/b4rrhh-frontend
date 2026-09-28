/**
 * De dónde sale una línea de atraso (`backend#134`, `b4rrhh/frontend#93`): tres números.
 *
 * <p>Una línea de atraso no viene de ningún paso de este cálculo —su `mergedStepCount` es cero—, así
 * que no se explica con el grafo sino con esto: el mes de origen vale hoy X, por él ya se había
 * pagado Y, y la línea es X menos Y.
 */
export interface ArrearExplanationModel {
  readonly originPeriodCode: string;
  readonly conceptCode: string;
  readonly conceptLabel: string;
  /** Lo que la línea dice. Es el documento, y es lo que manda. */
  readonly lineAmount: number;
  /** La X: lo que ese mes vale hoy para ese concepto. */
  readonly currentValue: number;
  readonly currentValueCalculatedAt: string | null;
  /** La Y: lo pagado por ese mes antes de este recibo. */
  readonly alreadyPaid: number;
  /** El desglose de la Y: un renglón por recibo que pagó algo. */
  readonly paidIn: ReadonlyArray<{ readonly payrollPeriodCode: string; readonly amount: number }>;
  readonly difference: number;
  /** Si X − Y cuadra con la línea. Puede no cuadrar, y entonces se dice. */
  readonly addsUp: boolean;
}
