import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Un valor de catálogo: el literal y, debajo, su código en gris y monoespaciada (ADR-051 §4).
 * `420` se lee «Sustitución en proceso de selección» con el `420` debajo: quien conoce el
 * catálogo sigue leyendo el número; quien no, entiende la fila.
 *
 * Sin literal —el catálogo no lo tiene o no llegó— el código va solo y no se inventa nada: no
 * hay línea gris porque no habría nada que distinguir de la de arriba.
 *
 * Es el mismo patrón en todas las filas de la ficha, así que vive aquí y no en cada sección
 * (ADR-051 §2, frontend#35). Lo que no decide: de dónde sale el literal. Eso es del backend
 * (`Accept-Language`, ADR-052) o de la feature.
 */
@Component({
  selector: 'app-ui-catalog-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ui-catalog-label__name">{{ shownName() }}</span>
    @if (shownCode(); as code) {
      <!-- El espacio no se ve (el código va en bloque) pero separa las dos partes al copiar o al leer en voz. -->
      &ngsp;<span class="ui-catalog-label__code">{{ code }}</span>
    }
  `,
  styleUrl: './ui-catalog-label.component.scss',
})
export class UiCatalogLabelComponent {
  /** El literal del catálogo; vacío o nulo cuando no hay. */
  readonly name = input<string | null | undefined>(null);
  readonly code = input.required<string>();

  private readonly trimmedName = computed(() => this.name()?.trim() || null);

  protected readonly shownName = computed(() => this.trimmedName() ?? this.code());
  protected readonly shownCode = computed(() => (this.trimmedName() ? this.code() : null));
}
