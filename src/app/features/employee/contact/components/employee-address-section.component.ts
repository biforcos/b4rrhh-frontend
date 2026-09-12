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
import { InputTextModule } from 'primeng/inputtext';
import { take } from 'rxjs';

import {
  AddressCreateDraft,
  AddressPlanDraft,
} from '../../data-access/employee-address-edit.mapper';
import { EmployeeAddressStore } from '../../data-access/employee-address.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeAddressModel } from '../../models/employee-address.model';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import {
  PeriodModalComponent,
  PeriodModalNoteTone,
} from '../../shared/ui/period-modal/period-modal.component';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import {
  ADDRESS_PLAN_VOCABULARY,
  describeCorrectionSwitchAction,
  describeTimelinePlan,
} from '../../shared/utils/timeline-plan-message.util';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { UiCatalogLabelComponent } from '../../../../shared/ui/catalog-label/ui-catalog-label.component';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';

/**
 * Las tres cosas que se pueden hacer con la serie de direcciones de un tipo (ADR-057): añadir
 * una con inicio y fin, corregir las fechas o los datos de una, y borrarla. No hay «cerrar»:
 * añadir la siguiente ya cierra la vigente del mismo tipo el día anterior, y eso se ve en el
 * plan antes de confirmar.
 *
 * Cada tipo es su propia serie y su propia cobertura: el domicilio es obligatorio y los demás
 * no (ADR-057, decisión 1). Aquí no se consulta cuál es cuál —lo dice el plan, que rechaza el
 * hueco del domicilio y acepta el de los demás contándolo—.
 */
type AddressModalMode = 'add' | 'correct' | 'remove';

interface AddressPeriodRow extends TemporalSectionRow {
  addressNumber: number;
  addressTypeCode: string;
  addressTypeName: string | null;
  street: string;
  /** Código postal, ciudad y región, en una línea. */
  locality: string;
  countryCode: string;
}

function createEmptyAddressDraft(): AddressCreateDraft {
  return {
    addressTypeCode: '',
    street: '',
    city: '',
    countryCode: '',
    postalCode: '',
    regionCode: '',
    startDate: currentLocalDate(),
    endDate: '',
  };
}

@Component({
  selector: 'app-employee-address-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TemporalSectionComponent,
    PeriodModalComponent,
    UiDateInputComponent,
    UiSelectComponent,
    UiCatalogLabelComponent,
    InputTextModule,
  ],
  templateUrl: './employee-address-section.component.html',
  styleUrl: './employee-address-section.component.scss',
})
export class EmployeeAddressSectionComponent {
  private static readonly GLOBAL_FEEDBACK_SOURCE_KEY = 'employee-address-section-local';

  readonly employeeKey = input<EmployeeBusinessKey | null>(null);

  private readonly addressStore = inject(EmployeeAddressStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);
  private readonly globalMessageService = inject(GlobalMessageService);

  protected readonly texts = employeeTexts;
  protected readonly modalVisible = signal(false);
  protected readonly modalMode = signal<AddressModalMode>('add');
  /** La dirección que se corrige o se borra. */
  protected readonly editingNumber = signal<number | null>(null);
  protected readonly editingPeriod = signal<string | null>(null);
  protected readonly draft = signal<AddressCreateDraft>(createEmptyAddressDraft());
  protected readonly addressTypeOptions = signal<ReadonlyArray<SlotKeyOption<string>>>([]);
  protected readonly catalogLoading = signal(false);
  private catalogRequestId = 0;

  // Corregir y borrar se ofrecen en todas las filas: si el cambio deja un hueco o un solape lo
  // dice el plan, con fechas, y no un botón escondido (ADR-057 §3).
  protected readonly rows = computed<ReadonlyArray<AddressPeriodRow>>(() =>
    [...this.addressStore.addresses()]
      .sort((left, right) => this.compareAddressOrder(left, right))
      .map((address) => ({
        startDate: address.startDate,
        endDate: address.endDate,
        isActive: address.isActive,
        canEdit: true,
        canDelete: true,
        addressNumber: address.addressNumber,
        addressTypeCode: address.addressTypeCode,
        addressTypeName: address.addressTypeName ?? null,
        street: address.street,
        locality: [address.postalCode, address.city, address.regionCode]
          .map((part) => part?.trim() ?? '')
          .filter((part) => part.length > 0)
          .join(' · '),
        countryCode: address.countryCode,
      })),
  );

  protected readonly saving = computed(() => this.addressStore.mutating());

  /** El cambio que se planificaría con lo que hay en el formulario; null si aún no está completo. */
  protected readonly planDraft = computed<AddressPlanDraft | null>(() => {
    if (!this.modalVisible()) return null;
    const mode = this.modalMode();
    const addressNumber = this.editingNumber();

    if (mode === 'remove') {
      return addressNumber === null ? null : { operation: 'REMOVE', addressNumber };
    }

    const draft = this.draft();
    if (!draft.startDate) return null;
    const endDate = draft.endDate || null;

    if (mode === 'add') {
      return draft.addressTypeCode
        ? {
            operation: 'ADD',
            addressTypeCode: draft.addressTypeCode,
            startDate: draft.startDate,
            endDate,
          }
        : null;
    }

    return addressNumber === null
      ? null
      : { operation: 'CORRECT', addressNumber, startDate: draft.startDate, endDate };
  });

  protected readonly plan = computed(() => this.addressStore.plan());

  protected readonly planNotice = computed(() => {
    const plan = this.plan();
    return plan ? describeTimelinePlan(plan, ADDRESS_PLAN_VOCABULARY) : null;
  });

  protected readonly noteLines = computed<ReadonlyArray<string>>(() => {
    if (this.addressStore.planning()) return [this.texts.addressesSectionPlanningMessage];
    return this.planNotice()?.lines ?? [];
  });

  protected readonly noteTone = computed<PeriodModalNoteTone>(
    () => this.planNotice()?.tone ?? 'info',
  );

  /**
   * El alta que empieza el mismo día que una dirección del mismo tipo es su corrección, y el
   * backend lo dice nombrándola. Se ofrece pasar a corregirla sin volver a teclear.
   */
  protected readonly correctionOffer = computed<string | null>(() => {
    const plan = this.plan();
    if (!plan || plan.rejection !== 'IS_A_CORRECTION') return null;
    const corrected = plan.correctedOccurrence;
    if (!corrected || corrected.addressNumber === null) return null;
    return describeCorrectionSwitchAction(corrected, ADDRESS_PLAN_VOCABULARY);
  });

  protected readonly modalTitle = computed(() => {
    const mode = this.modalMode();
    if (mode === 'add') return this.texts.addressesSectionAddAction;
    if (mode === 'remove') return this.texts.addressesSectionRemoveTitle;
    return this.texts.addressesSectionCorrectTitle;
  });

  protected readonly submitLabel = computed(() => {
    const mode = this.modalMode();
    if (mode === 'add') return this.texts.addressesSectionAddSubmitAction;
    if (mode === 'remove') return this.texts.addressesSectionRemoveSubmitAction;
    return this.texts.addressesSectionCorrectSubmitAction;
  });

  protected readonly modalSubtitle = computed(() => this.editingPeriod());

  /** Solo se confirma lo que el backend ya ha dicho que puede aplicar. */
  protected readonly isSubmitEnabled = computed(() => {
    if (!this.planDraft()) return false;
    if (this.modalMode() !== 'remove') {
      const draft = this.draft();
      const required = [draft.street, draft.city, draft.countryCode];
      if (!required.every((value) => value.trim().length > 0)) return false;
    }
    return this.plan()?.accepted === true;
  });

  constructor() {
    effect(() => {
      const key = this.employeeKey();
      untracked(() => {
        this.addressStore.loadAddresses(key);
        this.loadCatalogOptions(key?.ruleSystemCode ?? null, this.draft().startDate);
        this.closeModal();
      });
    });

    effect((onCleanup) => {
      onCleanup(() => {
        untracked(() =>
          this.globalMessageService.clearSourceMessages(
            EmployeeAddressSectionComponent.GLOBAL_FEEDBACK_SOURCE_KEY,
          ),
        );
      });
    });

    effect(() => {
      const success = this.addressStore.success();
      if (success) {
        untracked(() => {
          if (this.modalVisible()) this.closeModal();
        });
      }
    });

    // Cada cambio del formulario vuelve a pedir el plan: lo que se enseña es siempre lo que
    // pasaría con lo que hay escrito ahora.
    effect(() => {
      const key = this.employeeKey();
      const draft = this.planDraft();
      untracked(() => {
        if (key && draft) this.addressStore.planChange(key, draft);
        else this.addressStore.clearPlan();
      });
    });
  }

  protected openAdd(): void {
    if (!this.employeeKey() || this.addressStore.mutating()) return;
    this.addressStore.clearFeedback();
    this.modalMode.set('add');
    this.editingNumber.set(null);
    this.editingPeriod.set(null);
    this.draft.set(createEmptyAddressDraft());
    this.loadCatalogOptions(this.employeeKey()?.ruleSystemCode ?? null, this.draft().startDate);
    this.modalVisible.set(true);
  }

  protected openCorrect(index: number): void {
    const address = this.addressAt(index);
    if (!address) return;
    this.addressStore.clearFeedback();
    this.modalMode.set('correct');
    this.editingNumber.set(address.addressNumber);
    this.editingPeriod.set(this.describeDates(address.startDate, address.endDate));
    this.draft.set({
      addressTypeCode: address.addressTypeCode,
      street: address.street,
      city: address.city,
      countryCode: address.countryCode,
      postalCode: address.postalCode ?? '',
      regionCode: address.regionCode ?? '',
      startDate: address.startDate,
      endDate: address.endDate ?? '',
    });
    this.loadCatalogOptions(this.employeeKey()?.ruleSystemCode ?? null, this.draft().startDate);
    this.modalVisible.set(true);
  }

  protected openRemove(index: number): void {
    const address = this.addressAt(index);
    if (!address) return;
    this.addressStore.clearFeedback();
    this.modalMode.set('remove');
    this.editingNumber.set(address.addressNumber);
    this.editingPeriod.set(this.describeDates(address.startDate, address.endDate));
    this.modalVisible.set(true);
  }

  /** Del rechazo al camino: se corrige la dirección que el backend nombra, con lo ya escrito. */
  protected switchToCorrection(): void {
    const corrected = this.plan()?.correctedOccurrence;
    if (!corrected || corrected.addressNumber === null) return;
    this.modalMode.set('correct');
    this.editingNumber.set(corrected.addressNumber);
    this.editingPeriod.set(this.describeDates(corrected.startDate, corrected.endDate));
  }

  protected submit(): void {
    const key = this.employeeKey();
    if (!key || !this.isSubmitEnabled() || this.addressStore.mutating()) return;

    const mode = this.modalMode();
    if (mode === 'add') {
      this.addressStore.createAddress(key, this.draft());
      return;
    }

    const addressNumber = this.editingNumber();
    if (addressNumber === null) return;

    if (mode === 'remove') {
      this.addressStore.deleteAddress(key, addressNumber);
      return;
    }

    const draft = this.draft();
    this.addressStore.correctAddress(key, addressNumber, {
      street: draft.street,
      city: draft.city,
      countryCode: draft.countryCode,
      postalCode: draft.postalCode,
      regionCode: draft.regionCode,
      startDate: draft.startDate,
      endDate: draft.endDate,
    });
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.addressStore.clearPlan();
    this.addressStore.clearFeedback();
  }

  protected updateDraft(field: keyof AddressCreateDraft, value: string | null): void {
    this.draft.update((draft) => ({ ...draft, [field]: value ?? '' }));

    // La vigencia de un tipo de dirección se pregunta respecto al día en que empieza el
    // período que se edita (b4rrhh/frontend#32), así que al cambiarlo se vuelve a pedir.
    if (field === 'startDate') {
      this.loadCatalogOptions(this.employeeKey()?.ruleSystemCode ?? null, value ?? '');
    }
  }

  private addressAt(index: number): EmployeeAddressModel | null {
    const row = this.rows()[index];
    if (!row || this.addressStore.mutating()) return null;
    return (
      this.addressStore.addresses().find((item) => item.addressNumber === row.addressNumber) ?? null
    );
  }

  private describeDates(startDate: string, endDate: string | null): string {
    const start = formatDisplayDate(startDate);
    return endDate
      ? `Del ${start} al ${formatDisplayDate(endDate)}`
      : `Desde el ${start}, en vigor`;
  }

  private compareAddressOrder(left: EmployeeAddressModel, right: EmployeeAddressModel): number {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
    const byStart = right.startDate.localeCompare(left.startDate);
    return byStart !== 0 ? byStart : left.addressNumber - right.addressNumber;
  }

  private loadCatalogOptions(ruleSystemCode: string | null, referenceDate: string): void {
    const normalized = ruleSystemCode?.trim() ?? '';
    if (!normalized) {
      this.catalogRequestId += 1;
      this.catalogLoading.set(false);
      this.addressTypeOptions.set([]);
      return;
    }

    const requestId = ++this.catalogRequestId;
    this.catalogLoading.set(true);
    this.fieldCatalogService
      .loadAddressTypeOptions(normalized, referenceDate)
      .pipe(take(1))
      .subscribe({
        next: (options) => {
          if (requestId !== this.catalogRequestId) return;
          this.catalogLoading.set(false);
          this.addressTypeOptions.set(options);
        },
        error: () => {
          if (requestId !== this.catalogRequestId) return;
          this.catalogLoading.set(false);
          this.globalMessageService.setSourceMessages(
            EmployeeAddressSectionComponent.GLOBAL_FEEDBACK_SOURCE_KEY,
            [
              {
                id: 'employee-address-section-local-error',
                level: 'error',
                text: this.texts.catalogLoadFailedMessage,
                sectionId: 'contact',
                sectionLabel: this.texts.personalAreaLabel,
                sticky: true,
              },
            ],
          );
        },
      });
  }
}
