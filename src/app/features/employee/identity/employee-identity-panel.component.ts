import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

import { employeeTexts } from '../employee.texts';
import { DISPLAY_DATE_FORMAT } from '../../../shared/utils/local-date.util';
import { B4IconComponent } from '../../../shared/ui/icon/b4-icon.component';
import { B4IconName } from '../../../shared/ui/icon/icon-names';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeDetailModel } from '../models/employee-detail.model';
import {
  buildEmployeeDetailRouteCommands,
  EmployeeRelationAnchor,
  EmployeeRouteSection,
} from '../routing/employee-route-builder.util';
import { EmployeePhotoUploadDialogComponent } from '../photo/employee-photo-upload-dialog.component';
import { EmployeePhotoService } from '../data-access/employee-photo.service';
import { EmployeeDetailStore } from '../data-access/employee-detail.store';
import { EmployeePresenceStore } from '../data-access/employee-presence.store';
import { EmployeeContractStore } from '../data-access/employee-contract.store';
import { EmployeeWorkingTimeStore } from '../data-access/employee-working-time.store';
import { EmployeeLaborClassificationStore } from '../data-access/employee-labor-classification.store';
import { EmployeeWorkCenterStore } from '../data-access/employee-work-center.store';
import { EmployeeCostCenterStore } from '../data-access/employee-cost-center.store';

/**
 * Una entrada del índice. Las de la relación son anclas dentro de una misma página y llevan el
 * recuento de su carril (ADR-050 §5: el índice informa, no solo navega); las de la persona y la
 * nómina son secciones de ruta.
 */
export interface IdentityNavItem {
  id: string;
  label: string;
  icon: B4IconName;
  section: EmployeeRouteSection;
  anchor: EmployeeRelationAnchor | null;
  routeCommands: ReadonlyArray<string>;
  /** `null` cuando la entrada no cuenta nada (la línea de vida, la persona, la nómina). */
  count: number | null;
}

export interface IdentityNavGroup {
  label: string;
  items: ReadonlyArray<IdentityNavItem>;
}

/**
 * El raíl de la ficha: la identidad del empleado y el índice de la página. El índice no se
 * pliega a iconos (ADR-050 §4): es un sumario que se lee de reojo y se aprieta con tipografía.
 */
@Component({
  selector: 'app-employee-identity-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    TagModule,
    ButtonModule,
    B4IconComponent,
    EmployeePhotoUploadDialogComponent,
  ],
  templateUrl: './employee-identity-panel.component.html',
  styleUrl: './employee-identity-panel.component.scss',
})
export class EmployeeIdentityPanelComponent {
  readonly employeeKey = input.required<EmployeeBusinessKey>();
  readonly employee = input<EmployeeDetailModel | null>(null);
  readonly hireDate = input<string | null>(null);
  readonly status = input<'ACTIVE' | 'TERMINATED'>('TERMINATED');
  readonly isAdmin = input(false);
  /** La sección de ruta activa y, dentro de la relación, el ancla activa. */
  readonly activeSection = input<EmployeeRouteSection>('relacion');
  readonly activeAnchor = input<EmployeeRelationAnchor | null>(null);

  readonly editIdentityRequested = output<void>();

  protected readonly texts = employeeTexts;
  protected readonly displayDateFormat = DISPLAY_DATE_FORMAT;
  protected readonly uploadDialogVisible = signal(false);

  private readonly photoService = inject(EmployeePhotoService);
  private readonly detailStore = inject(EmployeeDetailStore);
  private readonly presenceStore = inject(EmployeePresenceStore);
  private readonly contractStore = inject(EmployeeContractStore);
  private readonly workingTimeStore = inject(EmployeeWorkingTimeStore);
  private readonly laborClassificationStore = inject(EmployeeLaborClassificationStore);
  private readonly workCenterStore = inject(EmployeeWorkCenterStore);
  private readonly costCenterStore = inject(EmployeeCostCenterStore);

  protected readonly initials = computed(() => {
    const name = this.employee()?.displayName ?? '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase() || '?';
  });

  protected readonly photoUrl = computed(() => this.employee()?.photoUrl ?? null);

  protected readonly navGroups = computed<ReadonlyArray<IdentityNavGroup>>(() => {
    const key = this.employeeKey();
    const t = this.texts;
    const relation = buildEmployeeDetailRouteCommands(key, 'relacion');
    const lane = (
      anchor: EmployeeRelationAnchor,
      label: string,
      icon: B4IconName,
      count: number | null,
    ): IdentityNavItem => ({
      id: anchor,
      label,
      icon,
      section: 'relacion',
      anchor,
      routeCommands: relation,
      count,
    });
    const costWindows =
      (this.costCenterStore.history()?.length ?? 0) + (this.costCenterStore.currentDistribution() ? 1 : 0);
    return [
      {
        label: t.relationAreaLabel,
        items: [
          lane('lifeline', t.lifelineTitle, 'periodo', null),
          lane('presence', t.lifelineLanePresence, 'empleado', this.presenceStore.presences().length),
          lane('contract', t.lifelineLaneContract, 'documento-nuevo', this.contractStore.contracts().length),
          lane('working-time', t.lifelineLaneWorkingTime, 'jornada', this.workingTimeStore.workingTimes().length),
          lane('classification', t.lifelineLaneClassification, 'convenio', this.laborClassificationStore.laborClassifications().length),
          lane('work-center', t.lifelineLaneWorkCenter, 'centro-trabajo', this.workCenterStore.workCenters().length),
          lane('cost-center', t.costCenterSectionTitle, 'centro-coste', costWindows),
        ],
      },
      {
        label: t.personAreaLabel,
        items: [
          {
            id: 'contact',
            label: t.personalAreaLabel,
            icon: 'usuario',
            section: 'contact',
            anchor: null,
            routeCommands: buildEmployeeDetailRouteCommands(key, 'contact'),
            count: null,
          },
        ],
      },
      {
        label: t.payrollAreaLabel,
        items: [
          {
            id: 'payroll',
            label: t.payrollAreaLabel,
            icon: 'nomina',
            section: 'payroll',
            anchor: null,
            routeCommands: buildEmployeeDetailRouteCommands(key, 'payroll'),
            count: null,
          },
        ],
      },
    ];
  });

  /** Plano, para quien solo quiera recorrer las entradas (los tests, por ejemplo). */
  protected readonly navItems = computed(() => this.navGroups().flatMap((group) => group.items));

  protected readonly statusSeverity = computed(() =>
    this.status() === 'ACTIVE' ? 'success' : 'danger',
  );

  protected readonly statusLabel = computed(() =>
    this.status() === 'ACTIVE'
      ? this.texts.employeeStatusActiveLabel
      : this.texts.employeeStatusInactiveLabel,
  );

  protected isActive(item: IdentityNavItem): boolean {
    if (item.section !== this.activeSection()) return false;
    if (item.anchor === null) return true;
    // Dentro de la relación, sin ancla en la URL, la activa es la línea de vida.
    return item.anchor === (this.activeAnchor() ?? 'lifeline');
  }

  protected requestEditIdentity(): void {
    this.editIdentityRequested.emit();
  }

  protected copyMatricula(): void {
    void navigator.clipboard.writeText(this.employeeKey().employeeNumber);
  }

  protected openUploadDialog(): void {
    if (!this.isAdmin()) return;
    this.uploadDialogVisible.set(true);
  }

  protected onPhotoConfirmed(): void {
    this.detailStore.refreshEmployeeDetailByBusinessKey(this.employeeKey());
  }

  protected deletePhoto(): void {
    this.photoService.deletePhoto(this.employeeKey()).subscribe({
      next: () => this.detailStore.refreshEmployeeDetailByBusinessKey(this.employeeKey()),
    });
  }
}
