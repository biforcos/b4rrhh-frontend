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

import {
  CorrectEmployeeTaxInformationRequest,
  CreateEmployeeTaxInformationRequest,
} from '../../../../core/api/clients/employee-tax-information.client';
import { EmployeeTaxInformationStore } from '../../data-access/employee-tax-information.store';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { PeriodModalComponent } from '../../shared/ui/period-modal/period-modal.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';

type TaxInfoModalMode = 'create' | 'edit' | 'delete-confirm';

interface TaxInfoPeriodRow extends TemporalSectionRow {
  familySituation: string;
  descendantsCount: number;
  ascendantsCount: number;
  disabilityDegree: string;
}

const FAMILY_SITUATION_OPTIONS: ReadonlyArray<SlotKeyOption<string>> = [
  { value: 'SINGLE_OR_OTHER', label: 'Soltero/a o situación análoga' },
  { value: 'MARRIED_DEPENDENT_SPOUSE', label: 'Casado/a con cónyuge a cargo' },
  { value: 'SEPARATED_WITH_CHILDREN', label: 'Separado/a con hijos' },
];

const DISABILITY_DEGREE_OPTIONS: ReadonlyArray<SlotKeyOption<string>> = [
  { value: 'NONE', label: 'Sin discapacidad' },
  { value: 'MODERATE', label: 'Moderada (≥33%)' },
  { value: 'SEVERE', label: 'Severa (≥65% o movilidad reducida)' },
];

const TAX_TERRITORY_OPTIONS: ReadonlyArray<SlotKeyOption<string>> = [
  { value: 'COMUN', label: 'Territorio Común' },
  { value: 'ARABA', label: 'Álava' },
  { value: 'GIPUZKOA', label: 'Gipuzkoa' },
  { value: 'BIZKAIA', label: 'Bizkaia' },
  { value: 'NAVARRA', label: 'Navarra' },
];

const BOOLEAN_OPTIONS: ReadonlyArray<SlotKeyOption<string>> = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Sí' },
];

@Component({
  selector: 'app-employee-tax-information-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TemporalSectionComponent, PeriodModalComponent, UiDateInputComponent, UiSelectComponent],
  templateUrl: './employee-tax-information-section.component.html',
  styleUrl: './employee-tax-information-section.component.scss',
})
export class EmployeeTaxInformationSectionComponent {
  readonly employeeKey = input<EmployeeBusinessKey | null>(null);

  protected readonly store = inject(EmployeeTaxInformationStore);

  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<TaxInfoModalMode>('create');
  protected readonly editingValidFrom = signal<string | null>(null);

  protected readonly validFromDraft = signal('');
  protected readonly familySituationDraft = signal('');
  protected readonly descendantsCountDraft = signal('0');
  protected readonly ascendantsCountDraft = signal('0');
  protected readonly disabilityDegreeDraft = signal('');
  protected readonly pensionCompensatoriaDraft = signal('false');
  protected readonly geographicMobilityDraft = signal('false');
  protected readonly habitualResidenceLoanDraft = signal('false');
  protected readonly taxTerritoryDraft = signal('');

  protected readonly familySituationOptions = FAMILY_SITUATION_OPTIONS;
  protected readonly disabilityDegreeOptions = DISABILITY_DEGREE_OPTIONS;
  protected readonly taxTerritoryOptions = TAX_TERRITORY_OPTIONS;
  protected readonly booleanOptions = BOOLEAN_OPTIONS;

  protected readonly rows = computed<ReadonlyArray<TaxInfoPeriodRow>>(() =>
    this.store.records().map((r, i) => ({
      startDate: r.validFrom,
      endDate: null,
      isActive: i === 0,
      canEdit: true,
      canDelete: true,
      familySituation: r.familySituation,
      descendantsCount: r.descendantsCount,
      ascendantsCount: r.ascendantsCount,
      disabilityDegree: r.disabilityDegree,
    })),
  );

  protected readonly modalTitle = computed(() => {
    if (this.modalMode() === 'create') return 'Nueva información fiscal';
    if (this.modalMode() === 'delete-confirm') return 'Eliminar información fiscal';
    return 'Corregir información fiscal';
  });

  /** La vigencia que se corrige o se borra, en formato local (ADR-051 §5). */
  protected readonly editingValidFromLabel = computed(() => {
    const vf = this.editingValidFrom();
    return vf ? formatDisplayDate(vf) : null;
  });

  protected readonly modalSubtitle = computed(() => {
    const vf = this.editingValidFromLabel();
    return vf ? `Vigente desde ${vf}` : null;
  });

  protected readonly modalSubmitLabel = computed(() =>
    this.modalMode() === 'delete-confirm' ? 'Eliminar' : 'Guardar cambios',
  );

  protected readonly isSubmitEnabled = computed(() => {
    const mode = this.modalMode();
    if (mode === 'delete-confirm') return true;
    const descCount = parseInt(this.descendantsCountDraft(), 10);
    const ascCount = parseInt(this.ascendantsCountDraft(), 10);
    return (
      (mode === 'edit' || !!this.validFromDraft()) &&
      !!this.familySituationDraft() &&
      !!this.disabilityDegreeDraft() &&
      !!this.taxTerritoryDraft() &&
      !isNaN(descCount) &&
      descCount >= 0 &&
      !isNaN(ascCount) &&
      ascCount >= 0
    );
  });

  constructor() {
    effect(() => {
      const key = this.employeeKey();
      untracked(() => this.store.load(key));
    });

    effect(() => {
      const success = this.store.success();
      if (success)
        untracked(() => {
          if (this.modalVisible()) this.closeModal();
        });
    });
  }

  protected openCreate(): void {
    this.store.clearFeedback();
    this.modalMode.set('create');
    this.editingValidFrom.set(null);
    this.validFromDraft.set(currentLocalDate());
    this.familySituationDraft.set('');
    this.descendantsCountDraft.set('0');
    this.ascendantsCountDraft.set('0');
    this.disabilityDegreeDraft.set('');
    this.pensionCompensatoriaDraft.set('false');
    this.geographicMobilityDraft.set('false');
    this.habitualResidenceLoanDraft.set('false');
    this.taxTerritoryDraft.set('');
    this.modalVisible.set(true);
  }

  protected openEdit(index: number): void {
    const row = this.rows()[index];
    const record = this.store.records()[index];
    if (!row || !record) return;
    this.store.clearFeedback();
    this.modalMode.set('edit');
    this.editingValidFrom.set(row.startDate);
    this.familySituationDraft.set(record.familySituation);
    this.descendantsCountDraft.set(String(record.descendantsCount));
    this.ascendantsCountDraft.set(String(record.ascendantsCount));
    this.disabilityDegreeDraft.set(record.disabilityDegree);
    this.pensionCompensatoriaDraft.set(String(record.pensionCompensatoria));
    this.geographicMobilityDraft.set(String(record.geographicMobility));
    this.habitualResidenceLoanDraft.set(String(record.habitualResidenceLoan));
    this.taxTerritoryDraft.set(record.taxTerritory);
    this.modalVisible.set(true);
  }

  protected openDeleteConfirm(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.store.clearFeedback();
    this.modalMode.set('delete-confirm');
    this.editingValidFrom.set(row.startDate);
    this.modalVisible.set(true);
  }

  protected submit(): void {
    const key = this.employeeKey();
    if (!key || this.store.mutating()) return;
    const mode = this.modalMode();

    if (mode === 'create') {
      const req: CreateEmployeeTaxInformationRequest = {
        validFrom: this.validFromDraft(),
        familySituation:
          this.familySituationDraft() as CreateEmployeeTaxInformationRequest['familySituation'],
        descendantsCount: parseInt(this.descendantsCountDraft(), 10),
        ascendantsCount: parseInt(this.ascendantsCountDraft(), 10),
        disabilityDegree:
          this.disabilityDegreeDraft() as CreateEmployeeTaxInformationRequest['disabilityDegree'],
        pensionCompensatoria: this.pensionCompensatoriaDraft() === 'true',
        geographicMobility: this.geographicMobilityDraft() === 'true',
        habitualResidenceLoan: this.habitualResidenceLoanDraft() === 'true',
        taxTerritory:
          this.taxTerritoryDraft() as CreateEmployeeTaxInformationRequest['taxTerritory'],
      };
      this.store.create(key, req);
    } else if (mode === 'edit') {
      const req: CorrectEmployeeTaxInformationRequest = {
        familySituation:
          this.familySituationDraft() as CorrectEmployeeTaxInformationRequest['familySituation'],
        descendantsCount: parseInt(this.descendantsCountDraft(), 10),
        ascendantsCount: parseInt(this.ascendantsCountDraft(), 10),
        disabilityDegree:
          this.disabilityDegreeDraft() as CorrectEmployeeTaxInformationRequest['disabilityDegree'],
        pensionCompensatoria: this.pensionCompensatoriaDraft() === 'true',
        geographicMobility: this.geographicMobilityDraft() === 'true',
        habitualResidenceLoan: this.habitualResidenceLoanDraft() === 'true',
        taxTerritory:
          this.taxTerritoryDraft() as CorrectEmployeeTaxInformationRequest['taxTerritory'],
      };
      this.store.correct(key, this.editingValidFrom()!, req);
    } else {
      this.store.delete(key, this.editingValidFrom()!);
    }
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.store.clearFeedback();
  }
}
