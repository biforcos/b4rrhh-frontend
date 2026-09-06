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
import { ContractPlanDraft } from '../../data-access/employee-contract.mapper';
import { EmployeeContractStore } from '../../data-access/employee-contract.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeContractCatalogItemModel } from '../../models/employee-contract-catalog-item.model';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
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
  CONTRACT_PLAN_VOCABULARY,
  describeCorrectionSwitchAction,
  describeTimelinePlan,
} from '../../shared/utils/timeline-plan-message.util';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';

/**
 * Lo que se puede hacer con la serie de contratos (ADR-057): añadir uno con inicio y fin, y
 * corregir las fechas o los códigos de otro. No hay «cerrar»: añadir el siguiente ya cierra el
 * vigente el día anterior, y cualquier otra fecha fin es una corrección. El plan viene del
 * backend; aquí no se comprueba ningún invariante ni se estira ninguna vecina.
 */
type ContractModalMode = 'add' | 'correct';

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
  protected readonly modalMode = signal<ContractModalMode>('add');
  /** El contrato que se corrige, nombrado por el día en que empieza hoy. */
  protected readonly editingStartDate = signal<string | null>(null);
  protected readonly editingPeriod = signal<string | null>(null);
  protected readonly startDateDraft = signal(currentLocalDate());
  /** Vacío para un contrato que queda en vigor. */
  protected readonly endDateDraft = signal('');
  protected readonly contractCodeDraft = signal('');
  protected readonly contractSubtypeCodeDraft = signal('');

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

  /** El cambio que se planificaría con lo que hay en el formulario; null si aún no está completo. */
  protected readonly planDraft = computed<ContractPlanDraft | null>(() => {
    if (!this.modalVisible()) return null;

    const startDate = this.startDateDraft();
    if (!startDate) return null;
    const endDate = this.endDateDraft() || null;

    if (this.modalMode() === 'add') return { operation: 'ADD', startDate, endDate };

    const contractStartDate = this.editingStartDate();
    return contractStartDate === null
      ? null
      : { operation: 'CORRECT', contractStartDate, startDate, endDate };
  });

  protected readonly plan = computed(() => this.contractStore.plan());

  protected readonly planNotice = computed(() => {
    const plan = this.plan();
    return plan ? describeTimelinePlan(plan, CONTRACT_PLAN_VOCABULARY) : null;
  });

  protected readonly noteLines = computed<ReadonlyArray<string>>(() => {
    if (this.contractStore.planning()) return [this.texts.contractSectionPlanningMessage];
    return this.planNotice()?.lines ?? [];
  });

  protected readonly noteTone = computed<PeriodModalNoteTone>(
    () => this.planNotice()?.tone ?? 'info',
  );

  /**
   * El alta que empieza el mismo día que un contrato existente es su corrección, y el backend lo
   * dice nombrándolo. Se ofrece pasar a corregirlo sin volver a teclear: eso es lo que da la
   * comodidad que `EXACT_START` daba adivinando.
   */
  protected readonly correctionOffer = computed<string | null>(() => {
    const plan = this.plan();
    if (!plan || plan.rejection !== 'IS_A_CORRECTION' || !plan.correctedOccurrence) return null;
    return describeCorrectionSwitchAction(plan.correctedOccurrence, CONTRACT_PLAN_VOCABULARY);
  });

  protected readonly modalTitle = computed(() =>
    this.modalMode() === 'add'
      ? this.texts.contractSectionAddTitle
      : this.texts.contractSectionCorrectTitle,
  );

  protected readonly submitLabel = computed(() =>
    this.modalMode() === 'add'
      ? this.texts.contractSectionAddSubmitAction
      : this.texts.contractSectionCorrectSubmitAction,
  );

  protected readonly modalSubtitle = computed(() => this.editingPeriod());

  /** Solo se confirma lo que el backend ya ha dicho que puede aplicar. */
  protected readonly isSubmitEnabled = computed(() => {
    if (!this.planDraft()) return false;
    if (!this.contractCodeDraft() || !this.contractSubtypeCodeDraft()) return false;
    return this.plan()?.accepted === true;
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

    // Cada cambio del formulario vuelve a pedir el plan: lo que se enseña es siempre lo que
    // pasaría con lo que hay escrito ahora.
    effect(() => {
      const key = this.employeeBusinessKey();
      const draft = this.planDraft();
      untracked(() => {
        if (key && draft) this.contractStore.planChange(key, draft);
        else this.contractStore.clearPlan();
      });
    });
  }

  protected openAdd(): void {
    this.contractStore.clearFeedback();
    this.modalMode.set('add');
    this.editingStartDate.set(null);
    this.editingPeriod.set(null);
    this.startDateDraft.set(currentLocalDate());
    this.endDateDraft.set('');
    this.contractCodeDraft.set('');
    this.contractSubtypeCodeDraft.set('');
    this.subtypeOptionsState.set([]);
    this.modalVisible.set(true);
  }

  protected openCorrect(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.contractStore.clearFeedback();
    this.modalMode.set('correct');
    this.editingStartDate.set(row.startDate);
    this.editingPeriod.set(this.describePeriod(row));
    this.startDateDraft.set(row.startDate);
    this.endDateDraft.set(row.endDate ?? '');
    this.contractCodeDraft.set(row.contractCode);
    this.contractSubtypeCodeDraft.set(row.contractSubtypeCode ?? '');
    this.loadSubtypeOptions(row.contractCode, row.startDate);
    this.modalVisible.set(true);
  }

  /** Del rechazo al camino: se corrige el contrato que el backend nombra, con lo ya escrito. */
  protected switchToCorrection(): void {
    const corrected = this.plan()?.correctedOccurrence;
    if (!corrected) return;
    this.modalMode.set('correct');
    this.editingStartDate.set(corrected.startDate);
    this.editingPeriod.set(this.describeDates(corrected.startDate, corrected.endDate));
  }

  protected submit(): void {
    const key = this.employeeBusinessKey();
    if (!key || !this.isSubmitEnabled() || this.contractStore.mutating()) return;

    const draft = {
      startDate: this.startDateDraft(),
      endDate: this.endDateDraft() || null,
      contractCode: this.contractCodeDraft(),
      contractSubtypeCode: this.contractSubtypeCodeDraft(),
    };

    if (this.modalMode() === 'add') {
      this.contractStore.createContract(key, draft);
      return;
    }

    const contractStartDate = this.editingStartDate();
    if (contractStartDate !== null) {
      this.contractStore.correctOccurrence(key, contractStartDate, draft);
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.contractStore.clearPlan();
    this.contractStore.clearFeedback();
  }

  protected updateContractCode(value: string): void {
    const changed = this.contractCodeDraft() !== value;
    this.contractCodeDraft.set(value);
    if (changed) {
      this.contractSubtypeCodeDraft.set('');
      this.loadSubtypeOptions(value, this.startDateDraft() || null);
    }
  }

  private describePeriod(row: ContractPeriodRow): string {
    return this.describeDates(row.startDate, row.endDate);
  }

  private describeDates(startDate: string, endDate: string | null): string {
    const start = formatDisplayDate(startDate);
    return endDate
      ? `Del ${start} al ${formatDisplayDate(endDate)}`
      : `Desde el ${start}, en vigor`;
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

  private loadSubtypeOptions(contractCode: string, referenceDate: string | null): void {
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
