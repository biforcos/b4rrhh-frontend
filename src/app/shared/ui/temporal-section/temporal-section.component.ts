import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  TemplateRef,
  computed,
  input,
  output,
} from '@angular/core';

import { formatDisplayDate } from '../../utils/local-date.util';
import { B4IconComponent } from '../icon/b4-icon.component';
import { TemporalSectionRow } from './temporal-section-row.model';

/**
 * El contenedor de una sección `TEMPORAL_APPEND_CLOSE` (ADR-010, ADR-016, ADR-051): una lista
 * de vigencias que se añaden por el final y se cierran, nunca se editan por dentro.
 *
 * Dos secciones con el mismo modo se ven iguales: al verla ya se sabe qué se puede hacer con
 * ella. Lo único que distingue a la presencia es la marca de que **gobierna** sobre las demás
 * (ADR-047: el cese la cierra la primera porque el resto valida su cobertura contra ella).
 *
 * Las fechas van en formato local (`formatDisplayDate`). Lo que va en cada columna lo decide
 * la sección con `columnHeaders` y `cellContent`; la regla ADR-051 §4 —el código nunca va solo—
 * la cumple la sección con `.temporal-section__code` para el código junto al literal.
 */
@Component({
  selector: 'app-temporal-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, B4IconComponent],
  templateUrl: './temporal-section.component.html',
  styleUrl: './temporal-section.component.scss',
  host: {
    '[attr.id]': 'anchorId()',
    '[class.temporal-section-host--governs]': 'governs()',
  },
})
export class TemporalSectionComponent<T extends TemporalSectionRow = TemporalSectionRow> {
  readonly rows = input<ReadonlyArray<T>>([]);
  readonly title = input.required<string>();
  /** La acción de añadir por el final; `null` cuando la sección no la ofrece (la presencia: la abren los flujos). */
  readonly addLabel = input<string | null>('+ Nuevo período');
  readonly emptyMessage = input('Sin períodos registrados');
  /** La sección que gobierna sobre las demás: se marca. */
  readonly governs = input(false);
  /** Id del elemento anfitrión, para las anclas del índice (`employee-section-…`). */
  readonly anchorId = input<string | null>(null);

  readonly addClicked = output<void>();
  readonly editClicked = output<number>();
  readonly deleteClicked = output<number>();

  @ContentChild('columnHeaders') readonly columnHeadersTemplate: TemplateRef<unknown> | null = null;
  @ContentChild('cellContent') readonly cellContentTemplate: TemplateRef<{
    $implicit: T;
    index: number;
  }> | null = null;

  protected readonly count = computed(() => this.rows().length);
  protected readonly activeCount = computed(() => this.rows().filter((row) => row.isActive).length);

  protected formatPeriod(row: T): string {
    const start = formatDisplayDate(row.startDate);
    return row.endDate ? `${start} — ${formatDisplayDate(row.endDate)}` : `${start} — en vigor`;
  }

  protected editLabel(row: T): string {
    return `Editar ${formatDisplayDate(row.startDate)}`;
  }

  protected deleteLabel(row: T): string {
    return `Eliminar ${formatDisplayDate(row.startDate)}`;
  }

  protected showEdit(row: T): boolean {
    return row.canEdit !== false;
  }

  protected showDelete(row: T): boolean {
    return !row.isActive && row.canDelete === true;
  }
}
