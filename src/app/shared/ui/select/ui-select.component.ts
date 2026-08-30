import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SlotKeyOption } from '../../../features/employee/shared/ui/section/editable-slot-section.model';
import { B4IconComponent } from '../icon/b4-icon.component';

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
        [value]="value() ?? ''"
        (change)="onSelectionChange($event)"
      >
        <option value="" [disabled]="true" [hidden]="true">{{ placeholder() ?? '' }}</option>
        @for (opt of selectOptions(); track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>
      <b4-icon class="ui-select__icon" name="chevron-abajo" [size]="16" aria-hidden="true" />
    </div>
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

  readonly valueChanged = output<string>();

  protected onSelectionChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.valueChanged.emit(select.value);
  }
}
