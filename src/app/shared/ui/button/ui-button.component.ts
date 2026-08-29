import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { B4IconComponent } from '../icon/b4-icon.component';
import { B4IconName } from '../icon/icon-names';

type UiButtonType = 'button' | 'submit' | 'reset';
type UiButtonSeverity =
  | 'success'
  | 'info'
  | 'warn'
  | 'danger'
  | 'help'
  | 'primary'
  | 'secondary'
  | 'contrast'
  | undefined
  | null;
type UiButtonSize = 'small' | 'large' | undefined;

@Component({
  selector: 'app-ui-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, B4IconComponent],
  templateUrl: './ui-button.component.html',
  styleUrl: './ui-button.component.scss',
  host: {
    '[class.app-ui-button--fluid]': 'fluid()',
  },
})
export class UiButtonComponent {
  readonly label = input.required<string>();
  readonly type = input<UiButtonType>('button');
  readonly severity = input<UiButtonSeverity>(undefined);
  readonly size = input<UiButtonSize>(undefined);
  readonly outlined = input(false);
  readonly text = input(false);
  readonly rounded = input(false);
  /** Icono del set propio (`docs/identidad-visual.md`); a la izquierda de la etiqueta. */
  readonly icon = input<B4IconName | undefined>(undefined);
  readonly disabled = input(false);
  readonly fluid = input(false);
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly title = input<string | undefined>(undefined);
  readonly pressed = output<MouseEvent>();

  protected emitPressed(event: MouseEvent): void {
    this.pressed.emit(event);
  }
}
