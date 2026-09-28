import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { employeeTexts } from '../../employee.texts';
import { readEmployeeBusinessKeyFromParamMap } from '../../routing/employee-route-key.util';
import { payrollRouteBaseSegment } from '../../../nomina/recibos/routing/payroll-route-key.util';
import { SectionHeadingComponent } from '../../../../shared/ui/section-heading/section-heading.component';

/**
 * Lo que sale (`b4rrhh/frontend#90`): los recibos del empleado. Hoy es el salto a la lista de
 * recibos filtrada por él, que estaba al pie de «Nómina»; lo que el grupo lleve además lo decide el
 * `b4rrhh/frontend#93`.
 */
@Component({
  selector: 'app-employee-receipts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeadingComponent, RouterLink],
  templateUrl: './employee-receipts-page.component.html',
  styleUrl: './employee-receipts-page.component.scss',
})
export class EmployeeReceiptsPageComponent {
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
