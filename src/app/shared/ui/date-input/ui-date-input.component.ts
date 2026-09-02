import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-ui-date-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      type="date"
      [id]="inputId() ?? undefined"
      [value]="value() ?? ''"
      [min]="min() ?? undefined"
      [max]="max() ?? undefined"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [attr.aria-label]="ariaLabel() ?? undefined"
      (input)="onDateInput($event)"
    />
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      input {
        width: 100%;
      }
    `,
  ],
})
export class UiDateInputComponent {
  readonly value = input<string | null>('');
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly inputId = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false);
  readonly readonly = input(false);

  readonly valueChanged = output<string>();

  protected onDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valueChanged.emit(input.value);
  }
}
