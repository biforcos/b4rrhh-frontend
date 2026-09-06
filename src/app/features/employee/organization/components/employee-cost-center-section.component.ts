import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { take } from 'rxjs';

import { EmployeeCostCenterStore } from '../../data-access/employee-cost-center.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { CostCenterPlanDraft } from '../../data-access/employee-cost-center.mapper';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeCostCenterWindowModel } from '../../models/employee-cost-center.model';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import {
  PeriodModalComponent,
  PeriodModalNoteTone,
} from '../../shared/ui/period-modal/period-modal.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import {
  COST_CENTER_PLAN_VOCABULARY,
  describeCorrectionSwitchAction,
  describeTimelinePlan,
} from '../../shared/utils/timeline-plan-message.util';
import {
  CostCenterDistributionDraft,
  EmployeeCostCenterDistributionEditorComponent,
} from './employee-cost-center-distribution-editor.component';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';

/**
 * Las tres cosas que se pueden hacer con la serie de distribuciones (ADR-057): añadir una
 * ventana con inicio y fin, corregir sus fechas o sus líneas, y borrarla. No hay «cerrar» ni
 * «sustituir desde fecha»: añadir la siguiente ya cierra la vigente el día anterior. La
 * ocurrencia es la ventana —el conjunto de líneas que comparten fecha de inicio—, no la línea.
 *
 * Es la única serie del producto con **cobertura opcional** (`backend#54`): borrar una de en
 * medio se acepta y deja un hueco, que es un estado legal. El aviso lo dice con esas palabras y
 * no copia el de las verticales obligatorias, que dice lo contrario.
 */
type CostCenterModalMode = 'add' | 'correct' | 'remove';

interface CostCenterPeriodRow extends TemporalSectionRow {
  window: EmployeeCostCenterWindowModel;
  totalPercentage: number;
  itemsSummary: string;
}

@Component({
  selector: 'app-employee-cost-center-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TemporalSectionComponent,
    PeriodModalComponent,
    EmployeeCostCenterDistributionEditorComponent,
    UiDateInputComponent,
  ],
  templateUrl: './employee-cost-center-section.component.html',
})
export class EmployeeCostCenterSectionComponent {
  readonly employeeKey = input<EmployeeBusinessKey | null>(null);

  protected readonly costCenterStore = inject(EmployeeCostCenterStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);

  protected readonly editorRef = viewChild(EmployeeCostCenterDistributionEditorComponent);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<CostCenterModalMode>('add');
  /** La ventana que se corrige o se borra, nombrada por el día en que empieza hoy. */
  protected readonly editingStartDate = signal<string | null>(null);
  protected readonly editingPeriod = signal<string | null>(null);
  protected readonly startDateDraft = signal(currentLocalDate());
  /** Vacía para una ventana que queda en vigor. */
  protected readonly endDateDraft = signal('');
  /** Las líneas con las que abre el editor; null para una ventana nueva. */
  protected readonly editorInitialValue = signal<CostCenterDistributionDraft | null>(null);
  protected readonly costCenterOptions = signal<ReadonlyArray<SlotKeyOption<string>>>([]);

  protected readonly texts = employeeTexts;

  protected readonly rows = computed<ReadonlyArray<CostCenterPeriodRow>>(() => {
    const current = this.costCenterStore.currentDistribution();
    const history = this.costCenterStore.history() ?? [];
    const seen = new Set<string>();
    const all: EmployeeCostCenterWindowModel[] = [];
    if (current) {
      all.push(current);
      seen.add(`${current.startDate}|${current.endDate ?? ''}`);
    }
    for (const w of history) {
      const key = `${w.startDate}|${w.endDate ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(w);
    }
    // Corregir y borrar se ofrecen en todas las ventanas: lo que se puede hacer lo dice el plan.
    return all.map((w) => ({
      startDate: w.startDate,
      endDate: w.endDate ?? null,
      isActive: !w.endDate,
      canEdit: true,
      canDelete: true,
      window: w,
      totalPercentage: w.totalAllocationPercentage,
      itemsSummary: w.items
        .map((i) => `${i.costCenterName || i.costCenterCode} (${i.allocationPercentage}%)`)
        .join(', '),
    }));
  });

  protected readonly saving = computed(() => this.costCenterStore.mutating());

  /** El cambio que se planificaría con lo que hay en el formulario; null si aún no está completo. */
  protected readonly planDraft = computed<CostCenterPlanDraft | null>(() => {
    if (!this.modalVisible()) return null;
    const mode = this.modalMode();
    const windowStartDate = this.editingStartDate();

    if (mode === 'remove') {
      return windowStartDate === null ? null : { operation: 'REMOVE', windowStartDate };
    }

    const startDate = this.startDateDraft();
    if (!startDate) return null;
    const endDate = this.endDateDraft() || null;

    if (mode === 'add') return { operation: 'ADD', startDate, endDate };
    return windowStartDate === null
      ? null
      : { operation: 'CORRECT', windowStartDate, startDate, endDate };
  });

  protected readonly plan = computed(() => this.costCenterStore.plan());

  protected readonly planNotice = computed(() => {
    const plan = this.plan();
    return plan ? describeTimelinePlan(plan, COST_CENTER_PLAN_VOCABULARY) : null;
  });

  protected readonly noteLines = computed<ReadonlyArray<string>>(() => {
    if (this.costCenterStore.planning()) return [this.texts.costCenterSectionPlanningMessage];
    return this.planNotice()?.lines ?? [];
  });

  protected readonly noteTone = computed<PeriodModalNoteTone>(
    () => this.planNotice()?.tone ?? 'info',
  );

  protected readonly correctionOffer = computed<string | null>(() => {
    const plan = this.plan();
    if (!plan || plan.rejection !== 'IS_A_CORRECTION' || !plan.correctedOccurrence) return null;
    return describeCorrectionSwitchAction(plan.correctedOccurrence, COST_CENTER_PLAN_VOCABULARY);
  });

  protected readonly modalTitle = computed(() => {
    const mode = this.modalMode();
    if (mode === 'add') return this.texts.costCenterSectionAddTitle;
    if (mode === 'remove') return this.texts.costCenterSectionRemoveTitle;
    return this.texts.costCenterSectionCorrectTitle;
  });

  protected readonly submitLabel = computed(() => {
    const mode = this.modalMode();
    if (mode === 'add') return this.texts.costCenterSectionAddSubmitAction;
    if (mode === 'remove') return this.texts.costCenterSectionRemoveSubmitAction;
    return this.texts.costCenterSectionCorrectSubmitAction;
  });

  protected readonly modalSubtitle = computed(() => this.editingPeriod());

  /** Solo se confirma lo que el backend ya ha dicho que puede aplicar. */
  protected readonly isSubmitEnabled = computed(() => {
    if (!this.planDraft()) return false;
    return this.plan()?.accepted === true;
  });

  constructor() {
    effect(() => {
      const key = this.employeeKey();
      untracked(() => {
        this.costCenterStore.loadCostCenters(key);
        this.loadCostCenterOptions(key?.ruleSystemCode ?? null);
      });
    });

    effect(() => {
      const success = this.costCenterStore.success();
      if (success)
        untracked(() => {
          if (this.modalVisible()) this.closeModal();
        });
    });

    // Cada cambio de fechas vuelve a pedir el plan: lo que se enseña es siempre lo que pasaría
    // con lo que hay escrito ahora. Las líneas no entran: el plan es de la ventana.
    effect(() => {
      const key = this.employeeKey();
      const draft = this.planDraft();
      untracked(() => {
        if (key && draft) this.costCenterStore.planChange(key, draft);
        else this.costCenterStore.clearPlan();
      });
    });
  }

  protected openAdd(): void {
    this.costCenterStore.clearFeedback();
    this.modalMode.set('add');
    this.editingStartDate.set(null);
    this.editingPeriod.set(null);
    this.startDateDraft.set(currentLocalDate());
    this.endDateDraft.set('');
    this.editorInitialValue.set(null);
    this.modalVisible.set(true);
  }

  protected openCorrect(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.costCenterStore.clearFeedback();
    this.modalMode.set('correct');
    this.editingStartDate.set(row.startDate);
    this.editingPeriod.set(this.describeDates(row.startDate, row.endDate));
    this.startDateDraft.set(row.startDate);
    this.endDateDraft.set(row.endDate ?? '');
    this.editorInitialValue.set({
      startDate: row.startDate,
      items: row.window.items.map((item) => ({
        costCenterCode: item.costCenterCode,
        allocationPercentage: item.allocationPercentage,
      })),
    });
    this.modalVisible.set(true);
  }

  protected openRemove(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.costCenterStore.clearFeedback();
    this.modalMode.set('remove');
    this.editingStartDate.set(row.startDate);
    this.editingPeriod.set(this.describeDates(row.startDate, row.endDate));
    this.modalVisible.set(true);
  }

  /** Del rechazo al camino: se corrige la ventana que el backend nombra, con lo ya escrito. */
  protected switchToCorrection(): void {
    const corrected = this.plan()?.correctedOccurrence;
    if (!corrected) return;
    this.modalMode.set('correct');
    this.editingStartDate.set(corrected.startDate);
    this.editingPeriod.set(this.describeDates(corrected.startDate, corrected.endDate));
  }

  protected submit(): void {
    const key = this.employeeKey();
    if (!key || !this.isSubmitEnabled() || this.costCenterStore.mutating()) return;

    const mode = this.modalMode();
    const windowStartDate = this.editingStartDate();

    if (mode === 'remove') {
      if (windowStartDate !== null) this.costCenterStore.deleteDistribution(key, windowStartDate);
      return;
    }

    const editor = this.editorRef();
    if (!editor || !editor.isValid()) return;
    const items = editor.getValue().items;

    if (mode === 'add') {
      this.costCenterStore.createDistribution(key, {
        startDate: this.startDateDraft(),
        endDate: this.endDateDraft(),
        items,
      });
      return;
    }

    if (windowStartDate !== null) {
      this.costCenterStore.correctDistribution(key, windowStartDate, {
        startDate: this.startDateDraft(),
        endDate: this.endDateDraft(),
        items,
      });
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.costCenterStore.clearPlan();
    this.costCenterStore.clearFeedback();
  }

  private describeDates(startDate: string, endDate: string | null): string {
    const start = formatDisplayDate(startDate);
    return endDate
      ? `Del ${start} al ${formatDisplayDate(endDate)}`
      : `Desde el ${start}, en vigor`;
  }

  private loadCostCenterOptions(ruleSystemCode: string | null): void {
    if (!ruleSystemCode) {
      this.costCenterOptions.set([]);
      return;
    }
    this.fieldCatalogService
      .loadCostCenterOptions(ruleSystemCode)
      .pipe(take(1))
      .subscribe({
        next: (opts) => this.costCenterOptions.set(opts),
      });
  }
}
