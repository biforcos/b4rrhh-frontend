import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { employeeTexts } from '../employee.texts';
import { B4IconComponent } from '../../../shared/ui/icon/b4-icon.component';
import { B4IconName } from '../../../shared/ui/icon/icon-names';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import {
  buildEmployeeDetailRouteCommands,
  EmployeeRouteSection,
  EmployeeSectionAnchor,
  employeeSectionAnchors,
} from '../routing/employee-route-builder.util';
import { EmployeePresenceStore } from '../data-access/employee-presence.store';
import { EmployeeContractStore } from '../data-access/employee-contract.store';
import { EmployeeWorkingTimeStore } from '../data-access/employee-working-time.store';
import { EmployeeLaborClassificationStore } from '../data-access/employee-labor-classification.store';
import { EmployeeWorkCenterStore } from '../data-access/employee-work-center.store';
import { EmployeeCostCenterStore } from '../data-access/employee-cost-center.store';
import { EmployeeExtraPaymentRegimeStore } from '../data-access/employee-extra-payment-regime.store';
import { EmployeeAbsenceStore } from '../data-access/employee-absence.store';
import { EmployeeRetroMarkStore } from '../data-access/employee-retro-mark.store';

/**
 * Qué significa que una sección esté vacía (ADR-050 §5). Lo decide el dominio y lo declara la
 * sección; el panel no lo adivina del recuento. `'normal'`: no hay nada que ver. `'anomalia'`:
 * falta un dato que debería estar, y se marca en ocre para que se vea de reojo.
 */
export type IdentityNavEmptyMeaning = 'normal' | 'anomalia';

/**
 * Una entrada del índice: un ancla dentro de la página de su grupo, con el recuento de lo que hay
 * (ADR-050 §5: el índice informa, no solo navega), o una sección de ruta entera.
 */
export interface IdentityNavItem {
  id: string;
  label: string;
  icon: B4IconName;
  section: EmployeeRouteSection;
  anchor: EmployeeSectionAnchor | null;
  routeCommands: ReadonlyArray<string>;
  /** `null` cuando la entrada no cuenta nada (la línea de vida, la persona, los recibos). */
  count: number | null;
  /** Qué significa su vacío; `'normal'` si no se dice. */
  emptyMeans?: IdentityNavEmptyMeaning;
}

export interface IdentityNavGroup {
  label: string;
  items: ReadonlyArray<IdentityNavItem>;
}

/**
 * El raíl de la ficha: el índice de la página (frontend#24 le quitó la identidad, que ahora va
 * en la barra de arriba). No se pliega a iconos (ADR-050 §4): es un sumario que se lee de reojo y
 * se aprieta con tipografía; y como ya no lleva nada que no pueda esconderse, puede plegarse
 * entero con el raíl.
 */
@Component({
  selector: 'app-employee-index-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, B4IconComponent],
  templateUrl: './employee-index-panel.component.html',
  styleUrl: './employee-index-panel.component.scss',
})
export class EmployeeIndexPanelComponent {
  readonly employeeKey = input.required<EmployeeBusinessKey>();
  /** La sección de ruta activa y, dentro de ella, el ancla activa. */
  readonly activeSection = input<EmployeeRouteSection>('relacion');
  readonly activeAnchor = input<EmployeeSectionAnchor | null>(null);

  protected readonly texts = employeeTexts;

  private readonly presenceStore = inject(EmployeePresenceStore);
  private readonly contractStore = inject(EmployeeContractStore);
  private readonly workingTimeStore = inject(EmployeeWorkingTimeStore);
  private readonly laborClassificationStore = inject(EmployeeLaborClassificationStore);
  private readonly workCenterStore = inject(EmployeeWorkCenterStore);
  private readonly costCenterStore = inject(EmployeeCostCenterStore);
  private readonly extraPaymentRegimeStore = inject(EmployeeExtraPaymentRegimeStore);
  private readonly absenceStore = inject(EmployeeAbsenceStore);
  private readonly retroMarkStore = inject(EmployeeRetroMarkStore);

  constructor() {
    // El raíl carga lo que cuenta (`b4rrhh/frontend#90`). Antes contaba lo que otra página hubiera
    // cargado, y estando en «Nómina» la jornada y el convenio salían a 0 en un empleado que tenía
    // dos de cada. Los stores no repiten la petición para la misma clave. La única dependencia es la
    // clave: lo que los stores escriben al cargar no puede serlo (frontend#44).
    effect(() => {
      const key = this.employeeKey();
      untracked(() => {
        this.contractStore.loadContractsByBusinessKey(key);
        this.workingTimeStore.loadWorkingTimesByBusinessKey(key);
        this.laborClassificationStore.loadLaborClassificationsByBusinessKey(key);
        this.costCenterStore.loadCostCenters(key);
        this.extraPaymentRegimeStore.loadExtraPaymentRegimesByBusinessKey(key);
        this.absenceStore.loadAbsences(key);
        this.retroMarkStore.loadMarks(key);
      });
    });
  }

  protected readonly navGroups = computed<ReadonlyArray<IdentityNavGroup>>(() => {
    const key = this.employeeKey();
    const t = this.texts;
    const entry =
      (section: EmployeeRouteSection) =>
      (
        anchor: EmployeeSectionAnchor,
        label: string,
        icon: B4IconName,
        count: number | null,
        emptyMeans: IdentityNavEmptyMeaning = 'normal',
      ): IdentityNavItem => ({
        id: anchor,
        label,
        icon,
        section,
        anchor,
        routeCommands: buildEmployeeDetailRouteCommands(key, section),
        count,
        emptyMeans,
      });
    const person = entry('persona');
    const lane = entry('relacion');
    const month = entry('mes');
    const costWindows =
      (this.costCenterStore.history()?.length ?? 0) +
      (this.costCenterStore.currentDistribution() ? 1 : 0);
    return [
      {
        label: t.personAreaLabel,
        items: [
          person('personal', t.personalAreaLabel, 'usuario', null),
          person('tax-information', t.taxInformationNavLabel, 'catalogo', null),
        ],
      },
      {
        label: t.relationAreaLabel,
        items: [
          lane('lifeline', t.lifelineTitle, 'periodo', null),
          lane(
            'presence',
            t.lifelineLanePresence,
            'empleado',
            this.presenceStore.presences().length,
          ),
          lane(
            'contract',
            t.lifelineLaneContract,
            'documento-nuevo',
            this.contractStore.contracts().length,
          ),
          lane(
            'working-time',
            t.lifelineLaneWorkingTime,
            'jornada',
            this.workingTimeStore.workingTimes().length,
          ),
          lane(
            'classification',
            t.lifelineLaneClassification,
            'convenio',
            this.laborClassificationStore.laborClassifications().length,
          ),
          lane(
            'work-center',
            t.lifelineLaneWorkCenter,
            'centro-trabajo',
            this.workCenterStore.workCenters().length,
          ),
          // Un empleado sin centro de coste es un dato que falta, no una sección sin nada que ver:
          // la misma anomalía que el bloque «Hoy» ya marca en ocre.
          lane('cost-center', t.costCenterSectionTitle, 'centro-coste', costWindows, 'anomalia'),
          lane(
            'extra-payment-regime',
            t.extraPaymentRegimeNavLabel,
            'nomina',
            this.extraPaymentRegimeStore.extraPaymentRegimes().length,
          ),
        ],
      },
      {
        label: t.monthAreaLabel,
        items: [
          month('absence', t.absencesSectionTitle, 'periodo', this.absenceStore.absences().length),
          // Sin contador: las entradas son de un mes, y el raíl no sabe de cuál se está hablando.
          month('payroll-inputs', t.payrollInputsSectionTitle, 'operacion', null),
          month('retro-marks', t.retroMarksNavLabel, 'editar', this.retroMarkStore.marks().length),
        ],
      },
      {
        label: t.receiptsAreaLabel,
        items: [
          {
            id: 'receipts',
            label: t.payrollReceiptsTitle,
            icon: 'recibo',
            section: 'recibos',
            anchor: null,
            routeCommands: buildEmployeeDetailRouteCommands(key, 'recibos'),
            count: null,
          },
        ],
      },
    ];
  });

  /** Plano, para quien solo quiera recorrer las entradas (los tests, por ejemplo). */
  protected readonly navItems = computed(() => this.navGroups().flatMap((group) => group.items));

  /** Vacío que es una anomalía: recuento a cero en una sección que declaró que eso es que falta algo. */
  protected isEmptyAnomaly(item: IdentityNavItem): boolean {
    return item.count === 0 && item.emptyMeans === 'anomalia';
  }

  protected isActive(item: IdentityNavItem): boolean {
    if (item.section !== this.activeSection()) return false;
    if (item.anchor === null) return true;
    // Sin ancla en la URL, la activa es la primera de la sección (en la relación, la línea de vida).
    return item.anchor === (this.activeAnchor() ?? employeeSectionAnchors[item.section][0]);
  }
}
