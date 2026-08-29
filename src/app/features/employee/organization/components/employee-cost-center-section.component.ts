import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild
} from '@angular/core';
import { take } from 'rxjs';

import { EmployeeCostCenterStore } from '../../data-access/employee-cost-center.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeCostCenterWindowModel } from '../../models/employee-cost-center.model';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { PeriodModalComponent } from '../../shared/ui/period-modal/period-modal.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { EmployeeCostCenterDistributionEditorComponent } from './employee-cost-center-distribution-editor.component';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { currentLocalDate } from '../../../../shared/utils/local-date.util';

type CostCenterModalMode = 'replace' | 'close';

interface CostCenterPeriodRow extends TemporalSectionRow {
  window: EmployeeCostCenterWindowModel;
  totalPercentage: number;
  itemsSummary: string;
}

@Component({
  selector: 'app-employee-cost-center-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TemporalSectionComponent, PeriodModalComponent, EmployeeCostCenterDistributionEditorComponent, UiDateInputComponent],
  templateUrl: './employee-cost-center-section.component.html',
  styleUrl: './employee-cost-center-section.component.scss',
})
export class EmployeeCostCenterSectionComponent {
  readonly employeeKey = input<EmployeeBusinessKey | null>(null);

  protected readonly costCenterStore = inject(EmployeeCostCenterStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);

  protected readonly editorRef = viewChild(EmployeeCostCenterDistributionEditorComponent);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<CostCenterModalMode>('replace');
  protected readonly closingStartDate = signal<string | null>(null);
  protected readonly endDateDraft = signal('');
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
    return all.map((w) => ({
      startDate: w.startDate,
      endDate: w.endDate ?? null,
      isActive: !w.endDate,
      canEdit: !w.endDate,
      canDelete: false,
      window: w,
      totalPercentage: w.totalAllocationPercentage,
      itemsSummary: w.items
        .map((i) => `${i.costCenterName || i.costCenterCode} (${i.allocationPercentage}%)`)
        .join(', '),
    }));
  });

  protected readonly saving = computed(() => this.costCenterStore.mutating());
  protected readonly isSubmitEnabled = computed(() =>
    this.modalMode() === 'close' ? !!this.endDateDraft() : true,
  );

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
      if (success) untracked(() => { if (this.modalVisible()) this.closeModal(); });
    });
  }

  protected openEdit(index: number): void {
    const row = this.rows()[index];
    if (!row || !row.isActive) return;
    this.costCenterStore.clearFeedback();
    this.modalMode.set('replace');
    this.modalVisible.set(true);
  }

  protected openNewDistribution(): void {
    this.costCenterStore.clearFeedback();
    this.modalMode.set('replace');
    this.modalVisible.set(true);
  }

  protected openClose(): void {
    const current = this.costCenterStore.currentDistribution();
    if (!current) return;
    this.costCenterStore.clearFeedback();
    this.closingStartDate.set(current.startDate);
    this.endDateDraft.set(currentLocalDate());
    this.modalMode.set('close');
    this.modalVisible.set(true);
  }

  protected submit(): void {
    const key = this.employeeKey();
    if (!key || this.costCenterStore.mutating()) return;

    if (this.modalMode() === 'replace') {
      const editor = this.editorRef();
      if (!editor) return;
      if (!editor.isValid()) return;
      const v = editor.getValue();
      if (this.costCenterStore.currentDistribution()) {
        this.costCenterStore.replaceDistribution(key, { effectiveDate: v.startDate, items: v.items });
      } else {
        this.costCenterStore.createDistribution(key, { startDate: v.startDate, items: v.items });
      }
    } else {
      this.costCenterStore.closeDistribution(key, this.closingStartDate()!, this.endDateDraft());
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.costCenterStore.clearFeedback();
  }

  private loadCostCenterOptions(ruleSystemCode: string | null): void {
    if (!ruleSystemCode) { this.costCenterOptions.set([]); return; }
    this.fieldCatalogService.loadCostCenterOptions(ruleSystemCode).pipe(take(1)).subscribe({
      next: (opts) => this.costCenterOptions.set(opts),
    });
  }
}
