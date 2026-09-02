import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';

@Component({
  selector: 'app-ui-input-number',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputNumberModule, FormsModule],
  template: `
    <p-inputnumber
      [id]="inputId() ?? undefined"
      [ngModel]="value()"
      [min]="min() ?? null"
      [max]="max() ?? null"
      [disabled]="disabled()"
      [placeholder]="placeholder() ?? undefined"
      [ariaLabel]="ariaLabel() ?? undefined"
      (ngModelChange)="onValueChange($event)"
      [fluid]="true"
      [showButtons]="showButtons()"
      [suffix]="suffix() ?? ''"
    />
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      :host ::ng-deep .p-inputnumber {
        width: 100%;
      }
    `,
  ],
})
export class UiInputNumberComponent {
  readonly value = input<number | null>(null);
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);
  readonly placeholder = input<string | null>(null);
  readonly showButtons = input(false);
  readonly suffix = input<string | null>(null);
  readonly inputId = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false);

  readonly valueChanged = output<number>();

  protected onValueChange(newValue: number | null): void {
    this.valueChanged.emit(newValue ?? 0);
  }
}
