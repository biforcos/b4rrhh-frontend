import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';

/** Cómo se pinta el aviso: información neutra, una consecuencia que conviene ver, o un rechazo. */
export type PeriodModalNoteTone = 'info' | 'warning' | 'error';

@Component({
  selector: 'app-period-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule],
  templateUrl: './period-modal.component.html',
  styleUrl: './period-modal.component.scss',
})
export class PeriodModalComponent {
  readonly title = input('');
  readonly subtitle = input<string | null>(null);
  readonly visible = input(false);
  readonly saving = input(false);
  readonly submitEnabled = input(true);
  readonly submitLabel = input('Guardar cambios');
  readonly showCloseAction = input(false);
  readonly closeActionLabel = input('Cerrar período');
  /**
   * Un aviso bajo el formulario: una frase, o varias líneas cuando hay más de una cosa que
   * contar (el plan de un cambio: qué se cierra y qué hueco aparece).
   */
  readonly note = input<string | ReadonlyArray<string> | null>(null);
  readonly noteTone = input<PeriodModalNoteTone>('warning');

  readonly visibleChange = output<boolean>();
  readonly submitted = output<void>();
  readonly cancelled = output<void>();
  readonly closeActionClicked = output<void>();

  protected readonly noteLines = computed<ReadonlyArray<string>>(() => {
    const note = this.note();
    if (note === null) return [];
    return typeof note === 'string' ? [note] : note;
  });

  onSubmit(): void {
    if (!this.saving() && this.submitEnabled()) this.submitted.emit();
  }

  private _cancelInFlight = false;

  onCancel(): void {
    this._cancelInFlight = true;
    this.cancelled.emit();
    this.visibleChange.emit(false);
  }

  onHide(): void {
    if (!this._cancelInFlight) {
      this.cancelled.emit();
    }
    this._cancelInFlight = false;
  }
  onCloseAction(): void {
    this.closeActionClicked.emit();
  }
}
