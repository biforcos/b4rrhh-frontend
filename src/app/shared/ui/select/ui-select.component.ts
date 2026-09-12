import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SlotKeyOption } from '../../../features/employee/shared/ui/section/editable-slot-section.model';
import { B4IconComponent } from '../icon/b4-icon.component';

/**
 * El desplegable de la casa, y desde el `b4rrhh/frontend#32` el sitio donde se enseña la
 * vigencia de un código de catálogo.
 *
 * Las opciones vigentes a la fecha del período que se edita van primero; las que no lo están
 * van debajo, en su propio grupo y con su período al lado — «cerrado el 31/12/2020» —. Se
 * pueden elegir: en este dominio elegir un código no vigente es frecuente (la corrección
 * administrativa, «esto se grabó mal, ponle el código antiguo»), y si la excepción es
 * frecuente no es una excepción.
 *
 * Y cuando la elegida no está vigente se dice, debajo del control y sin bloquear. La
 * diferencia entre una corrección deliberada y un despiste es que la deliberada no se
 * sorprende del aviso.
 *
 * Una lista sin marcas de vigencia —`effective` ausente en todas— se pinta plana, como
 * siempre: la agrupación aparece sólo cuando hay algo que agrupar.
 */
@Component({
  selector: 'app-ui-select',
  standalone: true,
  imports: [B4IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-select">
      <select
        class="ui-select__control"
        [id]="inputId() ?? undefined"
        [disabled]="disabled()"
        [attr.aria-label]="ariaLabel() ?? undefined"
        [attr.aria-describedby]="selectedNotEffective() ? noticeId() : undefined"
        [value]="value() ?? ''"
        (change)="onSelectionChange($event)"
      >
        <option value="" [disabled]="true" [hidden]="true">{{ placeholder() ?? '' }}</option>
        @if (hasNotEffective()) {
          <optgroup label="Vigentes">
            @for (opt of effectiveOptions(); track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </optgroup>
          <optgroup label="No vigentes en esa fecha">
            @for (opt of notEffectiveOptions(); track opt.value) {
              <option [value]="opt.value">{{ optionLabel(opt) }}</option>
            }
          </optgroup>
        } @else {
          @for (opt of selectOptions(); track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        }
      </select>
      <b4-icon class="ui-select__icon" name="chevron-abajo" [size]="16" aria-hidden="true" />
    </div>
    @if (selectedNotEffective(); as selected) {
      <p class="ui-select__notice" [id]="noticeId()">
        {{ noticeFor(selected) }}
      </p>
    }
  `,
  styleUrl: './ui-select.component.scss',
})
export class UiSelectComponent {
  readonly value = input<string | null>('');
  readonly options = input<ReadonlyArray<SlotKeyOption<string>>>([]);
  readonly placeholder = input<string | null>(null);
  readonly inputId = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false);

  protected readonly selectOptions = computed(() => this.options() as SlotKeyOption<string>[]);

  protected readonly hasNotEffective = computed(() =>
    this.selectOptions().some((opt) => opt.effective === false),
  );

  protected readonly effectiveOptions = computed(() =>
    this.selectOptions().filter((opt) => opt.effective !== false),
  );

  protected readonly notEffectiveOptions = computed(() =>
    this.selectOptions().filter((opt) => opt.effective === false),
  );

  /** La opción elegida, si la hay y no está vigente. */
  protected readonly selectedNotEffective = computed(() => {
    const value = this.value();
    if (!value) {
      return null;
    }
    return (
      this.selectOptions().find((opt) => opt.value === value && opt.effective === false) ?? null
    );
  });

  protected readonly noticeId = computed(() =>
    this.inputId() ? `${this.inputId()}-vigencia` : 'ui-select-vigencia',
  );

  readonly valueChanged = output<string>();

  protected optionLabel(option: SlotKeyOption<string>): string {
    return option.note ? `${option.label} · ${option.note}` : option.label;
  }

  protected noticeFor(option: SlotKeyOption<string>): string {
    return option.note
      ? `No vigente en la fecha del período: ${option.note}. Se guarda igual.`
      : 'No vigente en la fecha del período. Se guarda igual.';
  }

  protected onSelectionChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.valueChanged.emit(select.value);
  }
}
