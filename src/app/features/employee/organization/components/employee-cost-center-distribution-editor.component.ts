import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { employeeTexts } from '../../employee.texts';
import { CostCenterDistributionItemDraft } from '../../data-access/employee-cost-center.mapper';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { UiInputNumberComponent } from '../../../../shared/ui/input-number/ui-input-number.component';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';

export interface CostCenterDistributionDraft {
  startDate: string;
  items: ReadonlyArray<CostCenterDistributionItemDraft>;
}

@Component({
  selector: 'app-employee-cost-center-distribution-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    UiButtonComponent,
    UiDateInputComponent,
    UiSelectComponent,
    UiInputNumberComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" class="cost-center-editor">
      @if (showDateField()) {
        <div class="cost-center-editor__header">
          <label class="cost-center-editor__field">
            <span class="cost-center-editor__label">{{ dateLabel() }}</span>
            <app-ui-date-input
              [value]="form.controls.startDate.value"
              (valueChanged)="form.controls.startDate.setValue($event)"
            />
          </label>
        </div>
      }

      <div class="cost-center-editor__items" formArrayName="items">
        <div class="cost-center-editor__items-header">
          <span class="cost-center-editor__col-code">{{ texts.costCenterSectionCodeLabel }}</span>
          <span class="cost-center-editor__col-perc">{{
            texts.costCenterSectionPercentageLabel
          }}</span>
          <span class="cost-center-editor__col-actions"></span>
        </div>

        @for (item of items.controls; track $index) {
          <div class="cost-center-editor__item-row" [formGroupName]="$index">
            <div class="cost-center-editor__col-code">
              <app-ui-select
                [value]="item.get('costCenterCode')?.value"
                [options]="getRowOptions(item.get('costCenterCode')?.value)"
                [placeholder]="texts.costCenterSectionCodeLabel"
                [disabled]="loading()"
                (valueChanged)="$event ? item.get('costCenterCode')?.setValue($event) : null"
              />
            </div>
            <div class="cost-center-editor__col-perc">
              <app-ui-input-number
                [value]="item.get('allocationPercentage')?.value"
                [min]="0"
                [max]="100"
                suffix="%"
                [disabled]="loading()"
                (valueChanged)="item.get('allocationPercentage')?.setValue($event)"
              />
            </div>
            <div class="cost-center-editor__col-actions">
              <app-ui-button
                severity="danger"
                [outlined]="true"
                size="small"
                [label]="'×'"
                [title]="texts.costCenterSectionRemoveItemAction"
                (pressed)="removeItem($index)"
              />
            </div>
          </div>
        }
      </div>

      <div class="cost-center-editor__footer">
        <app-ui-button
          severity="secondary"
          [outlined]="true"
          size="small"
          [label]="texts.costCenterSectionAddItemAction"
          (pressed)="addItem()"
        />

        <div
          class="cost-center-editor__total"
          [class.cost-center-editor__total--error]="totalPercentage() > 100"
        >
          {{ texts.costCenterSectionTotalLabel }}: <strong>{{ totalPercentage() }}%</strong>
          @if (totalPercentage() > 100) {
            <span class="cost-center-editor__error-hint">{{
              texts.costCenterSectionInvalidTotalMessage
            }}</span>
          }
        </div>
      </div>
    </form>
  `,
  styleUrl: './employee-cost-center-distribution-editor.component.scss',
})
export class EmployeeCostCenterDistributionEditorComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  readonly texts = employeeTexts;

  readonly dateLabel = input<string>(this.texts.costCenterSectionStartDateLabel);
  readonly initialValue = input<CostCenterDistributionDraft | null>(null);
  readonly options = input<ReadonlyArray<SlotKeyOption<string>>>([]);
  readonly loading = input(false);
  /**
   * Quién pone la fecha de la ventana. Falso cuando la pantalla la lleva fuera, junto a la de
   * fin, porque el plan del backend se pide con las dos y aquí solo hay una (ADR-057).
   */
  readonly showDateField = input(true);

  readonly form = this.fb.group({
    startDate: [''],
    items: this.fb.array([], [Validators.required, Validators.minLength(1)]),
  });

  constructor() {
    // `initialValue` es una entrada: en el constructor todavía no vale nada, así que el
    // «sync external changes» que había aquí nunca llegó a sincronizar nada. Se hace al llegar.
    effect(() => {
      const initial = this.initialValue();
      untracked(() => this.resetTo(initial));
    });
  }

  private resetTo(initial: CostCenterDistributionDraft | null): void {
    this.items.clear();
    this.form.controls.startDate.setValue(initial?.startDate ?? '');
    if (initial && initial.items.length > 0) {
      initial.items.forEach((item) => this.addItem(item));
      return;
    }
    this.addItem();
  }

  get items() {
    return this.form.get('items') as FormArray;
  }

  // We use a simple method to get the total since computations on FormArray are tricky with signals
  // Alternatively, we could expose the form value and use computed in the parent
  totalPercentage(): number {
    return this.items.controls.reduce(
      (acc, control) => acc + (control.value.allocationPercentage || 0),
      0,
    );
  }

  addItem(initial?: CostCenterDistributionItemDraft) {
    this.items.push(
      this.fb.group({
        costCenterCode: [initial?.costCenterCode ?? '', Validators.required],
        allocationPercentage: [
          initial?.allocationPercentage ?? 0,
          [Validators.required, Validators.min(1), Validators.max(100)],
        ],
      }),
    );
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }

  isValid(): boolean {
    if (this.showDateField() && !this.form.controls.startDate.value) return false;
    return this.items.valid && this.totalPercentage() <= 100;
  }

  getValue(): CostCenterDistributionDraft {
    const raw = this.form.getRawValue() as {
      startDate: string;
      items: CostCenterDistributionItemDraft[];
    };
    return {
      startDate: raw.startDate,
      items: raw.items,
    };
  }

  protected getRowOptions(
    currentCode: string | null | undefined,
  ): ReadonlyArray<SlotKeyOption<string>> {
    const options = this.options();
    const normalizedCurrentCode = currentCode?.trim() ?? '';

    if (!normalizedCurrentCode) {
      return options;
    }

    if (options.some((option) => option.value === normalizedCurrentCode)) {
      return options;
    }

    // Fallback if current code is not in the catalog
    return [{ value: normalizedCurrentCode, label: normalizedCurrentCode }, ...options];
  }
}
