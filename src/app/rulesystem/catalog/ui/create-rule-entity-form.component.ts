import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  input,
  output,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

import { UiButtonComponent } from '../../../shared/ui/button/ui-button.component';
import { UiDateInputComponent } from '../../../shared/ui/date-input/ui-date-input.component';
import { catalogTexts } from '../catalog.texts';
import { CreateRuleEntityFormModel } from '../models/create-rule-entity-form.model';

@Component({
  selector: 'app-create-rule-entity-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputTextModule, UiButtonComponent, UiDateInputComponent],
  templateUrl: './create-rule-entity-form.component.html',
  styleUrl: './create-rule-entity-form.component.scss',
})
export class CreateRuleEntityFormComponent implements OnChanges {
  readonly creating = input(false);
  readonly disabled = input(false);
  readonly resetToken = input(0);
  readonly submitRequested = output<CreateRuleEntityFormModel>();
  readonly interactionStarted = output<void>();

  protected readonly texts = catalogTexts;
  protected readonly form = new FormGroup(
    {
      code: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(30)],
      }),
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      description: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(500)],
      }),
      startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      endDate: new FormControl('', { nonNullable: true }),
    },
    { validators: [validateDateRange] },
  );
  protected readonly hasRangeError = computed(
    () => this.form.touched && this.form.hasError('invalidDateRange'),
  );
  protected readonly appliedResetToken = computed(() => this.resetToken());

  constructor() {
    this.appliedResetToken();
  }

  protected submit(): void {
    if (this.form.invalid || this.creating() || this.disabled()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitRequested.emit(this.form.getRawValue());
  }

  protected markInteraction(): void {
    this.interactionStarted.emit();
  }

  protected updateDateField(field: 'startDate' | 'endDate', value: string): void {
    const control = this.form.controls[field];
    control.setValue(value);
    control.markAsTouched();
    control.markAsDirty();
    this.markInteraction();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['resetToken'] || changes['resetToken'].firstChange) {
      return;
    }

    this.form.reset(
      {
        code: '',
        name: '',
        description: '',
        startDate: '',
        endDate: '',
      },
      { emitEvent: false },
    );
  }
}

function validateDateRange(control: AbstractControl): ValidationErrors | null {
  const startDate = (control.get('startDate')?.value as string | null) ?? '';
  const endDate = (control.get('endDate')?.value as string | null) ?? '';

  if (!startDate || !endDate) {
    return null;
  }

  if (endDate < startDate) {
    return { invalidDateRange: true };
  }

  return null;
}
