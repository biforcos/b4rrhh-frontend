import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked
} from '@angular/core';
import { take } from 'rxjs';

import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeWorkCenterModel } from '../../models/employee-work-center.model';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { PeriodModalComponent } from '../../shared/ui/period-modal/period-modal.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { currentLocalDate } from '../../../../shared/utils/local-date.util';

type WorkCenterModalMode = 'create' | 'edit' | 'close';

interface WorkCenterPeriodRow extends TemporalSectionRow {
  assignmentNumber: number;
  workCenterCode: string;
  workCenterName: string | null;
}

@Component({
  selector: 'app-employee-work-center-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TemporalSectionComponent, PeriodModalComponent, UiDateInputComponent, UiSelectComponent],
  templateUrl: './employee-work-center-section.component.html',
})
export class EmployeeWorkCenterSectionComponent {
  readonly employeeKey = input<EmployeeBusinessKey | null>(null);

  private readonly workCenterStore = inject(EmployeeWorkCenterStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<WorkCenterModalMode>('create');
  protected readonly editingNumber = signal<number | null>(null);
  protected readonly editingIsActive = signal(false);
  protected readonly startDateDraft = signal(currentLocalDate());
  protected readonly endDateDraft = signal('');
  protected readonly workCenterCodeDraft = signal('');
  protected readonly workCenterOptions = signal<ReadonlyArray<SlotKeyOption<string>>>([]);

  protected readonly texts = employeeTexts;

  protected readonly rows = computed<ReadonlyArray<WorkCenterPeriodRow>>(() =>
    this.workCenterStore.workCenters().map((wc: EmployeeWorkCenterModel) => ({
      startDate: wc.startDate,
      endDate: wc.endDate,
      isActive: wc.isActive,
      canEdit: true,
      canDelete: !wc.isActive && wc.canDelete,
      assignmentNumber: wc.workCenterAssignmentNumber,
      workCenterCode: wc.workCenterCode,
      workCenterName: wc.workCenterName ?? null,
    })),
  );

  protected readonly saving = computed(() => this.workCenterStore.mutating());
  protected readonly isSubmitEnabled = computed(() => {
    if (this.modalMode() === 'close') return !!this.endDateDraft();
    return !!this.startDateDraft() && !!this.workCenterCodeDraft();
  });
  protected readonly modalTitle = computed(() => {
    if (this.modalMode() === 'create') return 'Nuevo centro de trabajo';
    if (this.modalMode() === 'close') return 'Cerrar período — Centro de trabajo';
    return 'Editar centro de trabajo';
  });

  constructor() {
    effect(() => {
      const key = this.employeeKey();
      untracked(() => {
        this.workCenterStore.loadWorkCenters(key);
        this.loadWorkCenterOptions(key?.ruleSystemCode ?? null);
      });
    });
    effect(() => {
      const success = this.workCenterStore.success();
      if (success) untracked(() => { if (this.modalVisible()) this.closeModal(); });
    });
  }

  protected openCreate(): void {
    this.workCenterStore.clearFeedback();
    this.modalMode.set('create');
    this.startDateDraft.set(currentLocalDate());
    this.endDateDraft.set('');
    this.workCenterCodeDraft.set('');
    this.modalVisible.set(true);
  }

  protected openEdit(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.workCenterStore.clearFeedback();
    this.editingNumber.set(row.assignmentNumber);
    this.editingIsActive.set(row.isActive);
    this.workCenterCodeDraft.set(row.workCenterCode);
    this.startDateDraft.set(row.startDate);
    this.endDateDraft.set(row.endDate ?? '');
    this.modalMode.set('edit');
    this.modalVisible.set(true);
  }

  protected switchToClose(): void {
    this.modalMode.set('close');
    this.endDateDraft.set(currentLocalDate());
  }

  protected confirmDelete(index: number): void {
    const row = this.rows()[index];
    if (!row || !row.canDelete) return;
    const key = this.employeeKey();
    if (!key) return;
    if (confirm('¿Eliminar este período de centro de trabajo?')) {
      this.workCenterStore.deleteWorkCenter(key, row.assignmentNumber);
    }
  }

  protected submit(): void {
    const key = this.employeeKey();
    if (!key || this.workCenterStore.mutating()) return;

    if (this.modalMode() === 'create') {
      this.workCenterStore.createWorkCenter(key, {
        workCenterCode: this.workCenterCodeDraft(),
        startDate: this.startDateDraft(),
        endDate: this.endDateDraft(),
      });
    } else if (this.modalMode() === 'edit') {
      this.workCenterStore.correctWorkCenter(key, this.editingNumber()!, {
        workCenterCode: this.workCenterCodeDraft(),
        startDate: this.startDateDraft(),
        endDate: this.endDateDraft(),
      });
    } else {
      this.workCenterStore.closeWorkCenter(key, this.editingNumber()!, this.endDateDraft());
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.workCenterStore.clearFeedback();
  }

  private loadWorkCenterOptions(ruleSystemCode: string | null): void {
    if (!ruleSystemCode) { this.workCenterOptions.set([]); return; }
    this.fieldCatalogService.loadWorkCenterOptions(ruleSystemCode).pipe(take(1)).subscribe({
      next: (opts) => this.workCenterOptions.set(opts),
    });
  }
}
