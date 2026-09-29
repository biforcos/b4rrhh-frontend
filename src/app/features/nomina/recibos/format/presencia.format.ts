import { PayrollSummaryModel } from '../models/payroll-summary.model';

/**
 * La presencia de un recibo, dicha sólo cuando distingue algo (`b4rrhh/frontend#104`).
 *
 * «presencia 1» en cada fila de la lista no separaba ninguna fila de otra. Se dice cuando es mayor
 * que 1, o cuando entre los recibos que hay a la vista está otro del mismo empleado, período y tipo
 * —cesado y readmitido en el mismo mes—, y entonces en los dos. Como marca («2.ª presencia»), no
 * como texto corrido. La lista y la cabecera del detalle la dicen igual porque salen de aquí.
 */
export function marcaDePresencia(
  recibo: PayrollSummaryModel,
  aLaVista: ReadonlyArray<PayrollSummaryModel>,
): string | null {
  const tieneHermana = aLaVista.some(
    (otro) =>
      otro !== recibo &&
      otro.ruleSystemCode === recibo.ruleSystemCode &&
      otro.employeeTypeCode === recibo.employeeTypeCode &&
      otro.employeeNumber === recibo.employeeNumber &&
      otro.payrollPeriodCode === recibo.payrollPeriodCode &&
      otro.payrollTypeCode === recibo.payrollTypeCode &&
      otro.presenceNumber !== recibo.presenceNumber,
  );
  return recibo.presenceNumber > 1 || tieneHermana ? `${recibo.presenceNumber}.ª presencia` : null;
}
