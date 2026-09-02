/**
 * Orden de las tablas de períodos de la ficha del empleado (frontend#37).
 *
 * La regla no es «por fecha»: es «lo que importa ahora, arriba». Las tablas de períodos
 * ordenan lo vigente primero y, dentro de cada grupo, por fecha de inicio descendente.
 *
 * Vive aquí una sola vez. Antes estaba copiada en tres gateways y el cuarto (presencia)
 * nunca recibió la copia, así que la ficha enseñaba una tabla al revés que las otras. Los
 * gateways de período la usan, no la copian: hay un spec que recorre los gateways de la
 * ficha y se queja del que ordene por su cuenta.
 */
export interface TimelinePeriod {
  readonly startDate: string;
  readonly isActive: boolean;
}

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
): number {
  if (left.isActive !== right.isActive) {
    return left.isActive ? -1 : 1;
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
): ReadonlyArray<T> {
  return [...periods].sort((left, right) => compareByTimelineRecency(left, right, tieBreaker));
}
