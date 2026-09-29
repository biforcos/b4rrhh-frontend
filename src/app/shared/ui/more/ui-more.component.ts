import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

let siguiente = 0;

/**
 * El «?» de la aplicación (`b4rrhh/frontend#108`): la explicación de más, detrás de un botón que la
 * despliega a petición, debajo y en la misma pieza que la línea que la necesita.
 *
 * Es el único sitio donde se esconde texto. No es un tooltip ni un `title`: lo que hay que
 * descubrir pasando el ratón no está escrito para quien usa la pantalla (`frontend#85`), y con el
 * teclado o un lector se abre igual. Se usa dentro de la línea visible:
 *
 * ```html
 * <p>Una línea que se lee. <app-ui-more>El porqué, para quien lo quiera.</app-ui-more></p>
 * ```
 */
@Component({
  selector: 'app-ui-more',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="ui-more__toggle"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="bodyId"
      [attr.aria-label]="open() ? 'Ocultar la explicación' : 'Ver la explicación'"
      (click)="open.set(!open())"
    >
      ?
    </button>
    <span class="ui-more__body" [id]="bodyId" [hidden]="!open()"><ng-content /></span>
  `,
  styleUrl: './ui-more.component.scss',
})
export class UiMoreComponent {
  protected readonly open = signal(false);
  protected readonly bodyId = `ui-more-${++siguiente}`;
}
