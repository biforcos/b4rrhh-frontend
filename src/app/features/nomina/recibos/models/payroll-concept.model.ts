export interface PayrollConceptModel {
  lineNumber: number;
  conceptCode: string;
  conceptLabel: string;
  amount: number | null;
  quantity: number | null;
  rate: number | null;
  conceptNatureCode: string;
  originPeriodCode: string | null;
  displayOrder: number;
  /**
   * De cuántos pasos del motor viene esta línea (`b4rrhh/backend#103`).
   *
   * Uno casi siempre. **Más de uno cuando el folio ha fundido varios tramos** del mismo concepto al
   * mismo precio, que pueden no ser contiguos: la línea es correcta y cuenta una historia falsa si
   * nada dice que es una suma.
   *
   * Una marca que saliera con `1` no marcaría nada, así que sólo se pinta cuando pasa de uno.
   */
  mergedStepCount: number;
}
