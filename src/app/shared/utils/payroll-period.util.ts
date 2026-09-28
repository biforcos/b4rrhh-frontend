/**
 * El período de nómina como número `yyyyMM` (`202608`), que es como lo usan el motor y la API.
 *
 * Vive aquí desde `b4rrhh/frontend#90`, cuando tres secciones de la ficha pasaron a compartir un
 * navegador de período: antes las cuentas estaban copiadas dentro de «Entradas de nómina», y la
 * pantalla de operaciones tiene otra copia que no se ha tocado.
 */
export type PayrollPeriod = number;

const MONTH_SHORT_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

/** El mes del calendario de hoy. */
export function currentPayrollPeriod(today: Date = new Date()): PayrollPeriod {
  return today.getFullYear() * 100 + today.getMonth() + 1;
}

/** `202608` como `Ago 2026`, que es como lo pinta el navegador. */
export function formatPayrollPeriodLabel(period: PayrollPeriod): string {
  const month = period % 100;
  const year = Math.floor(period / 100);
  return `${MONTH_SHORT_NAMES[month - 1]} ${year}`;
}

/** `202608` como `08/2026`, que es como se lee en el recibo. */
export function formatPayrollPeriodCode(period: PayrollPeriod): string {
  const month = String(period % 100).padStart(2, '0');
  return `${month}/${Math.floor(period / 100)}`;
}

export function movePayrollPeriod(period: PayrollPeriod, delta: 1 | -1): PayrollPeriod {
  const month = period % 100;
  const year = Math.floor(period / 100);
  if (delta === -1) {
    return month === 1 ? (year - 1) * 100 + 12 : period - 1;
  }
  return month === 12 ? (year + 1) * 100 + 1 : period + 1;
}

/** El mes de una fecha `yyyy-MM-dd`. */
export function payrollPeriodOfDate(isoDate: string): PayrollPeriod {
  return Number(isoDate.slice(0, 4)) * 100 + Number(isoDate.slice(5, 7));
}

/**
 * Si un tramo `[start, end]` toca el mes. Un fin `null` es un tramo abierto, que toca todos los
 * meses desde el de su inicio.
 */
export function rangeTouchesPayrollPeriod(
  start: string,
  end: string | null,
  period: PayrollPeriod,
): boolean {
  return (
    payrollPeriodOfDate(start) <= period && (end === null || payrollPeriodOfDate(end) >= period)
  );
}
