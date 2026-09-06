import { TimelineConflict, TimelinePeriod } from './timeline-plan-message.util';

/**
 * Lo que se lee de un error del backend para contarlo con fechas (ADR-057): el código funcional
 * y, cuando el rechazo es de invariante, las fechas que nombra en `details`.
 *
 * La forma del `details` es la misma en todas las verticales de tipo A —`overlaps`, `gaps`,
 * `stretchCandidates`, `correctedOccurrence`—, así que la lectura se escribe una vez. Lo que
 * cambia entre verticales son los códigos, y eso lo pone cada una en su mapa de errores.
 */

export function readFunctionalErrorCode(error: unknown): string | null {
  if (!isRecord(error)) {
    return null;
  }

  if (typeof error['code'] === 'string') {
    return error['code'];
  }

  if (isRecord(error['error']) && typeof error['error']['code'] === 'string') {
    return error['error']['code'];
  }

  return null;
}

/** Las fechas del rechazo, vacías cuando el error no las trae. */
export function readTimelineConflict(error: unknown): TimelineConflict {
  const details = extractDetails(error);

  return {
    overlaps: readPeriods(details?.['overlaps']),
    gaps: readPeriods(details?.['gaps']),
    stretchCandidates: readPeriods(details?.['stretchCandidates']),
    correctedOccurrence: readPeriod(details?.['correctedOccurrence']),
  };
}

function extractDetails(error: unknown): Record<string, unknown> | null {
  if (!isRecord(error)) {
    return null;
  }

  if (isRecord(error['details'])) {
    return error['details'];
  }

  if (isRecord(error['error']) && isRecord(error['error']['details'])) {
    return error['error']['details'];
  }

  return null;
}

function readPeriods(value: unknown): ReadonlyArray<TimelinePeriod> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPeriod).map(toPeriod);
}

function readPeriod(value: unknown): TimelinePeriod | null {
  return isPeriod(value) ? toPeriod(value) : null;
}

function toPeriod(source: Record<string, unknown> & { startDate: string }): TimelinePeriod {
  return {
    startDate: source['startDate'],
    endDate: typeof source['endDate'] === 'string' ? source['endDate'] : null,
  };
}

function isPeriod(value: unknown): value is Record<string, unknown> & { startDate: string } {
  return isRecord(value) && typeof value['startDate'] === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
