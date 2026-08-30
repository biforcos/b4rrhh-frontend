import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output } from '@angular/core';

import { B4IconComponent } from '../icon/b4-icon.component';

/**
 * El contenedor de una sección `SLOT` (ADR-010, ADR-016, ADR-051): una lista corta de huecos con
 * clave y valor —los contactos, los identificadores— que se añaden, se corrigen en el sitio y se
 * borran. Sin eje temporal: no hay vigentes ni cerrados, luego no hay fila que mande.
 *
 * Como el contenedor temporal, no lleva caja: título, regla y filas separadas por un hilo. Dos
 * secciones con el mismo modo se ven iguales; y el estado vacío es contenido de la sección —dice
 * qué falta y cómo añadirlo—, no otra caja dentro (frontend#19, ADR-051 §3).
 *
 * Las filas las proyecta la sección con las clases `slot-section__*`, que son el contrato del
 * contenedor. El recuento y si hay un borrador abierto se los dice la sección: el contenedor no
 * mira dentro de lo que proyecta.
 */
@Component({
  selector: 'app-slot-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [B4IconComponent],
  templateUrl: './slot-section.component.html',
  styleUrl: './slot-section.component.scss',
  // Sin encapsulación a propósito (ver el contenedor temporal): las secciones proyectan sus
  // filas y formularios con las clases del contenedor.
  encapsulation: ViewEncapsulation.None,
  host: {
    '[attr.id]': 'anchorId()',
  },
})
export class SlotSectionComponent {
  readonly title = input.required<string>();
  /** Cuántos huecos hay rellenos: el recuento de la cabecera y el vacío salen de aquí. */
  readonly count = input(0);
  /** Hay un borrador abierto: el vacío se calla mientras se rellena el primero. */
  readonly drafting = input(false);
  /** La acción de añadir; `null` cuando la sección no la ofrece. */
  readonly addLabel = input<string | null>('+ Añadir');
  readonly addDisabled = input(false);
  readonly emptyMessage = input('Sin datos');
  /** Id del elemento anfitrión, para las anclas del índice (`employee-section-…`). */
  readonly anchorId = input<string | null>(null);

  readonly addClicked = output<void>();

  protected readonly showEmpty = computed(() => this.count() === 0 && !this.drafting());
}
