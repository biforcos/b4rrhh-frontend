import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
  output,
} from '@angular/core';

import { B4IconComponent } from '../icon/b4-icon.component';

/**
 * El rótulo de una sección de la ficha: el filete que la separa de la anterior, el título, el dato
 * que la resume a su lado y la acción de añadir a la derecha.
 *
 * Existe porque la jerarquía visual es una propiedad de la **ficha**, no del contenedor que la
 * implementa (frontend#51). Una serie temporal y una colección atemporal se gobiernan distinto,
 * pero quien lee la ficha ve dos rótulos hermanos: si «Direcciones» sale a un tamaño y «Contactos»
 * a otro, eso anuncia un nivel de información que no existe. El tratamiento vive aquí y sólo aquí;
 * los contenedores lo usan, no lo copian.
 *
 * No unifica los componentes: `app-temporal-section` y `app-slot-section` siguen siendo dos cosas
 * con dos comportamientos, y la línea de vida no es ninguna de las dos. Esto es sólo la cabecera.
 */
@Component({
  selector: 'app-section-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [B4IconComponent],
  templateUrl: './section-heading.component.html',
  styleUrl: './section-heading.component.scss',
  // Sin encapsulación a propósito (como los dos contenedores): la sección proyecta su dato
  // secundario con la clase `section-heading__meta`, que es el contrato del rótulo. Con
  // encapsulación emulada esa clase no recibiría los estilos y cada sección volvería a inventarse
  // los suyos, que es justo lo que este componente viene a impedir.
  encapsulation: ViewEncapsulation.None,
})
export class SectionHeadingComponent {
  readonly title = input.required<string>();
  /** Id del título, para el `aria-labelledby` de la sección que lo lleva. */
  readonly titleId = input<string | null>(null);
  /** La sección que gobierna sobre las demás: su filete lleva el acento (ADR-051 §1). */
  readonly governs = input(false);
  /**
   * La sección trae su propia caja —la línea de vida, «Hoy»—: el filete y el aire de separación
   * los pone la caja, y el rótulo se queda sólo con el título. Lo que no depende de la caja es la
   * jerarquía: el título es el mismo.
   */
  readonly boxed = input(false);
  /** La acción de añadir; `null` cuando la sección no la ofrece. */
  readonly addLabel = input<string | null>(null);
  readonly addDisabled = input(false);

  readonly addClicked = output<void>();
}
