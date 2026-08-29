import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { B4IconComponent } from '../../../../shared/ui/icon/b4-icon.component';
import { B4IconName } from '../../../../shared/ui/icon/icon-names';
import { formatDisplayDate } from '../../../../shared/utils/local-date.util';
import { employeeTexts } from '../../employee.texts';
import { EmployeeContractModel } from '../../models/employee-contract.model';
import { EmployeeCostCenterWindowModel } from '../../models/employee-cost-center.model';
import { EmployeeLaborClassificationModel } from '../../models/employee-labor-classification.model';
import { EmployeePresenceModel } from '../../models/employee-presence.model';
import { EmployeeWorkCenterModel } from '../../models/employee-work-center.model';
import { EmployeeWorkingTimeModel } from '../../models/employee-working-time.model';
import { EmployeeRelationAnchor } from '../../routing/employee-route-builder.util';

export interface TodayItem {
  anchor: EmployeeRelationAnchor;
  icon: B4IconName;
  label: string;
  /** El valor vigente hoy; `null` cuando no hay vigencia abierta. */
  value: string | null;
  /** Lo que acompaña al valor: el código, la fecha desde la que rige. */
  secondary: string | null;
}

const HOURS = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

/**
 * La tira «Hoy» (frontend#25): qué es verdad hoy, una fila por vigencia, encima de la historia.
 * El noventa por ciento de las veces se quiere el estado de hoy; la historia es la excepción, y
 * vive debajo, en los carriles. Cada valor lleva a su carril.
 */
@Component({
  selector: 'app-employee-today-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [B4IconComponent],
  templateUrl: './employee-today-strip.component.html',
  styleUrl: './employee-today-strip.component.scss',
})
export class EmployeeTodayStripComponent {
  readonly presences = input<ReadonlyArray<EmployeePresenceModel>>([]);
  readonly contracts = input<ReadonlyArray<EmployeeContractModel>>([]);
  readonly workingTimes = input<ReadonlyArray<EmployeeWorkingTimeModel>>([]);
  readonly laborClassifications = input<ReadonlyArray<EmployeeLaborClassificationModel>>([]);
  readonly workCenters = input<ReadonlyArray<EmployeeWorkCenterModel>>([]);
  readonly costCenter = input<EmployeeCostCenterWindowModel | null>(null);

  readonly laneRequested = output<EmployeeRelationAnchor>();

  protected readonly texts = employeeTexts;

  protected readonly items = computed<ReadonlyArray<TodayItem>>(() => {
    const t = this.texts;
    const presence = open(this.presences());
    const contract = open(this.contracts());
    const workingTime = open(this.workingTimes());
    const classification = open(this.laborClassifications());
    const workCenter = open(this.workCenters());
    const cost = this.costCenter();
    return [
      {
        anchor: 'presence',
        icon: 'empleado',
        label: t.lifelineLanePresence,
        value: presence ? (presence.companyName ?? presence.companyCode) : null,
        secondary: presence ? `${t.todaySinceLabel} ${formatDisplayDate(presence.startDate)}` : null,
      },
      {
        anchor: 'contract',
        icon: 'documento-nuevo',
        label: t.lifelineLaneContract,
        value: contract ? (contract.contractTypeName ?? contract.contractCode) : null,
        secondary: contract ? `${contract.contractCode}${contract.contractSubtypeCode ? ` / ${contract.contractSubtypeCode}` : ''}` : null,
      },
      {
        anchor: 'working-time',
        icon: 'jornada',
        label: t.lifelineLaneWorkingTime,
        value: workingTime ? `${workingTime.workingTimePercentage} % · ${HOURS.format(workingTime.weeklyHours)} ${t.lifelineHoursPerWeekLabel}` : null,
        secondary: workingTime ? `${HOURS.format(workingTime.dailyHours)} ${t.todayHoursPerDayLabel}` : null,
      },
      {
        anchor: 'classification',
        icon: 'convenio',
        label: t.lifelineLaneClassification,
        value: classification ? (classification.agreementCategoryName ?? classification.agreementCategoryCode) : null,
        secondary: classification
          ? `${classification.agreementName ?? classification.agreementCode}${classification.grupoCotizacionCode ? ` · ${t.lifelineContributionGroupLabel} ${classification.grupoCotizacionCode}` : ''}`
          : null,
      },
      {
        anchor: 'work-center',
        icon: 'centro-trabajo',
        label: t.lifelineLaneWorkCenter,
        value: workCenter ? (workCenter.workCenterName ?? workCenter.workCenterCode) : null,
        secondary: workCenter?.workCenterName ? workCenter.workCenterCode : null,
      },
      {
        anchor: 'cost-center',
        icon: 'centro-coste',
        label: t.costCenterSectionTitle,
        value: cost ? cost.items.map((i) => `${i.costCenterName || i.costCenterCode} ${i.allocationPercentage} %`).join(' · ') : null,
        secondary: cost ? `${cost.totalAllocationPercentage} % ${t.todayAllocatedLabel}` : null,
      },
    ];
  });

  protected select(item: TodayItem): void {
    this.laneRequested.emit(item.anchor);
  }
}

/** La vigencia abierta hoy: la que no tiene fin; si hay varias, la más reciente. */
function open<T extends { startDate: string; endDate?: string | null; isActive?: boolean }>(
  items: ReadonlyArray<T>,
): T | null {
  const candidates = items.filter((item) => item.isActive ?? !item.endDate);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}
