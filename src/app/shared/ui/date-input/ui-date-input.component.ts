import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';

/**
 * El único selector de fecha de la aplicación (`b4rrhh/frontend#96`).
 *
 * <p>Había dos: las secciones de la ficha usaban un `<input type="date">` nativo y el alta, la
 * readmisión, la empresa y el centro, el `p-datepicker` de PrimeNG —el que el revisor de la demo
 * llamó «el que está bien»—. Dos aspectos, dos comportamientos, dos formas de escribir una fecha.
 * Queda el de PrimeNG, envuelto aquí para que la aplicación no dependa de él en cien sitios.
 *
 * <p>Hacia fuera habla en texto `yyyy-MM-dd`, que es lo que viaja al backend, y se usa de dos
 * maneras: con `[value]` y `(valueChanged)`, como las secciones, o con `formControlName`. En un
 * formulario también acepta un `Date` al escribirle, y siempre devuelve el texto. Una fecha vacía
 * es `''`.
 */
@Component({
  selector: 'app-ui-date-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePickerModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiDateInputComponent),
      multi: true,
    },
  ],
  template: `
    <p-datepicker
      [inputId]="inputId() ?? undefined"
      [ngModel]="dateValue()"
      (ngModelChange)="onPicked($event)"
      (onBlur)="onTouched()"
      [minDate]="minDate()"
      [maxDate]="maxDate()"
      [disabled]="isDisabled()"
      [readonlyInput]="readonly()"
      [ariaLabel]="ariaLabel() ?? undefined"
      dateFormat="dd/mm/yy"
      placeholder="dd/mm/aaaa"
      [showIcon]="true"
      [fluid]="true"
      [showButtonBar]="true"
      appendTo="body"
    />
  `,
  styleUrl: './ui-date-input.component.scss',
})
export class UiDateInputComponent implements ControlValueAccessor {
  readonly value = input<string | null>('');
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly inputId = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false);
  readonly readonly = input(false);

  readonly valueChanged = output<string>();

  /** Lo que ha escrito un formulario, si lo usa uno; manda sobre `[value]`. */
  private readonly formValue = signal<string | null | undefined>(undefined);
  private readonly formDisabled = signal(false);
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected readonly dateValue = computed(() => {
    const fromForm = this.formValue();
    return toDate(fromForm !== undefined ? fromForm : this.value());
  });
  protected readonly minDate = computed(() => toDate(this.min()));
  protected readonly maxDate = computed(() => toDate(this.max()));
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  protected onPicked(picked: Date | null): void {
    const text = picked instanceof Date ? toIsoDate(picked) : '';
    if (this.formValue() !== undefined) this.formValue.set(text);
    this.onChange(text);
    this.valueChanged.emit(text);
  }

  writeValue(value: unknown): void {
    this.formValue.set(value instanceof Date ? toIsoDate(value) : ((value as string | null) ?? ''));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}

/** `yyyy-MM-dd` como fecha local a medianoche: nada de UTC, que corre el día. */
function toDate(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
