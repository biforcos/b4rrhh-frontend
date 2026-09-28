import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { formatDisplayDate } from '../../../../shared/utils/local-date.util';
import { PeriodModalNoteTone } from '../ui/period-modal/period-modal.component';

/**
 * Añadir una vigencia igual a la que está en vigor (`b4rrhh/frontend#94`).
 *
 * No es un error: renovar una vigencia sin cambiar el valor puede tener motivo, y el motor lo
 * respeta —dos tramos—. Pero parte el mes sin cambiar el cálculo, y quien lo hace sin querer no se
 * entera hasta ver «2 tramos» en el folio. Así que no se prohíbe: se avisa en el propio modal,
 * antes de guardar, y se deja guardar.
 *
 * La fila con la que se compara es **la que está en vigor el día en que empezaría la nueva**, no la
 * última: una jornada nueva en septiembre de 2025 se compara con la que regía entonces. Y si la nueva
 * empieza el mismo día que otra, no se avisa: eso es su corrección, y ya lo dice el backend
 * (`backend#58`) con la salida a un clic.
 *
 * @param template el aviso de la sección, con `{desde}` donde va la fecha de la vigente.
 * @returns el aviso, o `null` si la nueva no es igual a la que está en vigor ese día.
 */
export function sameAsInForceNotice<T extends TemporalSectionRow>(
  rows: ReadonlyArray<T>,
  startDate: string,
  isSame: (row: T) => boolean,
  template: string,
): string | null {
  if (!startDate) return null;
  const inForce = rows.find(
    (row) => row.startDate < startDate && (row.endDate === null || row.endDate >= startDate),
  );
  if (!inForce || !isSame(inForce)) return null;
  return template.replace('{desde}', formatDisplayDate(inForce.startDate));
}

export interface ModalNote {
  tone: PeriodModalNoteTone;
  lines: ReadonlyArray<string>;
}

/**
 * El aviso delante de lo que diga el plan, y en tono de advertencia. Un plan rechazado manda solo:
 * lo que hay que arreglar primero es lo que impide guardar, no lo que se guardaría de más.
 */
export function withSameAsInForce(plan: ModalNote | null, notice: string | null): ModalNote {
  if (plan?.tone === 'error') return plan;
  if (notice === null) return plan ?? { tone: 'info', lines: [] };
  return { tone: 'warning', lines: [notice, ...(plan?.lines ?? [])] };
}
