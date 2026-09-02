import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';

import { UiButtonComponent } from '../../../shared/ui/button/ui-button.component';
import { UiSelectComponent } from '../../../shared/ui/select/ui-select.component';
import { SlotKeyOption } from '../../employee/shared/ui/section/editable-slot-section.model';
import { WorkCenterFieldCatalogService } from '../data-access/work-center-field-catalog.service';
import {
  EntityHeaderComponent,
  EntityHeaderMetadataItem,
  EntityHeaderStatus,
} from '../../../shared/ui/entity-header/entity-header.component';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import {
  buildEmptyWorkCenterContactFormValue,
  buildWorkCenterContactFormValueFromModel,
} from '../mapper/work-center-contact.mapper';
import {
  buildEmptyWorkCenterFormValue,
  buildWorkCenterFormValueFromDetail,
} from '../mapper/work-center-form.mapper';
import { WorkCenterContactFormValue } from '../models/work-center-contact-form-value.model';
import { WorkCenterContactModel } from '../models/work-center-contact.model';
import { WorkCenterDetailModel } from '../models/work-center-detail.model';
import { WorkCenterFormValue } from '../models/work-center-form-value.model';
import { workCenterTexts } from '../work-center.texts';

export type WorkCenterDetailMode = 'create' | 'view' | 'edit';

@Component({
  selector: 'app-work-center-detail-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    DatePickerModule,
    TextareaModule,
    MessageModule,
    UiButtonComponent,
    UiSelectComponent,
    EntityHeaderComponent,
    SectionCardComponent,
  ],
  templateUrl: './work-center-detail-panel.component.html',
  styleUrl: './work-center-detail-panel.component.scss',
})
export class WorkCenterDetailPanelComponent implements OnChanges {
  readonly mode = input.required<WorkCenterDetailMode>();
  readonly detail = input<WorkCenterDetailModel | null>(null);
  readonly contacts = input<ReadonlyArray<WorkCenterContactModel>>([]);
  readonly contactsLoading = input(false);
  readonly contactsError = input<string | null>(null);
  readonly submitting = input(false);
  readonly submitError = input<string | null>(null);
  readonly submitSuccess = input<'created' | 'updated' | null>(null);
  readonly contactSubmitting = input(false);
  readonly contactSubmitError = input<string | null>(null);
  readonly contactSubmitSuccess = input<'created' | 'updated' | 'deleted' | null>(null);

  readonly editRequested = output<void>();
  readonly submitted = output<WorkCenterFormValue>();
  readonly cancelled = output<void>();
  readonly contactCreateSubmitted = output<WorkCenterContactFormValue>();
  readonly contactUpdateSubmitted = output<{
    contactNumber: number;
    formValue: WorkCenterContactFormValue;
  }>();
  readonly contactDeleteRequested = output<number>();

  protected readonly texts = workCenterTexts;
  private readonly fb = inject(FormBuilder);
  private readonly fieldCatalogService = inject(WorkCenterFieldCatalogService);
  private readonly contactEditorModeState = signal<'hidden' | 'create' | 'edit'>('hidden');
  private readonly editingContactNumberState = signal<number | null>(null);
  private readonly contactTypeOptionsState = signal<ReadonlyArray<SlotKeyOption<string>>>([]);
  private readonly contactTypeOptionsLoadingState = signal(false);
  private readonly contactTypeOptionsErrorState = signal<string | null>(null);

  private contactTypeRequestId = 0;

  readonly form: FormGroup;
  readonly contactForm: FormGroup;
  protected readonly isCreateMode = computed(() => this.mode() === 'create');
  protected readonly isEditMode = computed(() => this.mode() === 'edit');
  protected readonly isViewMode = computed(() => this.mode() === 'view');
  protected readonly isContactCreateMode = computed(
    () => this.contactEditorModeState() === 'create',
  );
  protected readonly isContactEditMode = computed(() => this.contactEditorModeState() === 'edit');
  protected readonly isContactEditorVisible = computed(
    () => this.isContactCreateMode() || this.isContactEditMode(),
  );
  protected readonly hasPersistedDetail = computed(
    () => this.detail() !== null && !this.isCreateMode(),
  );
  protected readonly hasAvailableContactTypeOptions = computed(
    () => this.contactTypeOptionsState().length > 0,
  );
  protected readonly canCreateContact = computed(
    () =>
      this.hasPersistedDetail() &&
      !this.contactTypeOptionsLoadingState() &&
      this.contactTypeOptionsState().length > 0,
  );
  protected readonly contactTypeOptionsLoading = this.contactTypeOptionsLoadingState.asReadonly();
  protected readonly contactTypeOptionsError = this.contactTypeOptionsErrorState.asReadonly();
  protected readonly contactTypeOptions = computed<ReadonlyArray<SlotKeyOption<string>>>(() => {
    const options = [...this.contactTypeOptionsState()];
    const editingContactNumber = this.editingContactNumberState();

    if (editingContactNumber == null) {
      return options;
    }

    const editingContact = this.contacts().find(
      (contact) => contact.contactNumber === editingContactNumber,
    );
    if (
      !editingContact ||
      options.some((option) => option.value === editingContact.contactTypeCode)
    ) {
      return options;
    }

    const label = editingContact.contactTypeName?.trim()
      ? `${editingContact.contactTypeName.trim()} · ${editingContact.contactTypeCode}`
      : editingContact.contactTypeCode;

    return [...options, { value: editingContact.contactTypeCode, label }].sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  });
  protected readonly contactEditorTitle = computed(() =>
    this.isContactEditMode() ? this.texts.contactsEditTitle : this.texts.contactsCreateTitle,
  );

  constructor() {
    this.form = this.fb.group({
      ruleSystemCode: [
        { value: '', disabled: false },
        [Validators.required, Validators.maxLength(5)],
      ],
      workCenterCode: [
        { value: '', disabled: false },
        [Validators.required, Validators.maxLength(30)],
      ],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      startDate: [{ value: '', disabled: false }, [Validators.required]],
      companyCode: ['', [Validators.maxLength(30)]],
      street: ['', [Validators.maxLength(300)]],
      city: ['', [Validators.maxLength(120)]],
      postalCode: ['', [Validators.maxLength(20)]],
      regionCode: ['', [Validators.maxLength(30)]],
      countryCode: ['', [Validators.maxLength(3)]],
    });

    this.contactForm = this.fb.group({
      contactTypeCode: ['', [Validators.required, Validators.maxLength(30)]],
      contactValue: ['', [Validators.required, Validators.maxLength(300)]],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mode'] || changes['detail']) {
      this.rebuildForm();
    }

    if (changes['detail']) {
      this.loadContactTypeOptions(this.detail()?.ruleSystemCode ?? null);
    }

    if (changes['contactSubmitSuccess'] && this.contactSubmitSuccess()) {
      this.resetContactEditor();
    }
  }

  protected get successMessage(): string | null {
    const success = this.submitSuccess();
    if (success === 'created') {
      return this.texts.submitSuccessCreated;
    }
    if (success === 'updated') {
      return this.texts.submitSuccessUpdated;
    }
    return null;
  }

  protected get contactSuccessMessage(): string | null {
    const success = this.contactSubmitSuccess();
    if (success === 'created') {
      return this.texts.contactsSubmitSuccessCreated;
    }
    if (success === 'updated') {
      return this.texts.contactsSubmitSuccessUpdated;
    }
    if (success === 'deleted') {
      return this.texts.contactsSubmitSuccessDeleted;
    }
    return null;
  }

  protected get entityTitle(): string {
    const rawName = (this.form.getRawValue()['name'] as string | null) ?? '';
    const normalized = rawName.trim();
    if (normalized) {
      return normalized;
    }
    if (this.isCreateMode()) {
      return this.texts.formCreateTitle;
    }
    if (this.isEditMode()) {
      return this.texts.formEditTitle;
    }
    return this.texts.formViewTitle;
  }

  protected get entitySubtitle(): string | null {
    const description = this.detail()?.description?.trim() ?? '';
    return description || null;
  }

  protected get entityHeaderMetadata(): ReadonlyArray<EntityHeaderMetadataItem> {
    return [
      { label: this.texts.detailHeaderCodeLabel, value: this.entityWorkCenterCode },
      { label: this.texts.detailHeaderCompanyLabel, value: this.entityCompanyCode },
      { label: this.texts.detailHeaderLocationLabel, value: this.entityLocation },
    ];
  }

  protected get entityHeaderStatus(): EntityHeaderStatus {
    const detail = this.detail();
    if (!detail) {
      return { label: this.texts.draftLabel, severity: 'secondary' };
    }
    return {
      label: detail.active ? this.texts.activeLabel : this.texts.inactiveLabel,
      severity: detail.active ? 'success' : 'warn',
    };
  }

  protected get entityWorkCenterCode(): string {
    return (
      ((this.form.getRawValue()['workCenterCode'] as string | null) ?? '').trim() ||
      this.texts.detailViewEmptyValue
    );
  }

  protected get entityCompanyCode(): string {
    return (
      ((this.form.getRawValue()['companyCode'] as string | null) ?? '').trim() ||
      this.texts.detailViewEmptyValue
    );
  }

  protected get entityLocation(): string {
    const raw = this.form.getRawValue();
    const location = [raw['city'], raw['countryCode']]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0)
      .join(' · ');
    return location || this.texts.detailViewEmptyValue;
  }

  protected get hasAddress(): boolean {
    const detail = this.detail();
    if (!detail) {
      return false;
    }
    return Object.values(detail.address).some((value) => !!value);
  }

  protected displayValue(value: string | null | undefined): string {
    const normalized = value?.trim();
    return normalized ? normalized : this.texts.detailViewEmptyValue;
  }

  protected requestEdit(): void {
    this.editRequested.emit();
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitted.emit(this.getRawFormValue());
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  protected hasError(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  protected hasContactError(field: string): boolean {
    const ctrl = this.contactForm.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  protected beginCreateContact(): void {
    if (!this.canCreateContact() || this.contactSubmitting()) {
      return;
    }

    this.contactEditorModeState.set('create');
    this.editingContactNumberState.set(null);
    this.contactForm.reset(buildEmptyWorkCenterContactFormValue());
  }

  protected beginEditContact(contact: WorkCenterContactModel): void {
    if (this.contactSubmitting() || this.contactTypeOptionsLoading()) {
      return;
    }

    this.contactEditorModeState.set('edit');
    this.editingContactNumberState.set(contact.contactNumber);
    this.contactForm.reset(buildWorkCenterContactFormValueFromModel(contact));
  }

  protected updateContactTypeCode(contactTypeCode: string): void {
    this.contactForm.get('contactTypeCode')?.setValue(contactTypeCode);
    this.contactForm.get('contactTypeCode')?.markAsTouched();
    this.contactForm.get('contactTypeCode')?.markAsDirty();
  }

  protected cancelContactEditor(): void {
    this.resetContactEditor();
  }

  protected submitContact(): void {
    if (this.contactForm.invalid || this.contactSubmitting()) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const formValue = this.getRawContactFormValue();
    const contactNumber = this.editingContactNumberState();
    if (this.isContactEditMode() && contactNumber != null) {
      this.contactUpdateSubmitted.emit({ contactNumber, formValue });
      return;
    }

    this.contactCreateSubmitted.emit(formValue);
  }

  protected requestDeleteContact(contactNumber: number): void {
    this.contactDeleteRequested.emit(contactNumber);
  }

  protected isEditingContact(contactNumber: number): boolean {
    return this.isContactEditMode() && this.editingContactNumberState() === contactNumber;
  }

  private rebuildForm(): void {
    const detail = this.detail();
    const initialValue = detail
      ? this.toFormState(buildWorkCenterFormValueFromDetail(detail))
      : this.toFormState(buildEmptyWorkCenterFormValue());

    this.form.reset(initialValue);
    this.form.markAsPristine();
    this.form.markAsUntouched();

    if (this.mode() === 'edit') {
      this.form.get('ruleSystemCode')?.disable();
      this.form.get('workCenterCode')?.disable();
      this.form.get('startDate')?.disable();
    } else {
      this.form.get('ruleSystemCode')?.enable();
      this.form.get('workCenterCode')?.enable();
      this.form.get('startDate')?.enable();
    }
  }

  private toFormState(value: WorkCenterFormValue): Record<string, string | Date | null> {
    return {
      ...value,
      startDate: value.startDate ? this.parseDate(value.startDate) : null,
    };
  }

  private getRawFormValue(): WorkCenterFormValue {
    const raw = this.form.getRawValue();
    return {
      ruleSystemCode: raw['ruleSystemCode'] ?? '',
      workCenterCode: raw['workCenterCode'] ?? '',
      name: raw['name'] ?? '',
      description: raw['description'] ?? '',
      startDate:
        raw['startDate'] instanceof Date
          ? this.toIsoDate(raw['startDate'])
          : (raw['startDate'] ?? ''),
      companyCode: raw['companyCode'] ?? '',
      street: raw['street'] ?? '',
      city: raw['city'] ?? '',
      postalCode: raw['postalCode'] ?? '',
      regionCode: raw['regionCode'] ?? '',
      countryCode: raw['countryCode'] ?? '',
    };
  }

  private getRawContactFormValue(): WorkCenterContactFormValue {
    const raw = this.contactForm.getRawValue();
    return {
      contactTypeCode: raw['contactTypeCode'] ?? '',
      contactValue: raw['contactValue'] ?? '',
    };
  }

  private resetContactEditor(): void {
    this.contactEditorModeState.set('hidden');
    this.editingContactNumberState.set(null);
    this.contactForm.reset(buildEmptyWorkCenterContactFormValue());
  }

  private loadContactTypeOptions(ruleSystemCode: string | null): void {
    const normalizedRuleSystemCode = ruleSystemCode?.trim() ?? '';
    const requestId = ++this.contactTypeRequestId;

    this.contactTypeOptionsErrorState.set(null);
    this.contactTypeOptionsState.set([]);

    if (!normalizedRuleSystemCode) {
      this.contactTypeOptionsLoadingState.set(false);
      this.contactForm.get('contactTypeCode')?.setValue('');
      return;
    }

    this.contactTypeOptionsLoadingState.set(true);

    this.fieldCatalogService
      .loadContactTypeOptions(normalizedRuleSystemCode)
      .pipe(take(1))
      .subscribe({
        next: (options) => {
          if (requestId !== this.contactTypeRequestId) {
            return;
          }

          this.contactTypeOptionsLoadingState.set(false);
          this.contactTypeOptionsState.set(options);
          this.syncCreateSelectionWithAvailableOptions(options);
        },
        error: () => {
          if (requestId !== this.contactTypeRequestId) {
            return;
          }

          this.contactTypeOptionsLoadingState.set(false);
          this.contactTypeOptionsErrorState.set(this.texts.contactsCatalogLoadFailedMessage);
          if (this.isContactCreateMode()) {
            this.contactForm.get('contactTypeCode')?.setValue('');
          }
        },
      });
  }

  private syncCreateSelectionWithAvailableOptions(
    options: ReadonlyArray<SlotKeyOption<string>>,
  ): void {
    if (!this.isContactCreateMode()) {
      return;
    }

    const currentValue = `${this.contactForm.get('contactTypeCode')?.value ?? ''}`.trim();
    if (!currentValue) {
      return;
    }

    const hasMatchingValue = options.some((option) => option.value === currentValue);
    if (!hasMatchingValue) {
      this.contactForm.get('contactTypeCode')?.setValue('');
    }
  }

  private parseDate(value: string): Date | null {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
