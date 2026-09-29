export type CalculationRunStatus =
  | 'REQUESTED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED';

export interface CalculationRun {
  runId: number;
  status: CalculationRunStatus;
  ruleSystemCode: string;
  payrollPeriodCode: string;
  payrollTypeCode: string;
  calculationEngineCode: string;
  calculationEngineVersion: string;
  totalCandidates: number;
  totalEligible: number;
  totalClaimed: number;
  /**
   * Saltadas porque ya tenían recibo. Esperable al relanzar y **no pide nada de nadie**.
   *
   * Hasta `b4rrhh/backend#85` este contador sumaba además las que no se pudieron calcular por
   * falta de datos, que es la lectura contraria: una es «todo normal, ya estaba hecho» y la otra
   * es «hay datos que faltan, que alguien mire». Ahora ésas van en `totalSkippedMissingInput`.
   */
  totalSkippedNotEligible: number;
  totalSkippedAlreadyClaimed: number;
  /** Eran elegibles y faltaban datos. Siempre pide que alguien mire (`b4rrhh/backend#85`). */
  totalSkippedMissingInput: number;
  totalCalculated: number;
  totalNotValid: number;
  totalErrors: number;
  /**
   * Hasta qué mes atrás se le permitió recalcular (`b4rrhh/backend#132`).
   *
   * Null en las corridas de antes del #132 y en las que no hacen retro. No es un detalle de la
   * petición que ya pasó: es con qué se calculó, y el recibo y la checklist lo leen de aquí.
   */
  retroLimitPeriodCode: string | null;
  /** El suelo para todos con el que corrió, si lo hubo. Null es lo normal. */
  retroFloorPeriodCode: string | null;
  /**
   * El universo de la retro: unidades **empleado × mes** que había que recalcular.
   *
   * Contadas una vez y al principio, igual que `totalCandidates`, así que sirve de denominador. Es
   * una terna aparte y **no se suma a los nueve contadores del recibo**: una unidad de retro no
   * acaba en ninguno de esos cajones porque no escribe recibo, escribe cálculo vigente.
   */
  totalRetroUnits: number;
  /** Vigentes escritos. Su partición es `totalRetroUnits = recalculated + notRecalculated`. */
  totalRetroRecalculated: number;
  /**
   * Meses del tramo que no se pudieron recalcular, cada uno con su mensaje en la corrida.
   *
   * No es un error: el recibo de aquel mes no se ha tocado y el resto del tramo ha seguido.
   */
  totalRetroNotRecalculated: number;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export function isRunFinished(run: CalculationRun): boolean {
  return (
    run.status === 'COMPLETED' || run.status === 'COMPLETED_WITH_ERRORS' || run.status === 'FAILED'
  );
}

/**
 * Aceptada y esperando su turno.
 *
 * El backend sirve las ejecuciones de una en una (ADR-060 §2): si hay otra corriendo, esta se
 * queda en REQUESTED y sin `startedAt` hasta que le toque. No es que esté arrancando: es que no
 * ha arrancado (frontend#62).
 */
export function isRunQueued(run: CalculationRun): boolean {
  return run.status === 'REQUESTED';
}

/**
 * Las unidades que la ejecucion selecciono y se quedaron sin recibo.
 *
 * Se cuenta con los contadores y no con el `status`: «COMPLETED» significa que la ejecucion
 * termino, no que hayan cobrado todos. En la corrida del deploy#3 el estado era COMPLETED con
 * dos unidades saltadas (frontend#61).
 *
 * Las que ya tenian recibo no entran (`b4rrhh/frontend#97`): tienen recibo, el de antes, y no
 * piden nada. Contarlas aqui decia «883 no acabaron en recibo» de un relanzamiento normal.
 */
export function unitsWithoutPayslip(run: CalculationRun): number {
  return (
    run.totalSkippedAlreadyClaimed +
    run.totalSkippedMissingInput +
    run.totalNotValid +
    run.totalErrors
  );
}

/**
 * Las unidades que la ejecucion ya ha resuelto, de una manera o de otra.
 *
 * Cuando termina, esto iguala a `totalCandidates`: cada candidata acaba calculada, no válida, con
 * error o saltada por alguna de las TRES razones. Son tres desde `b4rrhh/backend#85`, y este
 * sumando tiene que llevarlas todas: si se queda una fuera, la barra de progreso nunca llega al
 * final y el recuento de las que no cobraron miente por debajo.
 */
export function runProcessedUnits(run: CalculationRun): number {
  // La que ya tenia recibo esta resuelta aunque no se cuente como sin recibo (frontend#97).
  return run.totalCalculated + run.totalSkippedNotEligible + unitsWithoutPayslip(run);
}

/** Si esta corrida recalculó pasado, y por tanto hay una terna de retro que contar. */
export function runHasRetro(run: CalculationRun): boolean {
  return run.totalRetroUnits > 0;
}

/** Las unidades de retro ya resueltas, escritas o no. Su partición es el total de la retro. */
export function runRetroProcessedUnits(run: CalculationRun): number {
  return run.totalRetroRecalculated + run.totalRetroNotRecalculated;
}

/**
 * El trabajo de verdad de la corrida: recibos **más** vigentes.
 *
 * Los dos universos se suman aqui y en ningun otro sitio. Un lanzamiento con suelo para todos son
 * 873 recibos y siete mil vigentes, y los siete mil son los que cuestan el tiempo: una pantalla que
 * ensenara solo los 873 diria que la corrida va por el uno por ciento cuando lleva media hora.
 */
export function runTotalWorkUnits(run: CalculationRun): number {
  return run.totalCandidates + run.totalRetroUnits;
}

/**
 * Por donde va la ejecucion, en tanto por ciento; null mientras no se sepa cuantas unidades son.
 *
 * El denominador es el trabajo de la corrida —candidatas **mas** unidades de retro—, y son esos dos
 * **porque son los unicos que no se mueven**: los dos se fijan cuando la ejecucion expande sus
 * unidades y no cambian ya. `totalEligible` no sirve —sube unidad por unidad igual que
 * `totalCalculated`, asi que el cociente entre los dos vale casi 1 desde el primer segundo y la barra
 * aparece llena con el trabajo sin empezar (frontend#62).
 *
 * La retro entra en el denominador desde el `b4rrhh/frontend#85`, y en el numerador con ella. Con la
 * barra contando solo los recibos, un lanzamiento con suelo para todos se quedaba en el mismo numero
 * mientras recalculaba siete mil meses, que es exactamente cuando hace falta saber que avanza.
 *
 * Mientras la ejecucion esta en cola los dos totales son cero: todavia no ha mirado a nadie, y
 * entonces no hay porcentaje que dar.
 */
export function runProgressPercent(run: CalculationRun): number | null {
  const total = runTotalWorkUnits(run);
  if (total === 0) return null;
  const done = runProcessedUnits(run) + runRetroProcessedUnits(run);
  return Math.min(100, Math.round((done / total) * 100));
}

/** Cuanto duro la ejecucion, en milisegundos; null mientras no haya terminado. */
export function runDurationMs(run: CalculationRun): number | null {
  if (run.startedAt === null || run.finishedAt === null) return null;
  const elapsed = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  return Number.isNaN(elapsed) ? null : elapsed;
}
