import { ChangeDetectionStrategy, Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs';

import { employeeTexts } from '../../employee.texts';
import { readEmployeeBusinessKeyFromParamMap } from '../../routing/employee-route-key.util';
import { EmployeePayrollInputSectionComponent } from '../components/employee-payroll-input-section.component';
import { EmployeeTaxInformationSectionComponent } from '../../tax-information/components/employee-tax-information-section.component';
import { payrollRouteBaseSegment } from '../../../nomina/recibos/routing/payroll-route-key.util';

@Component({
  selector: 'app-employee-payroll-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmployeePayrollInputSectionComponent,
    EmployeeTaxInformationSectionComponent,
    RouterLink,
  ],
  templateUrl: './employee-payroll-page.component.html',
  styleUrl: './employee-payroll-page.component.scss',
})
export class EmployeePayrollPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly texts = employeeTexts;

  /**
   * Adónde lleva «Ver sus recibos».
   *
   * Sale de `payrollRouteBaseSegment` y no de un literal: el día que la pantalla de recibos cambie
   * de sitio, este enlace se entera. El número del empleado viaja en `queryParams` porque es un
   * filtro de esa lista, no parte de su dirección.
   */
  protected readonly receiptsRouteCommands = ['/' + payrollRouteBaseSegment];
  protected readonly activeEmployeeKey = toSignal(
    this.route.paramMap.pipe(map((params) => readEmployeeBusinessKeyFromParamMap(params))),
    { initialValue: readEmployeeBusinessKeyFromParamMap(this.route.snapshot.paramMap) },
  );
}
