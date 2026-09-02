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

import { EmployeeContractCatalogGateway } from '../../data-access/employee-contract-catalog.gateway';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeContractStore } from '../../data-access/employee-contract.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeContractCatalogItemModel } from '../../models/employee-contract-catalog-item.model';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { UiCatalogLabelComponent } from '../../../../shared/ui/catalog-label/ui-catalog-label.component';
import { PeriodModalComponent } from '../../shared/ui/period-modal/period-modal.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { currentLocalDate } from '../../../../shared/utils/local-date.util';

type ContractModalMode = 'create' | 'edit' | 'close';

interface ContractPeriodRow extends TemporalSectionRow {
  contractCode: string;
  contractTypeLabel: string | null;
  contractSubtypeCode: string | null;
  contractSubtypeLabel: string | null;
}

@Component({
  selector: 'app-employee-contract-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TemporalSectionComponent,
    PeriodModalComponent,
    UiDateInputComponent,
    UiSelectComponent,
    UiCatalogLabelComponent,
  ],
  templateUrl: './employee-contract-section.component.html',
})
export class EmployeeContractSectionComponent {
  readonly employeeBusinessKey = input<EmployeeBusinessKey | null>(null);

  private readonly contractStore = inject(EmployeeContractStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);
  private readonly contractCatalogGateway = inject(EmployeeContractCatalogGateway);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<ContractModalMode>('create');
  protected readonly editingStartDate = signal<string | null>(null);
  protected readonly editingIsActive = signal(false);
  protected readonly effectiveDateDraft = signal('');
  protected readonly newStartDateDraft = signal('');
  protected readonly contractCodeDraft = signal('');
  protected readonly contractSubtypeCodeDraft = signal('');
  protected readonly endDateDraft = signal('');

  private readonly contractTypeOptionsState = signal<ReadonlyArray<SlotKeyOption<string>>>([]);
  private readonly subtypeOptionsState = signal<ReadonlyArray<SlotKeyOption<string>>>([]);
  private readonly subtypeLoadingState = signal(false);
  private subtypeRequestId = 0;
  private contractTypeRequestId = 0;

  protected readonly texts = employeeTexts;

  protected readonly rows = computed<ReadonlyArray<ContractPeriodRow>>(() =>
    this.contractStore.contracts().map((c) => ({
      startDate: c.startDate,
      endDate: c.endDate,
      isActive: c.isActive,
      canEdit: true,
      canDelete: false,
      contractCode: c.contractCode,
      contractTypeLabel:
        c.contractTypeName ??
        this.contractTypeOptionsState().find((o) => o.value === c.contractCode)?.label ??
        null,
      contractSubtypeCode: c.contractSubtypeCode,
      contractSubtypeLabel: c.contractSubtypeName ?? null,
    })),
  );

  protected readonly contractTypeOptions = this.contractTypeOptionsState.asReadonly();
  protected readonly subtypeOptions = this.subtypeOptionsState.asReadonly();
  protected readonly subtypeLoading = this.subtypeLoadingState.asReadonly();
  protected readonly subtypeDisabled = computed(
    () => !this.contractCodeDraft() || this.subtypeLoadingState(),
  );
  protected readonly saving = computed(() => this.contractStore.mutating());
  protected readonly showCascadeWarning = computed(
    () =>
      this.modalMode() === 'edit' &&
      !!this.newStartDateDraft() &&
      this.newStartDateDraft() !== this.editingStartDate(),
  );

  protected readonly modalTitle = computed(() => {
    if (this.modalMode() === 'create') return 'Nuevo período — Contrato';
    if (this.modalMode() === 'close') return 'Cerrar período — Contrato';
    return 'Editar período — Contrato';
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
        !!this.contractCodeDraft() &&
        !!this.contractSubtypeCodeDraft()
      );
    if (mode === 'edit')
      return (
        !!this.newStartDateDraft() &&
        !!this.contractCodeDraft() &&
        !!this.contractSubtypeCodeDraft()
      );
    return !!this.endDateDraft();
  });

  constructor() {
    effect(() => {
      const key = this.employeeBusinessKey();
      untracked(() => {
        this.contractStore.loadContractsByBusinessKey(key);
        this.loadContractTypeOptions(key?.ruleSystemCode ?? null);
      });
    });

    effect(() => {
      const success = this.contractStore.success();
      if (success)
        untracked(() => {
          if (this.modalVisible()) this.closeModal();
        });
    });
  }

  protected openCreate(): void {
    this.contractStore.clearFeedback();
    this.modalMode.set('create');
    this.effectiveDateDraft.set(currentLocalDate());
    this.contractCodeDraft.set('');
    this.contractSubtypeCodeDraft.set('');
    this.subtypeOptionsState.set([]);
    this.modalVisible.set(true);
  }

  protected openEdit(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.contractStore.clearFeedback();
    this.modalMode.set('edit');
    this.editingStartDate.set(row.startDate);
    this.editingIsActive.set(row.isActive);
    this.newStartDateDraft.set(row.startDate);
    this.contractCodeDraft.set(row.contractCode);
    this.contractSubtypeCodeDraft.set(row.contractSubtypeCode ?? '');
    this.loadSubtypeOptions(row.contractCode, row.startDate, row.contractSubtypeCode ?? null);
    this.modalVisible.set(true);
  }

  protected switchToClose(): void {
    this.modalMode.set('close');
    this.endDateDraft.set(currentLocalDate());
  }

  protected submit(): void {
    const key = this.employeeBusinessKey();
    if (!key || this.contractStore.mutating()) return;
    const mode = this.modalMode();

    if (mode === 'create') {
      this.contractStore.replaceFromDate(key, {
        effectiveDate: this.effectiveDateDraft(),
        contractCode: this.contractCodeDraft(),
        contractSubtypeCode: this.contractSubtypeCodeDraft(),
      });
    } else if (mode === 'edit') {
      this.contractStore.correctOccurrence(key, this.editingStartDate()!, {
        startDate: this.newStartDateDraft(),
        contractCode: this.contractCodeDraft(),
        contractSubtypeCode: this.contractSubtypeCodeDraft(),
      });
    } else {
      this.contractStore.closeOccurrence(key, this.editingStartDate()!, {
        endDate: this.endDateDraft(),
      });
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.contractStore.clearFeedback();
  }

  protected updateContractCode(value: string): void {
    const changed = this.contractCodeDraft() !== value;
    this.contractCodeDraft.set(value);
    if (changed) {
      this.contractSubtypeCodeDraft.set('');
      this.loadSubtypeOptions(value, this.effectiveDateDraft() || null, null);
    }
  }

  private loadContractTypeOptions(ruleSystemCode: string | null): void {
    if (!ruleSystemCode) {
      this.contractTypeOptionsState.set([]);
      return;
    }
    const id = ++this.contractTypeRequestId;
    this.fieldCatalogService
      .loadContractTypeOptions(ruleSystemCode)
      .pipe(take(1))
      .subscribe({
        next: (opts) => {
          if (id === this.contractTypeRequestId) this.contractTypeOptionsState.set(opts);
        },
      });
  }

  private loadSubtypeOptions(
    contractCode: string,
    referenceDate: string | null,
    preferred: string | null,
  ): void {
    if (!contractCode) {
      this.subtypeOptionsState.set([]);
      return;
    }
    const rsc = this.employeeBusinessKey()?.ruleSystemCode ?? '';
    if (!rsc) return;
    const id = ++this.subtypeRequestId;
    this.subtypeLoadingState.set(true);
    this.contractCatalogGateway
      .loadContractSubtypes(rsc, contractCode, referenceDate)
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          if (id !== this.subtypeRequestId) return;
          this.subtypeOptionsState.set(
            items.map((i: EmployeeContractCatalogItemModel) => ({ value: i.code, label: i.label })),
          );
          this.subtypeLoadingState.set(false);
        },
        error: () => {
          if (id === this.subtypeRequestId) {
            this.subtypeOptionsState.set([]);
            this.subtypeLoadingState.set(false);
          }
        },
      });
  }
}
