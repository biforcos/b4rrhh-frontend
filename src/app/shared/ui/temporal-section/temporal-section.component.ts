import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  TemplateRef,
  ViewEncapsulation,
  computed,
  input,
  output,
} from '@angular/core';

import { formatDisplayDate } from '../../utils/local-date.util';
import { UiButtonComponent } from '../button/ui-button.component';
import { SectionHeadingComponent } from '../section-heading/section-heading.component';
import { TemporalSectionRow } from './temporal-section-row.model';

/**
 * El contenedor de una sección `TEMPORAL_APPEND_CLOSE` (ADR-010, ADR-016, ADR-051): una lista
 * de vigencias que se añaden por el final y se cierran, nunca se editan por dentro.
 *
 * Dos secciones con el mismo modo se ven iguales. La jerarquía no viene del modo —todas las
 * secciones temporales lo comparten— sino de dentro (frontend#25, nota al ADR-051): **lo vigente
 * manda sobre lo cerrado**. La fila en vigor es la única en tinta plena; las cerradas, apagadas.
 * La historia no se pliega: con el estado de hoy arriba ya es secundaria por posición, y
 * esconderla añadiría un clic a algo que se abre a menudo.
 *
 * Lo único que distingue a la presencia es la marca de que **gobierna** sobre las demás
 * (ADR-047). No hay marca de «temporal»: si todas la llevaran, no distinguiría ninguna.
 *
 * El rótulo no es suyo: lo pone `app-section-heading`, porque la jerarquía de títulos es de la
 * ficha y no de este contenedor (frontend#51).
 *
 * Las fechas van en formato local. Lo que va en cada columna lo decide la sección con
 * `columnHeaders` y `cellContent`; la regla ADR-051 §4 —el código nunca va solo— la cumple la
 * sección pintando cada valor de catálogo con `app-ui-catalog-label`. Queda
 * `.temporal-section__code` para una segunda línea que no es un código (las horas al día de la
 * jornada).
 */
@Component({
  selector: 'app-temporal-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, UiButtonComponent, SectionHeadingComponent],
  templateUrl: './temporal-section.component.html',
  styleUrl: './temporal-section.component.scss',
  // Sin encapsulación a propósito: las secciones proyectan sus propias celdas y cabeceras con
  // las clases `temporal-section__*`, que son el contrato del contenedor. Con encapsulación
  // emulada esas clases no recibirían los estilos, y cada sección volvería a inventarse los suyos.
  encapsulation: ViewEncapsulation.None,
  host: {
    '[attr.id]': 'anchorId()',
  },
})
export class TemporalSectionComponent<T extends TemporalSectionRow = TemporalSectionRow> {
  readonly rows = input<ReadonlyArray<T>>([]);
  readonly title = input.required<string>();
  /** La acción de añadir por el final; `null` cuando la sección no la ofrece (la presencia: la abren los flujos). */
  readonly addLabel = input<string | null>('Nuevo período');
  readonly emptyMessage = input('Sin períodos registrados');
  /** La sección que gobierna sobre las demás: se marca. */
  readonly governs = input(false);
  /**
   * La sección no se apila con otras porque va dentro de su propia caja (la de IRPF, en el área de
   * nómina): el filete y el aire de separación los pone la caja. Se declara aquí y no se parchea
   * desde la feature (ADR-051).
   */
  readonly boxed = input(false);
  /** Id del elemento anfitrión, para las anclas del índice (`employee-section-…`). */
  readonly anchorId = input<string | null>(null);

  readonly addClicked = output<void>();
  readonly editClicked = output<number>();
  readonly deleteClicked = output<number>();
  readonly closeClicked = output<number>();

  @ContentChild('columnHeaders') readonly columnHeadersTemplate: TemplateRef<unknown> | null = null;
  @ContentChild('cellContent') readonly cellContentTemplate: TemplateRef<{
    $implicit: T;
    index: number;
  }> | null = null;

  protected readonly count = computed(() => this.rows().length);
  protected readonly activeCount = computed(() => this.rows().filter((row) => row.isActive).length);

  /** «01/01/2024 —», la primera mitad del período. */
  protected periodStart(row: T): string {
    return `${formatDisplayDate(row.startDate)} —`;
  }

  /** «31/12/2024» o «en vigor», la segunda. */
  protected periodEnd(row: T): string {
    return row.endDate ? formatDisplayDate(row.endDate) : 'en vigor';
  }

  /**
   * Los verbos de la fila, los de las ausencias (`b4rrhh/frontend#84`, `b4rrhh/frontend#91`), con la
   * fecha en la etiqueta accesible para que dos filas no se lean igual.
   *
   * «Cerrar» sólo sale en la fila que lo declara (`canClose`): la mayoría de las series que usan
   * este contenedor exigen que la presencia quede cubierta (ADR-057), y ahí cerrar la vigente sin
   * nada detrás se rechaza siempre. Lo que termina una vigencia de ésas es **añadir la siguiente**,
   * que la cierra; el plan lo enseña antes de confirmar. En una de cobertura opcional (centro de
   * coste) cerrar es legal, y ahí se ofrece. Y el inicio se corrige, a diferencia de en las ausencias, porque
   * aquí la clave es el número de la ocurrencia y no la fecha en que empieza.
   */
  protected readonly closeVerb = 'Cerrar';
  protected readonly correctVerb = 'Corregir';
  protected readonly deleteVerb = 'Borrar';

  protected closeLabel(row: T): string {
    return `${this.closeVerb} el período del ${formatDisplayDate(row.startDate)}`;
  }

  protected correctLabel(row: T): string {
    return `${this.correctVerb} el período del ${formatDisplayDate(row.startDate)}`;
  }

  protected deleteLabel(row: T): string {
    return `${this.deleteVerb} el período del ${formatDisplayDate(row.startDate)}`;
  }

  protected showEdit(row: T): boolean {
    return row.canEdit !== false;
  }

  protected showClose(row: T): boolean {
    return row.canClose === true;
  }

  protected showDelete(row: T): boolean {
    return row.canDelete === true;
  }
}
