import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import { employeeTexts } from '../../employee.texts';
import {
  PayrollPeriod,
  formatPayrollPeriodLabel,
  movePayrollPeriod,
} from '../../../../shared/utils/payroll-period.util';

/**
 * El navegador de período de «lo que pasa cada mes» (`b4rrhh/frontend#90`).
 *
 * Es uno para las tres secciones de la página —ausencias, entradas y correcciones— y no uno por
 * sección, que es lo que había: sólo las entradas lo tenían, y las otras dos enseñaban todo lo del
 * empleado sin decir de qué mes. El mes lo lleva la página; esto sólo lo mueve.
 */
@Component({
  selector: 'app-employee-month-navigator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="month-navigator" role="group" [attr.aria-label]="texts.monthNavigatorAriaLabel">
      <button
        type="button"
        class="month-navigator__btn"
        [attr.aria-label]="texts.payrollInputsPrevPeriodAriaLabel"
        [disabled]="disabled()"
        (click)="move(-1)"
      >
        &#8249;
      </button>
      <span class="month-navigator__label" aria-live="polite">{{ label() }}</span>
      <button
        type="button"
        class="month-navigator__btn"
        [attr.aria-label]="texts.payrollInputsNextPeriodAriaLabel"
        [disabled]="disabled()"
        (click)="move(1)"
      >
        &#8250;
      </button>
    </div>
  `,
  styleUrl: './employee-month-navigator.component.scss',
})
export class EmployeeMonthNavigatorComponent {
  readonly period = model.required<PayrollPeriod>();
  readonly disabled = input(false);

  protected readonly texts = employeeTexts;
  protected readonly label = computed(() => formatPayrollPeriodLabel(this.period()));

  protected move(delta: 1 | -1): void {
    this.period.update((p) => movePayrollPeriod(p, delta));
  }
}
