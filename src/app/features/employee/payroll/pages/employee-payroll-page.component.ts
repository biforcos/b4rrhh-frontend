import { ChangeDetectionStrategy, Component, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs';

import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeeRetroMarkStore } from '../../data-access/employee-retro-mark.store';
import { employeeTexts } from '../../employee.texts';
import { GlobalUiMessage } from '../../models/global-ui-message.model';
import { readEmployeeBusinessKeyFromParamMap } from '../../routing/employee-route-key.util';
import { EmployeePayrollInputSectionComponent } from '../components/employee-payroll-input-section.component';
import { EmployeeRetroMarkSectionComponent } from '../components/employee-retro-mark-section.component';
import { EmployeeTaxInformationSectionComponent } from '../../tax-information/components/employee-tax-information-section.component';
import { payrollRouteBaseSegment } from '../../../nomina/recibos/routing/payroll-route-key.util';
import { SectionHeadingComponent } from '../../../../shared/ui/section-heading/section-heading.component';

@Component({
  selector: 'app-employee-payroll-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmployeePayrollInputSectionComponent,
    EmployeeRetroMarkSectionComponent,
    EmployeeTaxInformationSectionComponent,
    SectionHeadingComponent,
    RouterLink,
  ],
  templateUrl: './employee-payroll-page.component.html',
  styleUrl: './employee-payroll-page.component.scss',
})
export class EmployeePayrollPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly retroMarkStore = inject(EmployeeRetroMarkStore);
  private readonly globalMessageService = inject(GlobalMessageService);

  private previousRetroMarkSuccess: string | null = null;

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

  /**
   * El feedback de la sección de marcas lo publica la página al servicio global (ADR-022, ADR-023),
   * que es donde vive el feedback en este frontend. La sección no pinta banderines propios.
   */
  constructor() {
    effect((onCleanup) => {
      const messages = this.buildGlobalMessages();
      untracked(() =>
        this.globalMessageService.setSourceMessages('employee-payroll-page', messages),
      );
      onCleanup(() =>
        untracked(() => this.globalMessageService.clearSourceMessages('employee-payroll-page')),
      );
    });

    effect(() => this.publishSuccessFeedback());
  }

  private buildGlobalMessages(): ReadonlyArray<Omit<GlobalUiMessage, 'createdAt'>> {
    const text = this.mapRetroMarkErrorMessage(this.retroMarkStore.error());
    if (!text) return [];
    return [
      {
        id: 'retro-mark-error',
        level: 'error',
        text,
        sectionId: 'payroll',
        sectionLabel: this.texts.retroMarksSectionTitle,
        sticky: true,
      },
    ];
  }

  private publishSuccessFeedback(): void {
    const success = this.retroMarkStore.success();
    if (success && success !== this.previousRetroMarkSuccess) {
      untracked(() =>
        this.globalMessageService.success(this.texts.retroMarksDiscardSuccessMessage, {
          id: `employee-payroll-page-success-retro-${success}`,
          sectionId: 'payroll',
          sectionLabel: this.texts.retroMarksSectionTitle,
        }),
      );
    }
    this.previousRetroMarkSuccess = success;
  }

  /**
   * «Ya no está pendiente» tiene mensaje propio y no cae en «reintenta», porque no se arregla
   * reintentando: la marca se pagó o la descartó otro mientras esta pantalla estaba abierta, y lo
   * que hay que hacer es recargar y mirar en qué quedó.
   */
  private mapRetroMarkErrorMessage(code: string | null): string | null {
    const t = this.texts;
    if (code === 'not-active') return t.retroMarksNotActiveMessage;
    if (code === 'not-found') return t.retroMarksNotFoundMessage;
    if (code === 'reason-required') return t.retroMarksReasonRequiredMessage;
    if (code === 'request-failed') return t.retroMarksLoadFailedMessage;
    return null;
  }
}
