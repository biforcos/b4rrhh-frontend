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
 * Las unidades que la ejecucion selecciono y no acabaron en recibo.
 *
 * Se cuenta con los contadores y no con el `status`: «COMPLETED» significa que la ejecucion
 * termino, no que hayan cobrado todos. En la corrida del deploy#3 el estado era COMPLETED con
 * dos unidades saltadas (frontend#61).
 */
export function unitsWithoutPayslip(run: CalculationRun): number {
  return (
    run.totalSkippedNotEligible +
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
  return run.totalCalculated + unitsWithoutPayslip(run);
}

/**
 * Por donde va la ejecucion, en tanto por ciento; null mientras no se sepa cuantas unidades son.
 *
 * El denominador es `totalCandidates` **porque es el unico que no se mueve**: se fija cuando la
 * ejecucion expande las unidades y no cambia ya. `totalEligible` no sirve —sube unidad por unidad
 * igual que `totalCalculated`, asi que el cociente entre los dos vale casi 1 desde el primer
 * segundo y la barra aparece llena con el trabajo sin empezar (frontend#62).
 *
 * Mientras la ejecucion esta en cola, `totalCandidates` es cero: todavia no ha mirado a nadie, y
 * entonces no hay porcentaje que dar.
 */
export function runProgressPercent(run: CalculationRun): number | null {
  if (run.totalCandidates === 0) return null;
  return Math.min(100, Math.round((runProcessedUnits(run) / run.totalCandidates) * 100));
}

/** Cuanto duro la ejecucion, en milisegundos; null mientras no haya terminado. */
export function runDurationMs(run: CalculationRun): number | null {
  if (run.startedAt === null || run.finishedAt === null) return null;
  const elapsed = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  return Number.isNaN(elapsed) ? null : elapsed;
}
