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
  /** El código del valor, debajo y en gris. */
  code: string | null;
  /** Desde cuándo rige, ya formateada. */
  since: string | null;
  /** Sin vigencia: lo normal («sin vigencia») o una anomalía que hay que ver («sin asignar»). */
  emptyLabel: string;
  anomaly: boolean;
}

const HOURS = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

/**
 * El bloque «Hoy» (frontend#25): qué es verdad hoy, una línea por vigencia, entre la línea de
 * vida y la historia. Es el borde derecho de la línea de vida, escrito: el gráfico enseña la
 * forma; el bloque da el valor, que es lo que se copia y se pega. El orden es el de los carriles
 * del eje, del índice y de las secciones, para saltar de uno a otro sin releer.
 *
 * Y es donde aparece lo anómalo: un empleado sin centro de coste es un problema de imputación, y
 * aquí se lee «sin asignar» en tono de aviso.
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
    const since = (item: { startDate: string } | null) => (item ? formatDisplayDate(item.startDate) : null);
    return [
      {
        anchor: 'presence',
        icon: 'empleado',
        label: t.lifelineLanePresence,
        value: presence ? (presence.companyName ?? presence.companyCode) : null,
        code: presence?.companyName ? presence.companyCode : null,
        since: since(presence),
        emptyLabel: t.todayNoneLabel,
        anomaly: false,
      },
      {
        anchor: 'contract',
        icon: 'documento-nuevo',
        label: t.lifelineLaneContract,
        value: contract ? (contract.contractTypeName ?? contract.contractCode) : null,
        code: contract ? `${contract.contractCode}${contract.contractSubtypeCode ? ` / ${contract.contractSubtypeCode}` : ''}` : null,
        since: since(contract),
        emptyLabel: t.todayNoneLabel,
        anomaly: false,
      },
      {
        anchor: 'working-time',
        icon: 'jornada',
        label: t.lifelineLaneWorkingTime,
        value: workingTime ? `${workingTime.workingTimePercentage} % · ${HOURS.format(workingTime.weeklyHours)} ${t.lifelineHoursPerWeekLabel}` : null,
        code: workingTime ? `${HOURS.format(workingTime.dailyHours)} ${t.todayHoursPerDayLabel}` : null,
        since: since(workingTime),
        emptyLabel: t.todayNoneLabel,
        anomaly: false,
      },
      {
        anchor: 'classification',
        icon: 'convenio',
        label: t.lifelineLaneClassification,
        value: classification ? (classification.agreementCategoryName ?? classification.agreementCategoryCode) : null,
        code: classification
          ? `${classification.agreementCode}${classification.grupoCotizacionCode ? ` · ${t.lifelineContributionGroupLabel} ${classification.grupoCotizacionCode}` : ''}`
          : null,
        since: since(classification),
        emptyLabel: t.todayNoneLabel,
        anomaly: false,
      },
      {
        anchor: 'work-center',
        icon: 'centro-trabajo',
        label: t.lifelineLaneWorkCenter,
        value: workCenter ? (workCenter.workCenterName ?? workCenter.workCenterCode) : null,
        code: workCenter?.workCenterName ? workCenter.workCenterCode : null,
        since: since(workCenter),
        emptyLabel: t.todayNoneLabel,
        anomaly: false,
      },
      {
        anchor: 'cost-center',
        icon: 'centro-coste',
        label: t.costCenterSectionTitle,
        value: cost ? cost.items.map((i) => `${i.costCenterName || i.costCenterCode} ${i.allocationPercentage} %`).join(' · ') : null,
        code: cost ? `${cost.totalAllocationPercentage} % ${t.todayAllocatedLabel}` : null,
        since: since(cost),
        emptyLabel: t.todayUnassignedLabel,
        anomaly: true,
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
