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
  AddressEditCurrentDraft,
} from '../../data-access/employee-address-edit.mapper';
import { EmployeeAddressStore } from '../../data-access/employee-address.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeAddressModel } from '../../models/employee-address.model';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { PeriodModalComponent } from '../../shared/ui/period-modal/period-modal.component';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { UiCatalogLabelComponent } from '../../../../shared/ui/catalog-label/ui-catalog-label.component';
import { currentLocalDate } from '../../../../shared/utils/local-date.util';

type AddressModalMode = 'create' | 'edit' | 'close';

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
  };
}

/**
 * Las direcciones son vigencias —una persona se muda— y el modelo lo dice: fecha de inicio,
 * fecha de fin y solape prohibido por tipo (frontend#19). Se comportan como un carril
 * `TEMPORAL_APPEND_CLOSE` (ADR-051): se añaden por el final y se cierran; lo que se corrige en
 * una dirección vigente son sus datos, no sus fechas.
 */
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
  protected readonly modalMode = signal<AddressModalMode>('create');
  protected readonly editingNumber = signal<number | null>(null);
  protected readonly editingIsActive = signal(false);
  protected readonly draft = signal<AddressCreateDraft>(createEmptyAddressDraft());
  protected readonly endDateDraft = signal('');
  protected readonly addressTypeOptions = signal<ReadonlyArray<SlotKeyOption<string>>>([]);
  protected readonly catalogLoading = signal(false);
  private catalogRequestId = 0;

  protected readonly rows = computed<ReadonlyArray<AddressPeriodRow>>(() =>
    [...this.addressStore.addresses()]
      .sort((left, right) => this.compareAddressOrder(left, right))
      .map((address) => ({
        startDate: address.startDate,
        endDate: address.endDate,
        isActive: address.isActive,
        // Solo la vigente se corrige; la historia no se toca (ADR-016).
        canEdit: address.isActive,
        canDelete: false,
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

  protected readonly isSubmitEnabled = computed(() => {
    if (this.modalMode() === 'close') return this.endDateDraft().trim().length > 0;
    const draft = this.draft();
    const required = [draft.street, draft.city, draft.countryCode];
    if (this.modalMode() === 'create') required.push(draft.addressTypeCode, draft.startDate);
    return required.every((value) => value.trim().length > 0);
  });

  protected readonly modalTitle = computed(() => {
    if (this.modalMode() === 'create') return this.texts.addressesSectionAddAction;
    if (this.modalMode() === 'close') return this.texts.addressesSectionCloseTitle;
    return this.texts.addressesSectionEditCurrentAction;
  });

  protected readonly submitLabel = computed(() => {
    if (this.modalMode() === 'create') return this.texts.addressesSectionSaveCreateAction;
    if (this.modalMode() === 'close') return this.texts.addressesSectionConfirmCloseAction;
    return this.texts.addressesSectionSaveEditCurrentAction;
  });

  constructor() {
    effect(() => {
      const key = this.employeeKey();
      untracked(() => {
        this.addressStore.loadAddresses(key);
        this.loadCatalogOptions(key?.ruleSystemCode ?? null);
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
  }

  protected openCreate(): void {
    if (!this.employeeKey() || this.addressStore.mutating()) return;
    this.addressStore.clearFeedback();
    this.modalMode.set('create');
    this.editingNumber.set(null);
    this.editingIsActive.set(false);
    this.draft.set(createEmptyAddressDraft());
    this.endDateDraft.set('');
    this.modalVisible.set(true);
  }

  protected openEdit(index: number): void {
    const row = this.rows()[index];
    if (!row || !row.canEdit || this.addressStore.mutating()) return;
    const address = this.addressStore
      .addresses()
      .find((item) => item.addressNumber === row.addressNumber);
    if (!address) return;
    this.addressStore.clearFeedback();
    this.modalMode.set('edit');
    this.editingNumber.set(address.addressNumber);
    this.editingIsActive.set(address.isActive);
    this.draft.set({
      addressTypeCode: address.addressTypeCode,
      street: address.street,
      city: address.city,
      countryCode: address.countryCode,
      postalCode: address.postalCode ?? '',
      regionCode: address.regionCode ?? '',
      startDate: address.startDate,
    });
    this.endDateDraft.set('');
    this.modalVisible.set(true);
  }

  protected switchToClose(): void {
    this.modalMode.set('close');
    this.endDateDraft.set(currentLocalDate());
  }

  protected submit(): void {
    const key = this.employeeKey();
    if (!key || this.addressStore.mutating() || !this.isSubmitEnabled()) return;

    const mode = this.modalMode();
    if (mode === 'create') {
      this.addressStore.createAddress(key, this.draft());
      return;
    }

    const addressNumber = this.editingNumber();
    if (addressNumber === null) return;
    if (mode === 'close') {
      this.addressStore.closeAddress(key, addressNumber, this.endDateDraft());
      return;
    }

    const draft = this.draft();
    const correction: AddressEditCurrentDraft = {
      street: draft.street,
      city: draft.city,
      countryCode: draft.countryCode,
      postalCode: draft.postalCode,
      regionCode: draft.regionCode,
    };
    this.addressStore.updateAddress(key, addressNumber, correction);
  }

  protected closeModal(): void {
    this.modalVisible.set(false);
    this.addressStore.clearFeedback();
  }

  protected updateDraft(field: keyof AddressCreateDraft, value: string | null): void {
    this.draft.update((draft) => ({ ...draft, [field]: value ?? '' }));
  }

  private compareAddressOrder(left: EmployeeAddressModel, right: EmployeeAddressModel): number {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
    const byStart = right.startDate.localeCompare(left.startDate);
    return byStart !== 0 ? byStart : left.addressNumber - right.addressNumber;
  }

  private loadCatalogOptions(ruleSystemCode: string | null): void {
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
      .loadAddressTypeOptions(normalized)
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
