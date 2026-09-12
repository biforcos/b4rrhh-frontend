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
  totalSkippedNotEligible: number;
  totalSkippedAlreadyClaimed: number;
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
    run.totalNotValid +
    run.totalErrors
  );
}

/** Cuanto duro la ejecucion, en milisegundos; null mientras no haya terminado. */
export function runDurationMs(run: CalculationRun): number | null {
  if (run.startedAt === null || run.finishedAt === null) return null;
  const elapsed = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  return Number.isNaN(elapsed) ? null : elapsed;
}
