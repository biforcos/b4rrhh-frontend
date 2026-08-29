import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';

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
  /** Un aviso bajo el formulario (p. ej. que la fecha de inicio anterior se ajustará en cascada). */
  readonly note = input<string | null>(null);

  readonly visibleChange = output<boolean>();
  readonly submitted = output<void>();
  readonly cancelled = output<void>();
  readonly closeActionClicked = output<void>();

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
  onCloseAction(): void { this.closeActionClicked.emit(); }
}
