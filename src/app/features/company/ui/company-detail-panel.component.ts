import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';

import { companyTexts } from '../company.texts';
import { buildCompanyFormValueFromDetail, buildEmptyCompanyFormValue } from '../mapper/company-form.mapper';
import { CompanyDetailModel } from '../models/company-detail.model';
import { CompanyFormValue } from '../models/company-form-value.model';
import { UiButtonComponent } from '../../../shared/ui/button/ui-button.component';
import { EntityHeaderComponent, EntityHeaderMetadataItem, EntityHeaderStatus } from '../../../shared/ui/entity-header/entity-header.component';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { formatDisplayDate } from '../../../shared/utils/local-date.util';

export type CompanyFormMode = 'create' | 'edit';
export type CompanyDetailMode = 'create' | 'view' | 'edit';

@Component({
  selector: 'app-company-detail-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    DatePickerModule,
    TextareaModule,
    MessageModule,
    UiButtonComponent,
    EntityHeaderComponent,
    SectionCardComponent,
  ],
  templateUrl: './company-detail-panel.component.html',
  styleUrl: './company-detail-panel.component.scss',
})
export class CompanyDetailPanelComponent implements OnChanges {
  readonly mode = input.required<CompanyDetailMode>();
  readonly detail = input<CompanyDetailModel | null>(null);
  readonly submitting = input(false);
  readonly submitError = input<string | null>(null);
  readonly submitSuccess = input<'created' | 'updated' | null>(null);

  readonly editRequested = output<void>();
  readonly submitted = output<CompanyFormValue>();
  readonly cancelled = output<void>();

  protected readonly texts = companyTexts;
  private readonly fb = inject(FormBuilder);

  readonly form: FormGroup;
  protected readonly isCreateMode = computed(() => this.mode() === 'create');
  protected readonly isEditMode = computed(() => this.mode() === 'edit');
  protected readonly isViewMode = computed(() => this.mode() === 'view');

  constructor() {
    this.form = this.fb.group({
      ruleSystemCode: [{ value: '', disabled: false }, [Validators.required, Validators.maxLength(5)]],
      companyCode: [{ value: '', disabled: false }, [Validators.required, Validators.maxLength(30)]],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      startDate: [{ value: '', disabled: false }, [Validators.required]],
      legalName: ['', [Validators.required, Validators.maxLength(200)]],
      taxIdentifier: ['', [Validators.maxLength(50)]],
      street: ['', [Validators.maxLength(300)]],
      city: ['', [Validators.maxLength(120)]],
      postalCode: ['', [Validators.maxLength(20)]],
      regionCode: ['', [Validators.maxLength(30)]],
      countryCode: ['', [Validators.maxLength(3)]],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mode'] || changes['detail']) {
      this.rebuildForm();
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

  protected get entityStatusLabel(): string {
    const detail = this.detail();
    if (!detail) {
      return this.texts.draftLabel;
    }

    return detail.active ? this.texts.activeLabel : this.texts.inactiveLabel;
  }

  protected get entityStatusSeverity(): 'success' | 'warn' | 'secondary' {
    const detail = this.detail();
    if (!detail) {
      return 'secondary';
    }

    return detail.active ? 'success' : 'warn';
  }

  protected get entityHeaderStatus(): EntityHeaderStatus {
    return {
      label: this.entityStatusLabel,
      severity: this.entityStatusSeverity,
    };
  }

  protected get entityHeaderMetadata(): ReadonlyArray<EntityHeaderMetadataItem> {
    return [
      { label: this.texts.detailHeaderCompanyCodeLabel, value: this.entityCompanyCode },
      { label: this.texts.detailHeaderRuleSystemLabel, value: this.entityRuleSystemCode },
      { label: this.texts.detailHeaderStartDateLabel, value: this.entityStartDate },
    ];
  }

  protected get entitySubtitle(): string | null {
    const description = this.detail()?.description?.trim() ?? '';
    return description || null;
  }

  protected get entityRuleSystemCode(): string {
    return ((this.form.getRawValue()['ruleSystemCode'] as string | null) ?? '').trim() || '—';
  }

  protected get entityCompanyCode(): string {
    return ((this.form.getRawValue()['companyCode'] as string | null) ?? '').trim() || '—';
  }

  protected get entityStartDate(): string {
    const raw = this.form.getRawValue()['startDate'] as Date | string | null;

    return formatDisplayDate(raw) || '—';
  }

  protected get hasAddress(): boolean {
    const detail = this.detail();
    if (!detail) {
      return false;
    }

    return [
      detail.address.street,
      detail.address.city,
      detail.address.postalCode,
      detail.address.regionCode,
      detail.address.countryCode,
    ].some((value) => !!value);
  }

  protected requestEdit(): void {
    this.editRequested.emit();
  }

  protected displayValue(value: string | null | undefined): string {
    const normalized = value?.trim();
    return normalized ? normalized : this.texts.detailViewEmptyValue;
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

  private rebuildForm(): void {
    const mode = this.mode();
    const detail = this.detail();

    const initialValue = detail
      ? this.toFormState(buildCompanyFormValueFromDetail(detail))
      : this.toFormState(buildEmptyCompanyFormValue());

    this.form.reset(initialValue);
    this.form.markAsPristine();
    this.form.markAsUntouched();

    if (mode === 'edit') {
      this.form.get('ruleSystemCode')?.disable();
      this.form.get('companyCode')?.disable();
      this.form.get('startDate')?.disable();
    } else {
      this.form.get('ruleSystemCode')?.enable();
      this.form.get('companyCode')?.enable();
      this.form.get('startDate')?.enable();
    }
  }

  private toFormState(value: CompanyFormValue): Record<string, string | Date | null> {
    return {
      ...value,
      startDate: value.startDate ? this.parseDate(value.startDate) : null,
    };
  }

  private getRawFormValue(): CompanyFormValue {
    const raw = this.form.getRawValue();
    return {
      ruleSystemCode: raw['ruleSystemCode'] ?? '',
      companyCode: raw['companyCode'] ?? '',
      name: raw['name'] ?? '',
      description: raw['description'] ?? '',
      startDate: raw['startDate'] instanceof Date ? this.toIsoDate(raw['startDate']) : (raw['startDate'] ?? ''),
      legalName: raw['legalName'] ?? '',
      taxIdentifier: raw['taxIdentifier'] ?? '',
      street: raw['street'] ?? '',
      city: raw['city'] ?? '',
      postalCode: raw['postalCode'] ?? '',
      regionCode: raw['regionCode'] ?? '',
      countryCode: raw['countryCode'] ?? '',
    };
  }

  private parseDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }

    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}