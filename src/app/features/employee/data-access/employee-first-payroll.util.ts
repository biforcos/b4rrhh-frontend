import {
  PayrollPeriod,
  formatPayrollPeriodMonthName,
  movePayrollPeriod,
  payrollPeriodOfDate,
  rangeTouchesPayrollPeriod,
} from '../../../shared/utils/payroll-period.util';

/**
 * Si el empleado tiene nómina en el período abierto (`b4rrhh/frontend#136`).
 *
 * <p>La sesión de `workspace#18` dio de alta a alguien el 01/10 con septiembre abierto, y «Calcular
 * nómina» calculaba septiembre y fallaba. Quien empieza después del período abierto no tiene nómina
 * que calcular hoy: se dice, y el botón no se ofrece.
 *
 * - `covered`: tiene algún día de alta en el período abierto.
 * - `later`: no, pero su presencia empieza después; `first` es su primer mes.
 * - `none`: no, y no tiene ninguna presencia después (cesado antes, o sin presencias).
 */
export type FirstPayroll =
  | { kind: 'covered' }
  | { kind: 'later'; first: PayrollPeriod }
  | { kind: 'none' };

export function firstPayrollOf(
  presences: ReadonlyArray<{ startDate: string; endDate: string | null }>,
  open: PayrollPeriod,
): FirstPayroll {
  if (presences.some((p) => rangeTouchesPayrollPeriod(p.startDate, p.endDate, open))) {
    return { kind: 'covered' };
  }
  const later = presences
    .map((p) => payrollPeriodOfDate(p.startDate))
    .filter((period) => period > open)
    .sort((a, b) => a - b);
  return later.length > 0 ? { kind: 'later', first: later[0] } : { kind: 'none' };
}

/** La frase que va en lugar del botón cuando no hay nómina que calcular en el período abierto. */
export function firstPayrollMessage(first: FirstPayroll, open: PayrollPeriod): string | null {
  const openName = formatPayrollPeriodMonthName(open);
  switch (first.kind) {
    case 'covered':
      return null;
    case 'later': {
      const firstName = formatPayrollPeriodMonthName(first.first);
      return first.first === movePayrollPeriod(open, 1)
        ? `Su primera nómina es la de ${firstName}, que se abre al cerrar ${openName}.`
        : `Su primera nómina es la de ${firstName} de ${Math.floor(first.first / 100)}, que todavía no está abierta: ahora está abierto ${openName}.`;
    }
    case 'none':
      return `No está de alta ningún día de ${openName}, que es el mes abierto: no hay nómina que calcular.`;
  }
}

/**
 * Lo mismo para un mes elegido en Operaciones, que no tiene por qué ser el abierto: el empleado no
 * está de alta ese mes, y se dice antes de lanzar, no con el error después.
 */
export function noPayrollInPeriodMessage(
  employeeNumber: string,
  first: FirstPayroll,
  period: PayrollPeriod,
): string | null {
  if (first.kind === 'covered') return null;
  const head = `${employeeNumber} no está de alta ningún día de ${formatPayrollPeriodMonthName(period)} de ${Math.floor(period / 100)}`;
  return first.kind === 'later'
    ? `${head}: su primera nómina es la de ${formatPayrollPeriodMonthName(first.first)} de ${Math.floor(first.first / 100)}.`
    : `${head}: no hay nómina que calcular.`;
}

/** El aviso de un mes posterior al abierto: se puede cargar por adelantado, pero se dice. */
export function notOpenYetMessage(period: PayrollPeriod, open: PayrollPeriod): string | null {
  if (period <= open) return null;
  const name = formatPayrollPeriodMonthName(period);
  return `${name[0].toUpperCase()}${name.slice(1)} no está abierto todavía; lo que metas aquí se paga cuando se abra.`;
}
