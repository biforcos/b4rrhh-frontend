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

import { EmployeeWorkingTimeStore } from '../../data-access/employee-working-time.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeWorkingTimeModel } from '../../models/employee-working-time.model';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiInputNumberComponent } from '../../../../shared/ui/input-number/ui-input-number.component';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { PeriodModalComponent } from '../../shared/ui/period-modal/period-modal.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { currentLocalDate } from '../../../../shared/utils/local-date.util';

type WorkingTimeModalMode = 'create' | 'edit' | 'close';

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
    TemporalSectionComponent,
    PeriodModalComponent,
    UiDateInputComponent,
    UiInputNumberComponent,
  ],
  templateUrl: './employee-working-time-section.component.html',
  styleUrl: './employee-working-time-section.component.scss',
})
export class EmployeeWorkingTimeSectionComponent {
  readonly employeeBusinessKey = input<EmployeeBusinessKey | null>(null);

  private readonly workingTimeStore = inject(EmployeeWorkingTimeStore);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<WorkingTimeModalMode>('create');
  protected readonly editingNumber = signal<number | null>(null);
  protected readonly editingStartDate = signal<string | null>(null);
  protected readonly editingIsActive = signal(false);
  protected readonly startDateDraft = signal(currentLocalDate());
  protected readonly newStartDateDraft = signal('');
  protected readonly percentageDraft = signal(100);
  protected readonly endDateDraft = signal('');

  protected readonly texts = employeeTexts;

  protected readonly rows = computed<ReadonlyArray<WorkingTimePeriodRow>>(() =>
    this.workingTimeStore.workingTimes().map((wt: EmployeeWorkingTimeModel) => ({
      startDate: wt.startDate,
      endDate: wt.endDate,
      isActive: wt.isActive,
      canEdit: wt.isActive,
      canDelete: false,
      workingTimeNumber: wt.workingTimeNumber,
      workingTimePercentage: wt.workingTimePercentage,
      weeklyHours: wt.weeklyHours,
      dailyHours: wt.dailyHours,
    })),
  );

  protected readonly saving = computed(() => this.workingTimeStore.mutating());
  protected readonly showCascadeWarning = computed(
    () =>
      this.modalMode() === 'edit' &&
      !!this.newStartDateDraft() &&
      this.newStartDateDraft() !== this.editingStartDate(),
  );

  protected readonly modalTitle = computed(() => {
    if (this.modalMode() === 'create') return 'Nueva jornada';
    if (this.modalMode() === 'close') return 'Cerrar período — Jornada';
    return 'Editar jornada';
  });

  protected readonly modalSubtitle = computed(() => {
    const sd = this.editingStartDate();
    return sd ? `Desde ${sd}` : null;
  });

  protected readonly isSubmitEnabled = computed(() => {
    const mode = this.modalMode();
    if (mode === 'create') return !!this.startDateDraft();
    if (mode === 'edit') return !!this.newStartDateDraft();
    return !!this.endDateDraft();
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
  }

  protected openCreate(): void {
    this.workingTimeStore.clearFeedback();
    this.modalMode.set('create');
    this.startDateDraft.set(currentLocalDate());
    this.percentageDraft.set(100);
    this.modalVisible.set(true);
  }

  protected openEdit(index: number): void {
    const row = this.rows()[index];
    if (!row || !row.isActive) return;
    this.workingTimeStore.clearFeedback();
    this.modalMode.set('edit');
    this.editingNumber.set(row.workingTimeNumber);
    this.editingStartDate.set(row.startDate);
    this.editingIsActive.set(row.isActive);
    this.newStartDateDraft.set(row.startDate);
    this.percentageDraft.set(row.workingTimePercentage);
    this.modalVisible.set(true);
  }

  protected switchToClose(): void {
    this.modalMode.set('close');
    this.endDateDraft.set(currentLocalDate());
  }

  protected submit(): void {
    const key = this.employeeBusinessKey();
    if (!key || this.workingTimeStore.mutating()) return;
    const mode = this.modalMode();

    if (mode === 'create') {
      this.workingTimeStore.createWorkingTime(key, {
        startDate: this.startDateDraft(),
        workingTimePercentage: this.percentageDraft(),
      });
    } else if (mode === 'edit') {
      this.workingTimeStore.updateWorkingTime(key, this.editingNumber()!, {
        startDate: this.newStartDateDraft(),
        workingTimePercentage: this.percentageDraft(),
      });
    } else {
      this.workingTimeStore.closeWorkingTime(key, this.editingNumber()!, {
        endDate: this.endDateDraft(),
      });
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.workingTimeStore.clearFeedback();
  }
}
