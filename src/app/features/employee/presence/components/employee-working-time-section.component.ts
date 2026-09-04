import { DecimalPipe } from '@angular/common';
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

import { WorkingTimePlanDraft } from '../../data-access/employee-working-time.mapper';
import { EmployeeWorkingTimeStore } from '../../data-access/employee-working-time.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeWorkingTimeModel } from '../../models/employee-working-time.model';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiInputNumberComponent } from '../../../../shared/ui/input-number/ui-input-number.component';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import {
  PeriodModalComponent,
  PeriodModalNoteTone,
} from '../../shared/ui/period-modal/period-modal.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { describeWorkingTimePlan } from '../../shared/utils/working-time-plan-message.util';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';

/**
 * Las tres cosas que se pueden hacer con la serie de jornadas (ADR-057): añadir una ocurrencia
 * con inicio y fin, corregir las fechas o el porcentaje de una, y borrar una. No hay «cerrar»:
 * añadir la siguiente ya cierra la vigente el día anterior, y eso se ve en el plan antes de
 * confirmar. El plan viene del backend; aquí no se comprueba ningún invariante.
 */
type WorkingTimeModalMode = 'add' | 'correct' | 'remove';

interface WorkingTimePeriodRow extends TemporalSectionRow {
  workingTimeNumber: number;
  workingTimePercentage: number;
  weeklyHours: number;
  dailyHours: number;
}

@Component({
  selector: 'app-employee-working-time-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    TemporalSectionComponent,
    PeriodModalComponent,
    UiDateInputComponent,
    UiInputNumberComponent,
  ],
  templateUrl: './employee-working-time-section.component.html',
})
export class EmployeeWorkingTimeSectionComponent {
  readonly employeeBusinessKey = input<EmployeeBusinessKey | null>(null);

  private readonly workingTimeStore = inject(EmployeeWorkingTimeStore);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<WorkingTimeModalMode>('add');
  protected readonly editingNumber = signal<number | null>(null);
  protected readonly editingPeriod = signal<string | null>(null);
  protected readonly startDateDraft = signal(currentLocalDate());
  /** Vacío para una jornada que queda en vigor. */
  protected readonly endDateDraft = signal('');
  protected readonly percentageDraft = signal(100);

  protected readonly texts = employeeTexts;

  // Corregir y borrar se ofrecen en todas las filas: si el cambio deja un hueco lo dice el
  // plan, con fechas, y no un botón escondido (ADR-057 §3: estirar una vecina lo hace el usuario).
  protected readonly rows = computed<ReadonlyArray<WorkingTimePeriodRow>>(() =>
    this.workingTimeStore.workingTimes().map((wt: EmployeeWorkingTimeModel) => ({
      startDate: wt.startDate,
      endDate: wt.endDate,
      isActive: wt.isActive,
      canEdit: true,
      canDelete: true,
      workingTimeNumber: wt.workingTimeNumber,
      workingTimePercentage: wt.workingTimePercentage,
      weeklyHours: wt.weeklyHours,
      dailyHours: wt.dailyHours,
    })),
  );

  protected readonly saving = computed(() => this.workingTimeStore.mutating());

  /** El cambio que se planificaría con lo que hay en el formulario; null si aún no está completo. */
  protected readonly planDraft = computed<WorkingTimePlanDraft | null>(() => {
    if (!this.modalVisible()) return null;
    const mode = this.modalMode();
    const workingTimeNumber = this.editingNumber();

    if (mode === 'remove') {
      return workingTimeNumber === null ? null : { operation: 'REMOVE', workingTimeNumber };
    }

    const startDate = this.startDateDraft();
    if (!startDate) return null;
    const endDate = this.endDateDraft() || null;

    if (mode === 'add') return { operation: 'ADD', startDate, endDate };
    return workingTimeNumber === null
      ? null
      : { operation: 'CORRECT', workingTimeNumber, startDate, endDate };
  });

  protected readonly plan = computed(() => this.workingTimeStore.plan());

  protected readonly planNotice = computed(() => {
    const plan = this.plan();
    return plan ? describeWorkingTimePlan(plan) : null;
  });

  protected readonly noteLines = computed<ReadonlyArray<string>>(() => {
    if (this.workingTimeStore.planning()) return [this.texts.workingTimeSectionPlanningMessage];
    return this.planNotice()?.lines ?? [];
  });

  protected readonly noteTone = computed<PeriodModalNoteTone>(
    () => this.planNotice()?.tone ?? 'info',
  );

  protected readonly modalTitle = computed(() => {
    const t = this.texts;
    if (this.modalMode() === 'add') return t.workingTimeSectionAddTitle;
    if (this.modalMode() === 'remove') return t.workingTimeSectionRemoveTitle;
    return t.workingTimeSectionCorrectTitle;
  });

  protected readonly submitLabel = computed(() => {
    const t = this.texts;
    if (this.modalMode() === 'add') return t.workingTimeSectionAddSubmitAction;
    if (this.modalMode() === 'remove') return t.workingTimeSectionRemoveSubmitAction;
    return t.workingTimeSectionCorrectSubmitAction;
  });

  protected readonly modalSubtitle = computed(() => this.editingPeriod());

  /** Solo se confirma lo que el backend ya ha dicho que puede aplicar. */
  protected readonly isSubmitEnabled = computed(() => {
    if (!this.planDraft()) return false;
    if (this.modalMode() !== 'remove' && !(this.percentageDraft() > 0)) return false;
    return this.plan()?.accepted === true;
  });

  constructor() {
    effect(() => {
      const key = this.employeeBusinessKey();
      untracked(() => this.workingTimeStore.loadWorkingTimesByBusinessKey(key));
    });

    effect(() => {
      const success = this.workingTimeStore.success();
      if (success)
        untracked(() => {
          if (this.modalVisible()) this.closeModal();
        });
    });

    // Cada cambio del formulario vuelve a pedir el plan: lo que se enseña es siempre lo que
    // pasaría con lo que hay escrito ahora.
    effect(() => {
      const key = this.employeeBusinessKey();
      const draft = this.planDraft();
      untracked(() => {
        if (key && draft) this.workingTimeStore.planChange(key, draft);
        else this.workingTimeStore.clearPlan();
      });
    });
  }

  protected openAdd(): void {
    this.workingTimeStore.clearFeedback();
    this.modalMode.set('add');
    this.editingNumber.set(null);
    this.editingPeriod.set(null);
    this.startDateDraft.set(currentLocalDate());
    this.endDateDraft.set('');
    this.percentageDraft.set(100);
    this.modalVisible.set(true);
  }

  protected openCorrect(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.workingTimeStore.clearFeedback();
    this.modalMode.set('correct');
    this.editingNumber.set(row.workingTimeNumber);
    this.editingPeriod.set(this.describePeriod(row));
    this.startDateDraft.set(row.startDate);
    this.endDateDraft.set(row.endDate ?? '');
    this.percentageDraft.set(row.workingTimePercentage);
    this.modalVisible.set(true);
  }

  protected openRemove(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.workingTimeStore.clearFeedback();
    this.modalMode.set('remove');
    this.editingNumber.set(row.workingTimeNumber);
    this.editingPeriod.set(this.describePeriod(row));
    this.modalVisible.set(true);
  }

  protected submit(): void {
    const key = this.employeeBusinessKey();
    const workingTimeNumber = this.editingNumber();
    if (!key || !this.isSubmitEnabled() || this.workingTimeStore.mutating()) return;
    const mode = this.modalMode();

    if (mode === 'add') {
      this.workingTimeStore.createWorkingTime(key, {
        startDate: this.startDateDraft(),
        endDate: this.endDateDraft() || null,
        workingTimePercentage: this.percentageDraft(),
      });
    } else if (mode === 'correct' && workingTimeNumber !== null) {
      this.workingTimeStore.updateWorkingTime(key, workingTimeNumber, {
        startDate: this.startDateDraft(),
        endDate: this.endDateDraft() || null,
        workingTimePercentage: this.percentageDraft(),
      });
    } else if (mode === 'remove' && workingTimeNumber !== null) {
      this.workingTimeStore.deleteWorkingTime(key, workingTimeNumber);
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.workingTimeStore.clearPlan();
    this.workingTimeStore.clearFeedback();
  }

  private describePeriod(row: WorkingTimePeriodRow): string {
    const start = formatDisplayDate(row.startDate);
    return row.endDate
      ? `Del ${start} al ${formatDisplayDate(row.endDate)} · ${row.workingTimePercentage} %`
      : `Desde el ${start}, en vigor · ${row.workingTimePercentage} %`;
  }
}
