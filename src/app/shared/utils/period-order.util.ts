import { rulesOn } from './in-force.util';
import { currentLocalDate } from './local-date.util';

/**
 * Orden de las tablas de períodos de la ficha del empleado (frontend#37), y la marca de cada
 * período (frontend#110).
 *
 * La regla no es «por fecha»: es «lo que importa ahora, arriba». Primero lo que rige hoy, luego lo
 * previsto, luego lo cerrado; dentro de cada grupo, por fecha de inicio descendente.
 *
 * Vive aquí una sola vez. Antes estaba copiada en tres gateways y el cuarto (presencia)
 * nunca recibió la copia, así que la ficha enseñaba una tabla al revés que las otras. Los
 * gateways de período la usan, no la copian: hay un spec que recorre los gateways de la
 * ficha y se queja del que ordene por su cuenta.
 */
export interface TimelinePeriod {
  readonly startDate: string;
  readonly endDate?: string | null;
}

/**
 * Dónde está un período respecto a hoy (`b4rrhh/frontend#110`). No es si tiene fin: una presencia
 * que empieza el mes que viene no lo tiene y no rige; una con cese mañana lo tiene y rige hoy
 * (`frontend#100`). La marca de las tablas, su recuento «en vigor» y su orden salen de aquí.
 */
export type PeriodStanding = 'IN_FORCE' | 'PLANNED' | 'CLOSED';

export function periodStanding(
  period: TimelinePeriod,
  today: string = currentLocalDate(),
): PeriodStanding {
  if (period.startDate > today) return 'PLANNED';
  return rulesOn(period, today) ? 'IN_FORCE' : 'CLOSED';
}

const STANDING_RANK: Record<PeriodStanding, number> = { IN_FORCE: 0, PLANNED: 1, CLOSED: 2 };

/**
 * Desempate que aporta cada vertical para dos períodos con el mismo estado y la misma
 * fecha de inicio. En una línea temporal sin solapes no debería darse; existe para que el
 * orden sea determinista si los datos vienen mal.
 */
export type PeriodTieBreaker<T> = (left: T, right: T) => number;

export function compareByTimelineRecency<T extends TimelinePeriod>(
  left: T,
  right: T,
  tieBreaker?: PeriodTieBreaker<T>,
  today: string = currentLocalDate(),
): number {
  const standingOrder =
    STANDING_RANK[periodStanding(left, today)] - STANDING_RANK[periodStanding(right, today)];
  if (standingOrder !== 0) {
    return standingOrder;
  }

  const startDateOrder = right.startDate.localeCompare(left.startDate);
  if (startDateOrder !== 0) {
    return startDateOrder;
  }

  return tieBreaker ? tieBreaker(left, right) : 0;
}

/** Copia ordenada con {@link compareByTimelineRecency}; la entrada no se toca. */
export function sortByTimelineRecency<T extends TimelinePeriod>(
  periods: ReadonlyArray<T>,
  tieBreaker?: PeriodTieBreaker<T>,
  today: string = currentLocalDate(),
): ReadonlyArray<T> {
  return [...periods].sort((left, right) =>
    compareByTimelineRecency(left, right, tieBreaker, today),
  );
}
