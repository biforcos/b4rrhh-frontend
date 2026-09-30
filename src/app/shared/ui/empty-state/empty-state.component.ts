import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  // Sin texto de reserva: el que tenia, en ingles, habria salido el dia que alguien lo
  // montase sin pasarle los suyos (b4rrhh/frontend#117). Quien lo monta dice que esta vacio.
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
