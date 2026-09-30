import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';

import { formatDisplayDate } from '../../utils/local-date.util';

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
 *
 * <p>El calendario se abre con su icono y no al enfocar la caja: los modales enfocan el primer
 * campo al abrirse, y el calendario tapaba el aviso del plan que hay debajo. La fecha se puede
 * escribir igual.
 *
 * <p>Y lo escrito llega igual que lo elegido (`b4rrhh/frontend#119`). PrimeNG solo atiende a lo
 * que entra tecla a tecla: lo que llega sin teclas —pegar con el ratón, el autorrelleno del
 * navegador— lo borraba al salir de la caja, y un texto que no es fecha lo tragaba sin decir nada.
 * Por eso, al salir o con Intro, se lee la caja aquí: si es una fecha, va al valor; si no, se dice
 * con el texto delante, y en un formulario el control lleva el error con su nombre
 * (`fechaInvalida` o `fechaFueraDeRango`).
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
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => UiDateInputComponent),
      multi: true,
    },
  ],
  host: {
    '(keydown.enter)': 'onTypedCommit($event)',
  },
  template: `
    <p-datepicker
      [inputId]="inputId() ?? undefined"
      [ngModel]="dateValue()"
      (ngModelChange)="onPicked($event)"
      (onBlur)="onBlurred($event)"
      [minDate]="minDate()"
      [maxDate]="maxDate()"
      [disabled]="isDisabled()"
      [readonlyInput]="readonly()"
      [ariaLabel]="ariaLabel() ?? undefined"
      dateFormat="dd/mm/yy"
      placeholder="dd/mm/aaaa"
      [showIcon]="true"
      [showOnFocus]="false"
      [fluid]="true"
      [showButtonBar]="true"
      appendTo="body"
    />
    @if (typedError(); as error) {
      <small class="ui-date-input__error" role="alert">{{ error.message }}</small>
    }
  `,
  styleUrl: './ui-date-input.component.scss',
})
export class UiDateInputComponent implements ControlValueAccessor, Validator {
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
  private onValidatorChange: () => void = () => undefined;

  /** Lo último escrito que no se pudo tomar por fecha; `null` si no hay nada que decir. */
  protected readonly typedError = signal<TypedDateError | null>(null);

  protected readonly dateValue = computed(() => {
    const fromForm = this.formValue();
    return toDate(fromForm !== undefined ? fromForm : this.value());
  });
  protected readonly minDate = computed(() => toDate(this.min()));
  protected readonly maxDate = computed(() => toDate(this.max()));
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  protected onPicked(picked: Date | null): void {
    const text = picked instanceof Date ? toIsoDate(picked) : '';
    if (text !== '') this.setTypedError(null);
    this.emit(text);
  }

  protected onBlurred(event: Event): void {
    this.onTouched();
    this.onTypedCommit(event);
  }

  /**
   * Toma lo que hay en la caja. Se llama al salir y con Intro, antes de que PrimeNG la repinte con
   * su modelo: lo que tecla a tecla ya había llegado, aquí se confirma sin volver a emitir.
   */
  protected onTypedCommit(event: Event): void {
    const box = event.target;
    if (!(box instanceof HTMLInputElement)) return;
    const typed = box.value.trim();
    const current = this.currentText();

    if (typed === '') {
      this.setTypedError(null);
      if (current !== '') this.emit('');
      return;
    }

    const date = parseTypedDate(typed);
    const error = !date
      ? {
          code: 'fechaInvalida' as const,
          message: `«${typed}» no es una fecha: escríbela como dd/mm/aaaa.`,
        }
      : this.outOfRange(date)
        ? { code: 'fechaFueraDeRango' as const, message: `«${typed}» ${this.rangeText()}.` }
        : null;
    this.setTypedError(error ? { ...error, typed } : null);

    const text = date && !error ? toIsoDate(date) : '';
    if (text !== current) this.emit(text);
  }

  writeValue(value: unknown): void {
    this.setTypedError(null);
    this.formValue.set(value instanceof Date ? toIsoDate(value) : ((value as string | null) ?? ''));
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    const error = this.typedError();
    return error ? { [error.code]: { texto: error.typed } } : null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
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

  private emit(text: string): void {
    if (this.formValue() !== undefined) this.formValue.set(text);
    this.onChange(text);
    this.valueChanged.emit(text);
  }

  private currentText(): string {
    const fromForm = this.formValue();
    return (fromForm !== undefined ? fromForm : this.value()) ?? '';
  }

  private setTypedError(error: TypedDateError | null): void {
    if (error?.message === this.typedError()?.message) return;
    this.typedError.set(error);
    this.onValidatorChange();
  }

  private outOfRange(date: Date): boolean {
    const min = this.minDate();
    const max = this.maxDate();
    return (min !== null && date < min) || (max !== null && date > max);
  }

  private rangeText(): string {
    const min = this.min();
    const max = this.max();
    const from = min ? ` desde el ${formatDisplayDate(min)}` : '';
    const to = max ? ` hasta el ${formatDisplayDate(max)}` : '';
    return `se sale de las fechas permitidas:${from}${to}`;
  }
}

interface TypedDateError {
  code: 'fechaInvalida' | 'fechaFueraDeRango';
  message: string;
  typed: string;
}

/**
 * `dd/mm/aaaa` como lo escribe una persona: con o sin ceros, y con barra, guion o punto. Una fecha
 * que no existe (el 31 de abril) no es una fecha.
 */
function parseTypedDate(text: string): Date | null {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
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
