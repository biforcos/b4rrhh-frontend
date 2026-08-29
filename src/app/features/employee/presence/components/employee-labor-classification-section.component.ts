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

import { EmployeeLaborClassificationCatalogGateway } from '../../data-access/employee-labor-classification-catalog.gateway';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeLaborClassificationStore } from '../../data-access/employee-labor-classification.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeLaborClassificationModel } from '../../models/employee-labor-classification.model';
import { EmployeeLaborClassificationCatalogItemModel } from '../../models/employee-labor-classification-catalog-item.model';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { PeriodModalComponent } from '../../shared/ui/period-modal/period-modal.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { currentLocalDate } from '../../../../shared/utils/local-date.util';

type LaborClassificationModalMode = 'create' | 'edit' | 'close';

interface LaborClassificationPeriodRow extends TemporalSectionRow {
  agreementCode: string;
  agreementCategoryCode: string | null;
  grupoCotizacionCode: string | null;
}

@Component({
  selector: 'app-employee-labor-classification-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TemporalSectionComponent, PeriodModalComponent, UiDateInputComponent, UiSelectComponent],
  templateUrl: './employee-labor-classification-section.component.html',
  styleUrl: './employee-labor-classification-section.component.scss',
})
export class EmployeeLaborClassificationSectionComponent {
  readonly employeeBusinessKey = input<EmployeeBusinessKey | null>(null);

  private readonly classificationStore = inject(EmployeeLaborClassificationStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);
  private readonly catalogGateway = inject(EmployeeLaborClassificationCatalogGateway);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<LaborClassificationModalMode>('create');
  protected readonly editingStartDate = signal<string | null>(null);
  protected readonly editingIsActive = signal(false);
  protected readonly effectiveDateDraft = signal('');
  protected readonly newStartDateDraft = signal('');
  protected readonly agreementCodeDraft = signal('');
  protected readonly agreementCategoryCodeDraft = signal('');
  protected readonly endDateDraft = signal('');

  private readonly agreementOptionsState = signal<ReadonlyArray<SlotKeyOption<string>>>([]);
  private readonly categoryOptionsState = signal<ReadonlyArray<SlotKeyOption<string>>>([]);
  private readonly categoryLoadingState = signal(false);
  private categoryRequestId = 0;
  private agreementRequestId = 0;

  protected readonly texts = employeeTexts;

  protected readonly rows = computed<ReadonlyArray<LaborClassificationPeriodRow>>(() =>
    this.classificationStore.laborClassifications().map((lc: EmployeeLaborClassificationModel) => ({
      startDate: lc.startDate,
      endDate: lc.endDate,
      isActive: lc.isActive,
      canEdit: true,
      canDelete: false,
      agreementCode: lc.agreementCode,
      agreementCategoryCode: lc.agreementCategoryCode,
      grupoCotizacionCode: lc.grupoCotizacionCode ?? null,
    })),
  );

  protected readonly agreementOptions = this.agreementOptionsState.asReadonly();
  protected readonly categoryOptions = this.categoryOptionsState.asReadonly();
  protected readonly categoryLoading = this.categoryLoadingState.asReadonly();
  protected readonly categoryDisabled = computed(
    () => !this.agreementCodeDraft() || this.categoryLoadingState(),
  );
  protected readonly saving = computed(() => this.classificationStore.mutating());
  protected readonly showCascadeWarning = computed(
    () =>
      this.modalMode() === 'edit' &&
      !!this.newStartDateDraft() &&
      this.newStartDateDraft() !== this.editingStartDate(),
  );

  protected readonly modalTitle = computed(() => {
    if (this.modalMode() === 'create') return 'Nuevo período — Convenio';
    if (this.modalMode() === 'close') return 'Cerrar período — Convenio';
    return 'Editar período — Convenio';
  });

  protected readonly modalSubtitle = computed(() => {
    const sd = this.editingStartDate();
    return sd ? `Desde ${sd}` : null;
  });

  protected readonly isSubmitEnabled = computed(() => {
    const mode = this.modalMode();
    if (mode === 'create')
      return (
        !!this.effectiveDateDraft() &&
        !!this.agreementCodeDraft() &&
        !!this.agreementCategoryCodeDraft()
      );
    if (mode === 'edit')
      return (
        !!this.newStartDateDraft() &&
        !!this.agreementCodeDraft() &&
        !!this.agreementCategoryCodeDraft()
      );
    return !!this.endDateDraft();
  });

  constructor() {
    effect(() => {
      const key = this.employeeBusinessKey();
      untracked(() => {
        this.classificationStore.loadLaborClassificationsByBusinessKey(key);
        this.loadAgreementOptions(key?.ruleSystemCode ?? null);
      });
    });

    effect(() => {
      const success = this.classificationStore.success();
      if (success)
        untracked(() => {
          if (this.modalVisible()) this.closeModal();
        });
    });
  }

  protected openCreate(): void {
    this.classificationStore.clearFeedback();
    this.modalMode.set('create');
    this.effectiveDateDraft.set(currentLocalDate());
    this.agreementCodeDraft.set('');
    this.agreementCategoryCodeDraft.set('');
    this.categoryOptionsState.set([]);
    this.modalVisible.set(true);
  }

  protected openEdit(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.classificationStore.clearFeedback();
    this.modalMode.set('edit');
    this.editingStartDate.set(row.startDate);
    this.editingIsActive.set(row.isActive);
    this.newStartDateDraft.set(row.startDate);
    this.agreementCodeDraft.set(row.agreementCode);
    this.agreementCategoryCodeDraft.set(row.agreementCategoryCode ?? '');
    this.loadCategoryOptions(row.agreementCode, row.startDate, row.agreementCategoryCode ?? null);
    this.modalVisible.set(true);
  }

  protected switchToClose(): void {
    this.modalMode.set('close');
    this.endDateDraft.set(currentLocalDate());
  }

  protected submit(): void {
    const key = this.employeeBusinessKey();
    if (!key || this.classificationStore.mutating()) return;
    const mode = this.modalMode();

    if (mode === 'create') {
      this.classificationStore.replaceFromDate(key, {
        effectiveDate: this.effectiveDateDraft(),
        agreementCode: this.agreementCodeDraft(),
        agreementCategoryCode: this.agreementCategoryCodeDraft(),
      });
    } else if (mode === 'edit') {
      this.classificationStore.correctOccurrence(key, this.editingStartDate()!, {
        startDate: this.newStartDateDraft(),
        agreementCode: this.agreementCodeDraft(),
        agreementCategoryCode: this.agreementCategoryCodeDraft(),
      });
    } else {
      this.classificationStore.closeOccurrence(key, this.editingStartDate()!, {
        endDate: this.endDateDraft(),
      });
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.classificationStore.clearFeedback();
  }

  protected updateAgreementCode(value: string): void {
    const changed = this.agreementCodeDraft() !== value;
    this.agreementCodeDraft.set(value);
    if (changed) {
      this.agreementCategoryCodeDraft.set('');
      this.loadCategoryOptions(value, this.effectiveDateDraft() || null, null);
    }
  }

  private loadAgreementOptions(ruleSystemCode: string | null): void {
    if (!ruleSystemCode) {
      this.agreementOptionsState.set([]);
      return;
    }
    const id = ++this.agreementRequestId;
    this.fieldCatalogService
      .loadLaborClassificationAgreementOptions(ruleSystemCode)
      .pipe(take(1))
      .subscribe({
        next: (opts) => {
          if (id === this.agreementRequestId) this.agreementOptionsState.set(opts);
        },
      });
  }

  private loadCategoryOptions(
    agreementCode: string,
    referenceDate: string | null,
    preferred: string | null,
  ): void {
    if (!agreementCode) {
      this.categoryOptionsState.set([]);
      return;
    }
    const rsc = this.employeeBusinessKey()?.ruleSystemCode ?? '';
    if (!rsc) return;
    const id = ++this.categoryRequestId;
    this.categoryLoadingState.set(true);
    this.catalogGateway
      .loadAgreementCategories(rsc, agreementCode, referenceDate)
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          if (id !== this.categoryRequestId) return;
          this.categoryOptionsState.set(
            items.map((i: EmployeeLaborClassificationCatalogItemModel) => ({
              value: i.code,
              label: i.label,
            })),
          );
          this.categoryLoadingState.set(false);
        },
        error: () => {
          if (id === this.categoryRequestId) {
            this.categoryOptionsState.set([]);
            this.categoryLoadingState.set(false);
          }
        },
      });
  }
}
