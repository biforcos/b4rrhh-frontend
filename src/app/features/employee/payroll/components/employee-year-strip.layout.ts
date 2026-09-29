import { EmployeeYearAbsence, EmployeeYearPresence } from '../../models/employee-year.model';
import { PayrollPeriod } from '../../../../shared/utils/payroll-period.util';

/**
 * La geometría de la tira del año (`b4rrhh/frontend#109`), en porcentajes del año natural para que
 * la tira se estire con su columna. Una barra va del primer día al último, ambos incluidos; lo que
 * cae fuera del año se pinta hasta el borde y lo dice, sin recortar las fechas de la ausencia.
 */
export interface AbsenceBar {
  readonly absence: EmployeeYearAbsence;
  /** Desde el 1 de enero, en % del año. */
  readonly left: number;
  readonly width: number;
  /** Carril: 0 arriba; una solapada va debajo. */
  readonly lane: number;
  readonly startsBeforeYear: boolean;
  readonly endsAfterYear: boolean;
  /** Sin fin: llega hasta hoy con el borde abierto. */
  readonly open: boolean;
}

const DAY = 86_400_000;

function utc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysInYear(year: number): number {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY;
}

export function layoutAbsenceBars(
  absences: ReadonlyArray<EmployeeYearAbsence>,
  year: number,
  today: string,
): ReadonlyArray<AbsenceBar> {
  const first = Date.UTC(year, 0, 1);
  const last = Date.UTC(year, 11, 31);
  const total = daysInYear(year);
  const laneEnds: number[] = [];

  return [...absences]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((absence) => {
      const start = utc(absence.startDate);
      const end = absence.endDate === null ? Math.max(utc(today), start) : utc(absence.endDate);
      const from = Math.max(start, first);
      const to = Math.max(Math.min(end, last), from);

      let lane = laneEnds.findIndex((laneEnd) => laneEnd < start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;

      return {
        absence,
        left: ((from - first) / DAY / total) * 100,
        width: (((to - from) / DAY + 1) / total) * 100,
        lane,
        startsBeforeYear: start < first,
        endsAfterYear: end > last,
        open: absence.endDate === null,
      };
    });
}

/** El mes al que lleva pulsar la barra: el primero en que se la ve dentro del año. */
export function periodOfBar(bar: AbsenceBar, year: number): PayrollPeriod {
  if (bar.startsBeforeYear) return year * 100 + 1;
  const [, month] = bar.absence.startDate.split('-').map(Number);
  return year * 100 + month;
}

/** Por mes, si alguna presencia lo toca. Los que no, se sombrean: no estaba. */
export function monthsWithPresence(
  presences: ReadonlyArray<EmployeeYearPresence>,
  year: number,
): ReadonlyArray<boolean> {
  return Array.from({ length: 12 }, (_, i) => {
    const monthStart = Date.UTC(year, i, 1);
    const monthEnd = Date.UTC(year, i + 1, 0);
    return presences.some(
      (p) => utc(p.startDate) <= monthEnd && (p.endDate === null || utc(p.endDate) >= monthStart),
    );
  });
}
