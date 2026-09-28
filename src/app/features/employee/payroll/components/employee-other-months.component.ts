import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { employeeTexts } from '../../employee.texts';
import {
  PayrollPeriod,
  formatPayrollPeriodCode,
} from '../../../../shared/utils/payroll-period.util';

/**
 * «También en: 03/2026 · 07/2026» (`b4rrhh/frontend#90`).
 *
 * Una sección que se filtra por el mes de la página no puede esconder en silencio lo que cae en
 * otro: una corrección pendiente de marzo que no se ve estando en agosto es una corrección que
 * nadie va a mirar. Así que se dice que existe, y llevar a ese mes es un clic.
 */
@Component({
  selector: 'app-employee-other-months',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (months().length > 0) {
      <p class="other-months">
        <span class="other-months__label">{{ texts.otherMonthsLabel }}</span>
        @for (month of months(); track month) {
          <button type="button" class="other-months__month" (click)="picked.emit(month)">
            {{ code(month) }}
          </button>
        }
      </p>
    }
  `,
  styleUrl: './employee-other-months.component.scss',
})
export class EmployeeOtherMonthsComponent {
  /** Los meses, del más reciente al más antiguo. */
  readonly months = input.required<ReadonlyArray<PayrollPeriod>>();
  readonly picked = output<PayrollPeriod>();

  protected readonly texts = employeeTexts;

  protected code(month: PayrollPeriod): string {
    return formatPayrollPeriodCode(month);
  }
}
