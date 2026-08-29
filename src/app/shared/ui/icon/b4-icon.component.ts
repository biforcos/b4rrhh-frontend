import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { B4IconName } from './icon-names';

/** Los tres tamaños de la guía: 16 en línea de texto, 20 en navegación y botones, 24 en cabeceras. */
export type B4IconSize = 16 | 20 | 24;

/**
 * Un icono del set propio, referenciado por `<use>` al sprite inyectado en el documento
 * (`provideIconSprite`). Hereda `currentColor` del contexto: no lleva color propio.
 *
 * Decorativo por defecto (`aria-hidden`). Cuando el icono va solo, sin texto al lado,
 * se le da `label` y pasa a ser una imagen con nombre accesible.
 */
@Component({
  selector: 'b4-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      focusable="false"
    >
      <use [attr.href]="href()" />
    </svg>
  `,
  styles: [
    ':host { display: inline-flex; flex: none; line-height: 0; vertical-align: middle; }',
    'svg { display: block; }',
  ],
})
export class B4IconComponent {
  readonly name = input.required<B4IconName>();
  readonly size = input<B4IconSize>(20);
  readonly label = input<string | null>(null);

  protected readonly href = computed(() => `#b4-${this.name()}`);
}
