import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { Menu } from 'primeng/menu';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import type { MenuItem } from 'primeng/api';

import { EmployeeHorizontalTimelineComponent } from '../components/employee-horizontal-timeline.component';
import { EmployeeDetailStore } from '../../data-access/employee-detail.store';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { EmployeeContractStore } from '../../data-access/employee-contract.store';
import { EmployeeContactStore } from '../../data-access/employee-contact.store';
import { EmployeeAddressStore } from '../../data-access/employee-address.store';
import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeLaborClassificationStore } from '../../data-access/employee-labor-classification.store';
import { EmployeeWorkingTimeStore } from '../../data-access/employee-working-time.store';
import { EmployeeCostCenterStore } from '../../data-access/employee-cost-center.store';
import { EmployeeTaxInformationStore } from '../../data-access/employee-tax-information.store';
import { EmployeeJourneyStore } from '../../data-access/employee-journey.store';
import { employeeTexts } from '../../employee.texts';
import { DISPLAY_DATE_FORMAT } from '../../../../shared/utils/local-date.util';
import { EmployeePresenceModel } from '../../models/employee-presence.model';
import { EmployeeContractModel } from '../../models/employee-contract.model';
import { readEmployeeBusinessKeyFromParamMap } from '../../routing/employee-route-key.util';
import {
  buildEmployeeDetailRouteCommands,
  EmployeeRouteSection,
} from '../../routing/employee-route-builder.util';

@Component({
  selector: 'app-employee-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MenuModule, ButtonModule, EmployeeHorizontalTimelineComponent],
  templateUrl: './employee-overview-page.component.html',
  styleUrl: './employee-overview-page.component.scss',
})
export class EmployeeOverviewPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly detailStore = inject(EmployeeDetailStore);
  private readonly presenceStore = inject(EmployeePresenceStore);
  private readonly contractStore = inject(EmployeeContractStore);
  private readonly contactStore = inject(EmployeeContactStore);
  private readonly addressStore = inject(EmployeeAddressStore);
  private readonly workCenterStore = inject(EmployeeWorkCenterStore);
  private readonly laborClassStore = inject(EmployeeLaborClassificationStore);
  private readonly workingTimeStore = inject(EmployeeWorkingTimeStore);
  private readonly costCenterStore = inject(EmployeeCostCenterStore);
  private readonly taxInfoStore = inject(EmployeeTaxInformationStore);
  private readonly journeyStore = inject(EmployeeJourneyStore);

  protected readonly actionsMenuRef = viewChild<Menu>('actionsMenu');
  protected readonly texts = employeeTexts;
  protected readonly displayDateFormat = DISPLAY_DATE_FORMAT;

  protected readonly activeEmployeeKey = toSignal(
    this.route.paramMap.pipe(map((params) => readEmployeeBusinessKeyFromParamMap(params))),
    { initialValue: readEmployeeBusinessKeyFromParamMap(this.route.snapshot.paramMap) },
  );

  protected readonly employee = this.detailStore.selectedEmployeeDetail;
  protected readonly loadingDetail = this.detailStore.loadingDetail;
  protected readonly presences = this.presenceStore.presences;
  protected readonly loadingPresences = this.presenceStore.loading;
  protected readonly contracts = this.contractStore.contracts;
  protected readonly loadingContracts = this.contractStore.loading;
  protected readonly journey = this.journeyStore.journey;
  protected readonly loadingJourney = this.journeyStore.loading;
  protected readonly journeyError = this.journeyStore.error;

  protected readonly loading = computed(
    () => this.loadingDetail() || this.loadingPresences() || this.loadingContracts(),
  );

  protected readonly status = computed(() => {
    const emp = this.employee();
    if (!emp) return null;
    const n = emp.statusLabel.trim().toLowerCase();
    return n.includes('active') || n.includes('alta') ? ('active' as const) : ('inactive' as const);
  });

  protected readonly statusLabel = computed(() => {
    const s = this.status();
    if (s === 'active') return this.texts.employeeStatusActiveLabel;
    if (s === 'inactive') return this.texts.employeeStatusInactiveLabel;
    return null;
  });

  protected readonly statusSeverity = computed(() =>
    this.status() === 'active' ? ('success' as const) : ('secondary' as const),
  );

  protected readonly activePresence = computed(() => this.resolveActivePresence(this.presences()));

  protected readonly company = computed(() => {
    const p = this.activePresence();
    if (!p) return null;
    return p.companyName?.trim() || p.companyCode.trim() || null;
  });

  protected readonly hireDate = computed(() => {
    const presences = this.presences();
    if (presences.length === 0) return null;
    return (
      [...presences].sort((a, b) => a.startDate.localeCompare(b.startDate))[0]?.startDate ?? null
    );
  });

  protected readonly activeContract = computed(() => this.resolveActiveContract(this.contracts()));

  /* ── Snapshot card computed signals ── */

  protected readonly contactCard = computed(() => ({
    count: this.contactStore.contacts().length,
    addressCount: this.addressStore.addresses().length,
    loading: this.contactStore.loading() || this.addressStore.loading(),
  }));

  protected readonly contractCard = computed(() => {
    const c = this.activeContract();
    return {
      typeName: c?.contractTypeName ?? c?.contractCode ?? null,
      startDate: c?.startDate ?? null,
      loading: this.contractStore.loading(),
    };
  });

  protected readonly activeWorkCenter = computed(() => {
    const wcs = this.workCenterStore.workCenters();
    const active = wcs.find((w) => w.isActive);
    if (!active) return null;
    return { code: active.workCenterCode, name: active.workCenterName ?? null };
  });

  protected readonly workCenterCard = computed(() => ({
    name: this.activeWorkCenter()?.name ?? this.activeWorkCenter()?.code ?? null,
    code: this.activeWorkCenter()?.code ?? null,
    loading: this.workCenterStore.loading(),
  }));

  protected readonly costCenterCard = computed(() => {
    const dist = this.costCenterStore.currentDistribution();
    const first = dist?.items?.[0] ?? null;
    return {
      name: first?.costCenterName ?? null,
      code: first?.costCenterCode ?? null,
      loading: this.costCenterStore.loading(),
    };
  });

  protected readonly activeClassification = computed(() => {
    const lcs = this.laborClassStore.laborClassifications();
    return lcs.find((lc) => lc.isActive) ?? lcs[0] ?? null;
  });

  protected readonly classificationCard = computed(() => {
    const lc = this.activeClassification();
    return {
      agreementName: lc?.agreementName ?? lc?.agreementCode ?? null,
      categoryName: lc?.agreementCategoryName ?? lc?.agreementCategoryCode ?? null,
      loading: this.laborClassStore.loading(),
    };
  });

  protected readonly activeWorkingTime = computed(() => {
    const wts = this.workingTimeStore.workingTimes();
    return wts.find((wt) => wt.isActive) ?? wts[0] ?? null;
  });

  protected readonly workingTimeCard = computed(() => {
    const wt = this.activeWorkingTime();
    return {
      weeklyHours: wt?.weeklyHours ?? null,
      percentage: wt?.workingTimePercentage ?? null,
      loading: this.workingTimeStore.loading(),
    };
  });

  protected readonly taxCard = computed(() => {
    const latest = this.taxInfoStore.latest();
    return {
      territory: latest?.taxTerritory ?? null,
      familySituation: latest?.familySituation ?? null,
      loading: this.taxInfoStore.loading(),
    };
  });

  /* ── Action menu ── */

  protected readonly actionMenuItems = computed<MenuItem[]>(() => {
    const isActive = this.status() === 'active';
    return [
      {
        label: 'Ciclo de vida',
        items: isActive
          ? [
              {
                label: 'Iniciar cese',
                icon: 'pi pi-stop-circle',
                command: () => this.navigateTo('presence'),
              },
            ]
          : [
              {
                label: 'Recontratación',
                icon: 'pi pi-replay',
                command: () => this.navigateToRehire(),
              },
            ],
      },
      {
        label: 'Laborales',
        items: [
          {
            label: 'Cambiar centro de trabajo',
            icon: 'pi pi-building',
            command: () => this.navigateTo('presence'),
          },
          {
            label: 'Nuevo contrato',
            icon: 'pi pi-file-plus',
            command: () => this.navigateTo('presence'),
          },
          { label: 'Registrar revisión salarial', icon: 'pi pi-chart-line', disabled: true },
        ],
      },
    ];
  });

  constructor() {
    effect(() => {
      this.contractStore.loadContractsByBusinessKey(this.activeEmployeeKey());
    });
    effect(() => {
      this.addressStore.loadAddressesByBusinessKey(this.activeEmployeeKey());
    });
    effect(() => {
      this.laborClassStore.loadLaborClassificationsByBusinessKey(this.activeEmployeeKey());
    });
    effect(() => {
      this.workingTimeStore.loadWorkingTimesByBusinessKey(this.activeEmployeeKey());
    });
    effect(() => {
      this.costCenterStore.loadCostCenters(this.activeEmployeeKey());
    });
    effect(() => {
      this.taxInfoStore.load(this.activeEmployeeKey());
    });
  }

  protected navigateTo(section: EmployeeRouteSection): void {
    const key = this.activeEmployeeKey();
    if (!key) return;
    void this.router.navigate(buildEmployeeDetailRouteCommands(key, section));
  }

  protected navigateToRehire(): void {
    const key = this.activeEmployeeKey();
    if (!key) return;
    void this.router.navigate([
      '/personas/empleados',
      key.ruleSystemCode,
      key.employeeTypeCode,
      key.employeeNumber,
      'rehire',
    ]);
  }

  protected showActionsMenu(event: MouseEvent): void {
    this.actionsMenuRef()?.toggle(event);
  }

  private resolveActivePresence(
    presences: ReadonlyArray<EmployeePresenceModel>,
  ): EmployeePresenceModel | null {
    if (presences.length === 0) return null;
    const active = presences.find((p) => p.isActive);
    if (active) return active;
    return [...presences].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
  }

  private resolveActiveContract(
    contracts: ReadonlyArray<EmployeeContractModel>,
  ): EmployeeContractModel | null {
    if (contracts.length === 0) return null;
    const active = contracts.find((c) => c.isActive);
    if (active) return active;
    return [...contracts].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
  }
}
