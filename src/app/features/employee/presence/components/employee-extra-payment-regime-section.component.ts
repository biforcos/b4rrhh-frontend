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

import { ExtraPaymentRegimePlanDraft } from '../../data-access/employee-extra-payment-regime.mapper';
import { EmployeeExtraPaymentRegimeStore } from '../../data-access/employee-extra-payment-regime.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeExtraPaymentRegimeModel } from '../../models/employee-extra-payment-regime.model';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import {
  PeriodModalComponent,
  PeriodModalNoteTone,
} from '../../shared/ui/period-modal/period-modal.component';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import {
  EXTRA_PAYMENT_REGIME_PLAN_VOCABULARY,
  describeCorrectionSwitchAction,
  describeTimelinePlan,
} from '../../shared/utils/timeline-plan-message.util';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';

/**
 * El régimen de pagas extras del empleado, tramo a tramo ({@code b4rrhh/backend#118}).
 *
 * <p>Es <b>el molde de jornada</b> y no una pantalla nueva: las mismas tres operaciones del
 * ADR-057 —añadir una ocurrencia con inicio y fin, corregir una, borrar una—, el mismo modal de
 * período y el mismo aviso con el plan del backend. Lo único que cambia es el dato: dos valores
 * en vez de un porcentaje.
 *
 * <p>No hay «cerrar»: añadir el siguiente tramo ya cierra el vigente el día anterior, y eso se ve
 * en el plan antes de confirmar. Aquí no se comprueba ningún invariante.
 */
type ExtraPaymentRegimeModalMode = 'add' | 'correct' | 'remove';

interface ExtraPaymentRegimePeriodRow extends TemporalSectionRow {
  extraPaymentRegimeNumber: number;
  prorated: boolean;
}

@Component({
  selector: 'app-employee-extra-payment-regime-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TemporalSectionComponent,
    PeriodModalComponent,
    UiDateInputComponent,
    UiSelectComponent,
  ],
  templateUrl: './employee-extra-payment-regime-section.component.html',
})
export class EmployeeExtraPaymentRegimeSectionComponent {
  readonly employeeBusinessKey = input<EmployeeBusinessKey | null>(null);

  private readonly extraPaymentRegimeStore = inject(EmployeeExtraPaymentRegimeStore);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<ExtraPaymentRegimeModalMode>('add');
  protected readonly editingNumber = signal<number | null>(null);
  protected readonly editingPeriod = signal<string | null>(null);
  protected readonly startDateDraft = signal(currentLocalDate());
  /** Vacío para un tramo que queda en vigor. */
  protected readonly endDateDraft = signal('');
  protected readonly proratedDraft = signal(false);

  protected readonly texts = employeeTexts;

  /**
   * Los dos regímenes, con las palabras del dominio y no «sí/no».
   *
   * <p>Un desplegable de dos y no una casilla: una casilla obliga a leer la etiqueta al revés
   * para saber qué significa desmarcarla, y aquí las dos opciones son dos casos con nombre, no
   * una opción y su ausencia.
   */
  protected readonly regimeOptions: ReadonlyArray<SlotKeyOption<string>> = [
    { value: 'false', label: 'Se pagan en su mes' },
    { value: 'true', label: 'Prorrateadas' },
  ];

  protected readonly rows = computed<ReadonlyArray<ExtraPaymentRegimePeriodRow>>(() =>
    this.extraPaymentRegimeStore
      .extraPaymentRegimes()
      .map((regime: EmployeeExtraPaymentRegimeModel) => ({
        startDate: regime.startDate,
        endDate: regime.endDate,
        isActive: regime.isActive,
        canEdit: true,
        canDelete: true,
        extraPaymentRegimeNumber: regime.extraPaymentRegimeNumber,
        prorated: regime.prorated,
      })),
  );

  protected readonly saving = computed(() => this.extraPaymentRegimeStore.mutating());

  /** El cambio que se planificaría con lo que hay en el formulario; null si aún no está completo. */
  protected readonly planDraft = computed<ExtraPaymentRegimePlanDraft | null>(() => {
    if (!this.modalVisible()) return null;
    const mode = this.modalMode();
    const extraPaymentRegimeNumber = this.editingNumber();

    if (mode === 'remove') {
      return extraPaymentRegimeNumber === null
        ? null
        : { operation: 'REMOVE', extraPaymentRegimeNumber };
    }

    const startDate = this.startDateDraft();
    if (!startDate) return null;
    const endDate = this.endDateDraft() || null;

    if (mode === 'add') return { operation: 'ADD', startDate, endDate };
    return extraPaymentRegimeNumber === null
      ? null
      : { operation: 'CORRECT', extraPaymentRegimeNumber, startDate, endDate };
  });

  protected readonly plan = computed(() => this.extraPaymentRegimeStore.plan());

  protected readonly planNotice = computed(() => {
    const plan = this.plan();
    return plan ? describeTimelinePlan(plan, EXTRA_PAYMENT_REGIME_PLAN_VOCABULARY) : null;
  });

  protected readonly noteLines = computed<ReadonlyArray<string>>(() => {
    if (this.extraPaymentRegimeStore.planning())
      return [this.texts.extraPaymentRegimeSectionPlanningMessage];
    return this.planNotice()?.lines ?? [];
  });

  protected readonly noteTone = computed<PeriodModalNoteTone>(
    () => this.planNotice()?.tone ?? 'info',
  );

  /**
   * El alta que empieza el mismo día que un tramo existente es su corrección, y el backend lo
   * dice nombrándolo. Se ofrece pasar a corregirlo sin volver a teclear las fechas.
   */
  protected readonly correctionOffer = computed<string | null>(() => {
    const plan = this.plan();
    if (!plan || plan.rejection !== 'IS_A_CORRECTION') return null;
    const corrected = plan.correctedOccurrence;
    if (!corrected || corrected.extraPaymentRegimeNumber === null) return null;
    return describeCorrectionSwitchAction(corrected, EXTRA_PAYMENT_REGIME_PLAN_VOCABULARY);
  });

  protected readonly modalTitle = computed(() => {
    const t = this.texts;
    if (this.modalMode() === 'add') return t.extraPaymentRegimeSectionAddTitle;
    if (this.modalMode() === 'remove') return t.extraPaymentRegimeSectionRemoveTitle;
    return t.extraPaymentRegimeSectionCorrectTitle;
  });

  protected readonly submitLabel = computed(() => {
    const t = this.texts;
    if (this.modalMode() === 'add') return t.extraPaymentRegimeSectionAddSubmitAction;
    if (this.modalMode() === 'remove') return t.extraPaymentRegimeSectionRemoveSubmitAction;
    return t.extraPaymentRegimeSectionCorrectSubmitAction;
  });

  protected readonly modalSubtitle = computed(() => this.editingPeriod());

  /** Solo se confirma lo que el backend ya ha dicho que puede aplicar. */
  protected readonly isSubmitEnabled = computed(() => {
    if (!this.planDraft()) return false;
    return this.plan()?.accepted === true;
  });

  constructor() {
    effect(() => {
      const key = this.employeeBusinessKey();
      untracked(() => this.extraPaymentRegimeStore.loadExtraPaymentRegimesByBusinessKey(key));
    });

    effect(() => {
      const success = this.extraPaymentRegimeStore.success();
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
        if (key && draft) this.extraPaymentRegimeStore.planChange(key, draft);
        else this.extraPaymentRegimeStore.clearPlan();
      });
    });
  }

  protected openAdd(): void {
    this.extraPaymentRegimeStore.clearFeedback();
    this.modalMode.set('add');
    this.editingNumber.set(null);
    this.editingPeriod.set(null);
    this.startDateDraft.set(currentLocalDate());
    this.endDateDraft.set('');
    // El del convenio de la demo, que es el caso normal: quien prorratea lo pide.
    this.proratedDraft.set(false);
    this.modalVisible.set(true);
  }

  protected openCorrect(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.extraPaymentRegimeStore.clearFeedback();
    this.modalMode.set('correct');
    this.editingNumber.set(row.extraPaymentRegimeNumber);
    this.editingPeriod.set(this.describePeriod(row));
    this.startDateDraft.set(row.startDate);
    this.endDateDraft.set(row.endDate ?? '');
    this.proratedDraft.set(row.prorated);
    this.modalVisible.set(true);
  }

  protected openRemove(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.extraPaymentRegimeStore.clearFeedback();
    this.modalMode.set('remove');
    this.editingNumber.set(row.extraPaymentRegimeNumber);
    this.editingPeriod.set(this.describePeriod(row));
    this.modalVisible.set(true);
  }

  /** Del rechazo al camino: se corrige el tramo que el backend nombra, con lo ya escrito. */
  protected switchToCorrection(): void {
    const corrected = this.plan()?.correctedOccurrence;
    if (!corrected || corrected.extraPaymentRegimeNumber === null) return;
    this.modalMode.set('correct');
    this.editingNumber.set(corrected.extraPaymentRegimeNumber);
    this.editingPeriod.set(this.describeDates(corrected.startDate, corrected.endDate));
  }

  protected submit(): void {
    const key = this.employeeBusinessKey();
    const extraPaymentRegimeNumber = this.editingNumber();
    if (!key || !this.isSubmitEnabled() || this.extraPaymentRegimeStore.mutating()) return;
    const mode = this.modalMode();

    if (mode === 'add') {
      this.extraPaymentRegimeStore.createExtraPaymentRegime(key, {
        startDate: this.startDateDraft(),
        endDate: this.endDateDraft() || null,
        prorated: this.proratedDraft(),
      });
    } else if (mode === 'correct' && extraPaymentRegimeNumber !== null) {
      this.extraPaymentRegimeStore.updateExtraPaymentRegime(key, extraPaymentRegimeNumber, {
        startDate: this.startDateDraft(),
        endDate: this.endDateDraft() || null,
        prorated: this.proratedDraft(),
      });
    } else if (mode === 'remove' && extraPaymentRegimeNumber !== null) {
      this.extraPaymentRegimeStore.deleteExtraPaymentRegime(key, extraPaymentRegimeNumber);
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.extraPaymentRegimeStore.clearPlan();
    this.extraPaymentRegimeStore.clearFeedback();
  }

  private describePeriod(row: ExtraPaymentRegimePeriodRow): string {
    const regimen = row.prorated ? 'Prorrateadas' : 'Se pagan en su mes';
    return `${this.describeDates(row.startDate, row.endDate)} · ${regimen}`;
  }

  /** Solo fechas: del plan viene el tramo nombrado, y de él no se sabe el régimen. */
  private describeDates(startDate: string, endDate: string | null): string {
    const start = formatDisplayDate(startDate);
    return endDate
      ? `Del ${start} al ${formatDisplayDate(endDate)}`
      : `Desde el ${start}, en vigor`;
  }
}
