import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { take } from 'rxjs';

import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { WorkCenterPlanDraft } from '../../data-access/employee-work-center.mapper';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeWorkCenterModel } from '../../models/employee-work-center.model';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { UiCatalogLabelComponent } from '../../../../shared/ui/catalog-label/ui-catalog-label.component';
import {
  PeriodModalComponent,
  PeriodModalNoteTone,
} from '../../shared/ui/period-modal/period-modal.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import {
  WORK_CENTER_PLAN_VOCABULARY,
  describeCorrectionSwitchAction,
  describeTimelinePlan,
} from '../../shared/utils/timeline-plan-message.util';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';

/**
 * Las tres cosas que se pueden hacer con la serie de centros de trabajo (ADR-057): añadir una
 * asignación con inicio y fin, corregir las fechas o el centro de una, y borrarla. No hay
 * «cerrar»: añadir la siguiente ya cierra la vigente el día anterior, y cualquier otra fecha fin
 * es una corrección. El plan viene del backend; aquí no se comprueba ningún invariante.
 *
 * El alta que empieza el mismo día que una existente no la sustituye en silencio: vuelve como
 * `IS_A_CORRECTION` nombrándola, y desde el aviso se pasa a corregirla.
 */
type WorkCenterModalMode = 'add' | 'correct' | 'remove';

interface WorkCenterPeriodRow extends TemporalSectionRow {
  assignmentNumber: number;
  workCenterCode: string;
  workCenterName: string | null;
}

@Component({
  selector: 'app-employee-work-center-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TemporalSectionComponent,
    PeriodModalComponent,
    UiDateInputComponent,
    UiSelectComponent,
    UiCatalogLabelComponent,
  ],
  templateUrl: './employee-work-center-section.component.html',
})
export class EmployeeWorkCenterSectionComponent {
  readonly employeeKey = input<EmployeeBusinessKey | null>(null);

  private readonly workCenterStore = inject(EmployeeWorkCenterStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<WorkCenterModalMode>('add');
  /** La asignación que se corrige o se borra. */
  protected readonly editingNumber = signal<number | null>(null);
  protected readonly editingPeriod = signal<string | null>(null);
  protected readonly startDateDraft = signal(currentLocalDate());
  /** Vacía para una asignación que queda en vigor. */
  protected readonly endDateDraft = signal('');
  protected readonly workCenterCodeDraft = signal('');
  protected readonly workCenterOptions = signal<ReadonlyArray<SlotKeyOption<string>>>([]);

  protected readonly texts = employeeTexts;

  // Corregir y borrar se ofrecen en todas las filas: si el cambio deja un hueco lo dice el plan,
  // con fechas, y no un botón escondido (ADR-057 §3).
  protected readonly rows = computed<ReadonlyArray<WorkCenterPeriodRow>>(() =>
    this.workCenterStore.workCenters().map((wc: EmployeeWorkCenterModel) => ({
      startDate: wc.startDate,
      endDate: wc.endDate,
      isActive: wc.isActive,
      canEdit: true,
      canDelete: true,
      assignmentNumber: wc.workCenterAssignmentNumber,
      workCenterCode: wc.workCenterCode,
      workCenterName: wc.workCenterName ?? null,
    })),
  );

  protected readonly saving = computed(() => this.workCenterStore.mutating());

  /** El cambio que se planificaría con lo que hay en el formulario; null si aún no está completo. */
  protected readonly planDraft = computed<WorkCenterPlanDraft | null>(() => {
    if (!this.modalVisible()) return null;
    const mode = this.modalMode();
    const workCenterAssignmentNumber = this.editingNumber();

    if (mode === 'remove') {
      return workCenterAssignmentNumber === null
        ? null
        : { operation: 'REMOVE', workCenterAssignmentNumber };
    }

    const startDate = this.startDateDraft();
    if (!startDate) return null;
    const endDate = this.endDateDraft() || null;

    if (mode === 'add') return { operation: 'ADD', startDate, endDate };
    return workCenterAssignmentNumber === null
      ? null
      : { operation: 'CORRECT', workCenterAssignmentNumber, startDate, endDate };
  });

  protected readonly plan = computed(() => this.workCenterStore.plan());

  protected readonly planNotice = computed(() => {
    const plan = this.plan();
    return plan ? describeTimelinePlan(plan, WORK_CENTER_PLAN_VOCABULARY) : null;
  });

  protected readonly noteLines = computed<ReadonlyArray<string>>(() => {
    if (this.workCenterStore.planning()) return [this.texts.workCenterSectionPlanningMessage];
    return this.planNotice()?.lines ?? [];
  });

  protected readonly noteTone = computed<PeriodModalNoteTone>(
    () => this.planNotice()?.tone ?? 'info',
  );

  protected readonly correctionOffer = computed<string | null>(() => {
    const plan = this.plan();
    if (!plan || plan.rejection !== 'IS_A_CORRECTION') return null;
    const corrected = plan.correctedOccurrence;
    if (!corrected || corrected.workCenterAssignmentNumber === null) return null;
    return describeCorrectionSwitchAction(corrected, WORK_CENTER_PLAN_VOCABULARY);
  });

  protected readonly modalTitle = computed(() => {
    const mode = this.modalMode();
    if (mode === 'add') return this.texts.workCenterSectionAddTitle;
    if (mode === 'remove') return this.texts.workCenterSectionRemoveTitle;
    return this.texts.workCenterSectionCorrectTitle;
  });

  protected readonly submitLabel = computed(() => {
    const mode = this.modalMode();
    if (mode === 'add') return this.texts.workCenterSectionAddSubmitAction;
    if (mode === 'remove') return this.texts.workCenterSectionRemoveSubmitAction;
    return this.texts.workCenterSectionCorrectSubmitAction;
  });

  protected readonly modalSubtitle = computed(() => this.editingPeriod());

  /** Solo se confirma lo que el backend ya ha dicho que puede aplicar. */
  protected readonly isSubmitEnabled = computed(() => {
    if (!this.planDraft()) return false;
    if (this.modalMode() !== 'remove' && !this.workCenterCodeDraft()) return false;
    return this.plan()?.accepted === true;
  });

  constructor() {
    effect(() => {
      const key = this.employeeKey();
      untracked(() => {
        this.workCenterStore.loadWorkCenters(key);
        this.loadWorkCenterOptions(key?.ruleSystemCode ?? null, this.startDateDraft());
      });
    });

    effect(() => {
      const success = this.workCenterStore.success();
      if (success)
        untracked(() => {
          if (this.modalVisible()) this.closeModal();
        });
    });

    // Cada cambio del formulario vuelve a pedir el plan: lo que se enseña es siempre lo que
    // pasaría con lo que hay escrito ahora.
    effect(() => {
      const key = this.employeeKey();
      const draft = this.planDraft();
      untracked(() => {
        if (key && draft) this.workCenterStore.planChange(key, draft);
        else this.workCenterStore.clearPlan();
      });
    });
  }

  /**
   * La fecha del periodo que se edita cambia, y con ella la pregunta por la vigencia: el
   * catalogo se vuelve a pedir para esa fecha (b4rrhh/frontend#32).
   *
   * Se hace aqui y no en un effect que siga a startDateDraft a proposito: escribir las
   * opciones desde un effect que la deteccion de cambios acaba de disparar deja la pantalla
   * pidiendo otra vuelta, y eso puso flaky al spec de la seccion.
   */
  protected updateStartDate(value: string): void {
    this.startDateDraft.set(value);
    this.loadWorkCenterOptions(this.employeeKey()?.ruleSystemCode ?? null, value);
  }

  protected openAdd(): void {
    this.workCenterStore.clearFeedback();
    this.modalMode.set('add');
    this.editingNumber.set(null);
    this.editingPeriod.set(null);
    this.startDateDraft.set(currentLocalDate());
    this.endDateDraft.set('');
    this.workCenterCodeDraft.set('');
    this.loadWorkCenterOptions(this.employeeKey()?.ruleSystemCode ?? null, this.startDateDraft());
    this.modalVisible.set(true);
  }

  protected openCorrect(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.workCenterStore.clearFeedback();
    this.modalMode.set('correct');
    this.editingNumber.set(row.assignmentNumber);
    this.editingPeriod.set(this.describeDates(row.startDate, row.endDate));
    this.workCenterCodeDraft.set(row.workCenterCode);
    this.startDateDraft.set(row.startDate);
    this.endDateDraft.set(row.endDate ?? '');
    this.loadWorkCenterOptions(this.employeeKey()?.ruleSystemCode ?? null, this.startDateDraft());
    this.modalVisible.set(true);
  }

  protected openRemove(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.workCenterStore.clearFeedback();
    this.modalMode.set('remove');
    this.editingNumber.set(row.assignmentNumber);
    this.editingPeriod.set(this.describeDates(row.startDate, row.endDate));
    this.modalVisible.set(true);
  }

  /** Del rechazo al camino: se corrige la asignación que el backend nombra, con lo ya escrito. */
  protected switchToCorrection(): void {
    const corrected = this.plan()?.correctedOccurrence;
    if (!corrected || corrected.workCenterAssignmentNumber === null) return;
    this.modalMode.set('correct');
    this.editingNumber.set(corrected.workCenterAssignmentNumber);
    this.editingPeriod.set(this.describeDates(corrected.startDate, corrected.endDate));
  }

  protected submit(): void {
    const key = this.employeeKey();
    if (!key || !this.isSubmitEnabled() || this.workCenterStore.mutating()) return;

    const mode = this.modalMode();
    if (mode === 'add') {
      this.workCenterStore.createWorkCenter(key, {
        workCenterCode: this.workCenterCodeDraft(),
        startDate: this.startDateDraft(),
        endDate: this.endDateDraft(),
      });
      return;
    }

    const assignmentNumber = this.editingNumber();
    if (assignmentNumber === null) return;

    if (mode === 'remove') {
      this.workCenterStore.deleteWorkCenter(key, assignmentNumber);
      return;
    }

    this.workCenterStore.correctWorkCenter(key, assignmentNumber, {
      workCenterCode: this.workCenterCodeDraft(),
      startDate: this.startDateDraft(),
      endDate: this.endDateDraft(),
    });
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.workCenterStore.clearPlan();
    this.workCenterStore.clearFeedback();
  }

  private describeDates(startDate: string, endDate: string | null): string {
    const start = formatDisplayDate(startDate);
    return endDate
      ? `Del ${start} al ${formatDisplayDate(endDate)}`
      : `Desde el ${start}, en vigor`;
  }

  private loadWorkCenterOptions(ruleSystemCode: string | null, referenceDate: string): void {
    if (!ruleSystemCode) {
      this.workCenterOptions.set([]);
      return;
    }
    this.fieldCatalogService
      .loadWorkCenterOptions(ruleSystemCode, referenceDate)
      .pipe(take(1))
      .subscribe({
        next: (opts) => this.workCenterOptions.set(opts),
      });
  }
}
