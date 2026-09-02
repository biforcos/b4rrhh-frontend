import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

import { UiButtonComponent } from '../../../shared/ui/button/ui-button.component';
import { RuleSystemFormModel } from '../models/rule-system-form.model';
import { ruleSystemTexts } from '../rule-system.texts';

@Component({
  selector: 'app-rule-system-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputTextModule, UiButtonComponent],
  templateUrl: './rule-system-form.component.html',
  styleUrl: './rule-system-form.component.scss',
})
export class RuleSystemFormComponent {
  readonly mode = input<'create' | 'edit'>('create');
  readonly initialValue = input<RuleSystemFormModel | null>(null);
  readonly saving = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly successMessage = input<string | null>(null);

  readonly submitRequested = output<RuleSystemFormModel>();
  readonly cancelRequested = output<void>();
  readonly interactionStarted = output<void>();

  protected readonly texts = ruleSystemTexts;
  protected readonly isEditMode = computed(() => this.mode() === 'edit');
  protected readonly form = new FormGroup({
    code: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true }),
    countryCode: new FormControl('', { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const currentMode = this.mode();
      const value = this.initialValue();
      this.applyMode(currentMode);
      this.writeInitialValue(value, currentMode);
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitRequested.emit(this.form.getRawValue());
  }

  protected cancel(): void {
    this.cancelRequested.emit();
  }

  protected notifyInteraction(): void {
    this.interactionStarted.emit();
  }

  private applyMode(mode: 'create' | 'edit'): void {
    if (mode === 'create') {
      this.form.controls.code.enable({ emitEvent: false });
      this.form.controls.active.disable({ emitEvent: false });
    } else {
      this.form.controls.code.disable({ emitEvent: false });
      this.form.controls.active.enable({ emitEvent: false });
    }

    this.form.controls.code.setValidators(
      mode === 'create'
        ? [Validators.required, Validators.maxLength(5)]
        : [Validators.maxLength(5)],
    );
    this.form.controls.name.setValidators([Validators.required, Validators.maxLength(100)]);
    this.form.controls.countryCode.setValidators([
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(3),
    ]);
    this.form.controls.active.setValidators(mode === 'edit' ? [Validators.required] : []);

    this.form.controls.code.updateValueAndValidity({ emitEvent: false });
    this.form.controls.name.updateValueAndValidity({ emitEvent: false });
    this.form.controls.countryCode.updateValueAndValidity({ emitEvent: false });
    this.form.controls.active.updateValueAndValidity({ emitEvent: false });
  }

  private writeInitialValue(value: RuleSystemFormModel | null, mode: 'create' | 'edit'): void {
    if (!value) {
      this.form.reset(
        {
          code: '',
          name: '',
          countryCode: '',
          active: true,
        },
        { emitEvent: false },
      );

      if (mode === 'edit') {
        this.form.controls.code.setValue('', { emitEvent: false });
      }

      return;
    }

    this.form.reset(
      {
        code: value.code,
        name: value.name,
        countryCode: value.countryCode,
        active: value.active,
      },
      { emitEvent: false },
    );
  }
}
