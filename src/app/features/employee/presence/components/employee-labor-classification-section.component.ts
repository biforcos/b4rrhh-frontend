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
import { LaborClassificationPlanDraft } from '../../data-access/employee-labor-classification.mapper';
import { EmployeeLaborClassificationStore } from '../../data-access/employee-labor-classification.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeLaborClassificationModel } from '../../models/employee-labor-classification.model';
import { EmployeeLaborClassificationCatalogItemModel } from '../../models/employee-labor-classification-catalog-item.model';
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
  LABOR_CLASSIFICATION_PLAN_VOCABULARY,
  describeCorrectionSwitchAction,
  describeTimelinePlan,
} from '../../shared/utils/timeline-plan-message.util';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';

/**
 * Lo que se puede hacer con la serie de clasificaciones (ADR-057): añadir una con inicio y fin, y
 * corregir las fechas o los códigos de otra. No hay «cerrar»: añadir la siguiente ya cierra la
 * vigente el día anterior, y cualquier otra fecha fin es una corrección. El plan viene del
 * backend; aquí no se comprueba ningún invariante ni se estira ninguna vecina.
 */
type LaborClassificationModalMode = 'add' | 'correct';

interface LaborClassificationPeriodRow extends TemporalSectionRow {
  agreementCode: string;
  agreementLabel: string | null;
  agreementCategoryCode: string | null;
  categoryLabel: string | null;
  grupoCotizacionCode: string | null;
}

@Component({
  selector: 'app-employee-labor-classification-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TemporalSectionComponent,
    PeriodModalComponent,
    UiDateInputComponent,
    UiSelectComponent,
    UiCatalogLabelComponent,
  ],
  templateUrl: './employee-labor-classification-section.component.html',
})
export class EmployeeLaborClassificationSectionComponent {
  readonly employeeBusinessKey = input<EmployeeBusinessKey | null>(null);

  private readonly classificationStore = inject(EmployeeLaborClassificationStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);
  private readonly catalogGateway = inject(EmployeeLaborClassificationCatalogGateway);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<LaborClassificationModalMode>('add');
  /** La clasificación que se corrige, nombrada por el día en que empieza hoy. */
  protected readonly editingStartDate = signal<string | null>(null);
  protected readonly editingPeriod = signal<string | null>(null);
  protected readonly startDateDraft = signal(currentLocalDate());
  /** Vacío para una clasificación que queda en vigor. */
  protected readonly endDateDraft = signal('');
  protected readonly agreementCodeDraft = signal('');
  protected readonly agreementCategoryCodeDraft = signal('');

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
      agreementLabel:
        lc.agreementName ??
        this.agreementOptionsState().find((o) => o.value === lc.agreementCode)?.label ??
        null,
      agreementCategoryCode: lc.agreementCategoryCode,
      categoryLabel: lc.agreementCategoryName ?? null,
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

  /** El cambio que se planificaría con lo que hay en el formulario; null si aún no está completo. */
  protected readonly planDraft = computed<LaborClassificationPlanDraft | null>(() => {
    if (!this.modalVisible()) return null;

    const startDate = this.startDateDraft();
    if (!startDate) return null;
    const endDate = this.endDateDraft() || null;

    if (this.modalMode() === 'add') return { operation: 'ADD', startDate, endDate };

    const laborClassificationStartDate = this.editingStartDate();
    return laborClassificationStartDate === null
      ? null
      : { operation: 'CORRECT', laborClassificationStartDate, startDate, endDate };
  });

  protected readonly plan = computed(() => this.classificationStore.plan());

  protected readonly planNotice = computed(() => {
    const plan = this.plan();
    return plan ? describeTimelinePlan(plan, LABOR_CLASSIFICATION_PLAN_VOCABULARY) : null;
  });

  protected readonly noteLines = computed<ReadonlyArray<string>>(() => {
    if (this.classificationStore.planning())
      return [this.texts.laborClassificationSectionPlanningMessage];
    return this.planNotice()?.lines ?? [];
  });

  protected readonly noteTone = computed<PeriodModalNoteTone>(
    () => this.planNotice()?.tone ?? 'info',
  );

  /**
   * El alta que empieza el mismo día que una clasificación existente es su corrección, y el
   * backend lo dice nombrándola. Se ofrece pasar a corregirla sin volver a teclear: eso es lo que
   * da la comodidad que `EXACT_START` daba adivinando.
   */
  protected readonly correctionOffer = computed<string | null>(() => {
    const plan = this.plan();
    if (!plan || plan.rejection !== 'IS_A_CORRECTION' || !plan.correctedOccurrence) return null;
    return describeCorrectionSwitchAction(
      plan.correctedOccurrence,
      LABOR_CLASSIFICATION_PLAN_VOCABULARY,
    );
  });

  protected readonly modalTitle = computed(() =>
    this.modalMode() === 'add'
      ? this.texts.laborClassificationSectionAddTitle
      : this.texts.laborClassificationSectionCorrectTitle,
  );

  protected readonly submitLabel = computed(() =>
    this.modalMode() === 'add'
      ? this.texts.laborClassificationSectionAddSubmitAction
      : this.texts.laborClassificationSectionCorrectSubmitAction,
  );

  protected readonly modalSubtitle = computed(() => this.editingPeriod());

  /** Solo se confirma lo que el backend ya ha dicho que puede aplicar. */
  protected readonly isSubmitEnabled = computed(() => {
    if (!this.planDraft()) return false;
    if (!this.agreementCodeDraft() || !this.agreementCategoryCodeDraft()) return false;
    return this.plan()?.accepted === true;
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

    // Cada cambio del formulario vuelve a pedir el plan: lo que se enseña es siempre lo que
    // pasaría con lo que hay escrito ahora.
    effect(() => {
      const key = this.employeeBusinessKey();
      const draft = this.planDraft();
      untracked(() => {
        if (key && draft) this.classificationStore.planChange(key, draft);
        else this.classificationStore.clearPlan();
      });
    });
  }

  protected openAdd(): void {
    this.classificationStore.clearFeedback();
    this.modalMode.set('add');
    this.editingStartDate.set(null);
    this.editingPeriod.set(null);
    this.startDateDraft.set(currentLocalDate());
    this.endDateDraft.set('');
    this.agreementCodeDraft.set('');
    this.agreementCategoryCodeDraft.set('');
    this.categoryOptionsState.set([]);
    this.modalVisible.set(true);
  }

  protected openCorrect(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.classificationStore.clearFeedback();
    this.modalMode.set('correct');
    this.editingStartDate.set(row.startDate);
    this.editingPeriod.set(this.describePeriod(row));
    this.startDateDraft.set(row.startDate);
    this.endDateDraft.set(row.endDate ?? '');
    this.agreementCodeDraft.set(row.agreementCode);
    this.agreementCategoryCodeDraft.set(row.agreementCategoryCode ?? '');
    this.loadCategoryOptions(row.agreementCode, row.startDate);
    this.modalVisible.set(true);
  }

  /** Del rechazo al camino: se corrige la clasificación que el backend nombra, con lo ya escrito. */
  protected switchToCorrection(): void {
    const corrected = this.plan()?.correctedOccurrence;
    if (!corrected) return;
    this.modalMode.set('correct');
    this.editingStartDate.set(corrected.startDate);
    this.editingPeriod.set(this.describeDates(corrected.startDate, corrected.endDate));
  }

  protected submit(): void {
    const key = this.employeeBusinessKey();
    if (!key || !this.isSubmitEnabled() || this.classificationStore.mutating()) return;

    const draft = {
      startDate: this.startDateDraft(),
      endDate: this.endDateDraft() || null,
      agreementCode: this.agreementCodeDraft(),
      agreementCategoryCode: this.agreementCategoryCodeDraft(),
    };

    if (this.modalMode() === 'add') {
      this.classificationStore.createLaborClassification(key, draft);
      return;
    }

    const laborClassificationStartDate = this.editingStartDate();
    if (laborClassificationStartDate !== null) {
      this.classificationStore.correctOccurrence(key, laborClassificationStartDate, draft);
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.classificationStore.clearPlan();
    this.classificationStore.clearFeedback();
  }

  protected updateAgreementCode(value: string): void {
    const changed = this.agreementCodeDraft() !== value;
    this.agreementCodeDraft.set(value);
    if (changed) {
      this.agreementCategoryCodeDraft.set('');
      this.loadCategoryOptions(value, this.startDateDraft() || null);
    }
  }

  private describePeriod(row: LaborClassificationPeriodRow): string {
    return this.describeDates(row.startDate, row.endDate);
  }

  private describeDates(startDate: string, endDate: string | null): string {
    const start = formatDisplayDate(startDate);
    return endDate
      ? `Del ${start} al ${formatDisplayDate(endDate)}`
      : `Desde el ${start}, en vigor`;
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

  private loadCategoryOptions(agreementCode: string, referenceDate: string | null): void {
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
