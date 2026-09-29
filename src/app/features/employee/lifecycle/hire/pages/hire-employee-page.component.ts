import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { UiDateInputComponent } from '../../../../../shared/ui/date-input/ui-date-input.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  EmployeeHiringStore,
  HireEmployeeErrorCode,
} from '../../../data-access/employee-hiring.store';
import { EmployeeFieldCatalogService } from '../../../data-access/employee-field-catalog.service';
import { GlobalMessageService } from '../../../data-access/employee-global-message.store';
import { employeeTexts } from '../../../employee.texts';
import { RuleSystemsService } from '../../../../../core/api/generated/api/rule-systems.service';
import { CatalogsService } from '../../../../../core/api/generated/api/catalogs.service';
import { map, startWith, take } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { HIRE_EMPLOYEE_DEFAULTS } from '../../../models/hire-employee.defaults';
import { HireIdentifierOwner } from '../../../models/employee-hiring.model';
import { GlobalMessageRailComponent } from '../../../shell/components/global-message-rail.component';
import {
  buildWorkingTimePreview,
  formatWorkingTimeHours,
} from '../../../shared/utils/working-time-preview.util';
import { DISPLAY_DATE_FORMAT, currentLocalDate } from '../../../../../shared/utils/local-date.util';
import { B4IconComponent } from '../../../../../shared/ui/icon/b4-icon.component';
import { describeFailure, toHttpFailure } from '../../../../../shared/utils/http-failure.util';

/** El documento que se ofrece primero: el DNI, que es el de casi todos. */
const HIRE_IDENTIFIER_DEFAULT_TYPE = 'NATIONAL_ID';

type HireDependencyReasons = Record<string, string | null>;

@Component({
  selector: 'app-hire-employee-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SelectModule,
    InputTextModule,
    UiDateInputComponent,
    InputNumberModule,
    ButtonModule,
    B4IconComponent,
    CardModule,
    MessageModule,
    GlobalMessageRailComponent,
    RouterLink,
  ],
  templateUrl: './hire-employee-page.component.html',
  styleUrl: './hire-employee-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HireEmployeePageComponent {
  private static readonly GLOBAL_SOURCE_KEY = 'hire-employee-page';

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly hiringStore = inject(EmployeeHiringStore);
  private readonly catalogService = inject(EmployeeFieldCatalogService);
  private readonly ruleSystemsApi = inject(RuleSystemsService);
  private readonly catalogsApi = inject(CatalogsService);
  private readonly globalMessageService = inject(GlobalMessageService);

  protected readonly texts = employeeTexts;
  protected readonly displayDateFormat = DISPLAY_DATE_FORMAT;

  // Sin motivo de entrada: un alta es una contratación, y el servidor la da por HIRING
  // (`b4rrhh/backend#143`). El documento es obligatorio: es lo que impide dar de alta dos veces a
  // la misma persona (`b4rrhh/backend#141`).
  readonly form = this.fb.group({
    ruleSystemCode: ['', Validators.required],
    firstName: ['', Validators.required],
    lastName1: ['', Validators.required],
    lastName2: [''],
    preferredName: [''],
    identifierTypeCode: [HIRE_IDENTIFIER_DEFAULT_TYPE, Validators.required],
    identifierValue: ['', Validators.required],
    hireDate: [currentLocalDate(), Validators.required],
    companyCode: ['', Validators.required],
    workCenterCode: ['', Validators.required],
    contractTypeCode: ['', Validators.required],
    contractSubtypeCode: [''],
    agreementCode: ['', Validators.required],
    agreementCategoryCode: ['', Validators.required],
    workingTimePercentage: [
      null as number | null,
      [Validators.required, Validators.min(0.01), Validators.max(100)],
    ],
  });

  // Options
  readonly ruleSystems = signal<any[]>([]);
  readonly companies = signal<any[]>([]);
  readonly identifierTypes = signal<any[]>([]);
  readonly workCenters = signal<any[]>([]);
  readonly contractTypes = signal<any[]>([]);
  readonly contractSubtypes = signal<any[]>([]);
  readonly agreements = signal<any[]>([]);
  readonly agreementCategories = signal<any[]>([]);

  readonly catalogError = signal<string | null>(null);

  readonly hiring = this.hiringStore.hiring;
  readonly error = this.hiringStore.error;
  readonly result = this.hiringStore.result;
  /** Quién tiene ya el documento, si el servidor se negó por eso (`b4rrhh/backend#141`). */
  readonly identifierOwner = this.hiringStore.identifierOwner;
  readonly globalMessages = this.globalMessageService.messages;
  readonly globalMessageSummary = this.globalMessageService.summary;
  readonly globalMessageExpanded = this.globalMessageService.expanded;
  readonly formStatus = toSignal(this.form.statusChanges.pipe(startWith(this.form.status)), {
    initialValue: this.form.status,
  });
  readonly workingTimePreview = computed(() =>
    buildWorkingTimePreview(this.form.controls.workingTimePercentage.value),
  );
  readonly submitDisabled = computed(() => this.hiring() || this.formStatus() !== 'VALID');

  /**
   * Por qué un campo está cerrado todavía (`b4rrhh/frontend#95`): el orden del formulario es el
   * del dato, y lo que depende de otro no se abre hasta que ese otro tiene valor.
   */
  readonly blockedBy = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.dependencyReasons()),
    ),
    { initialValue: this.dependencyReasons() },
  );

  constructor() {
    this.globalMessageService.reset();
    this.hiringStore.reset();
    this.loadInitialCatalogs();
    this.syncDependentControls();
    this.form.valueChanges.subscribe(() => this.syncDependentControls());

    effect((onCleanup) => {
      const messages = this.buildGlobalMessages();
      untracked(() => {
        this.globalMessageService.setSourceMessages(
          HireEmployeePageComponent.GLOBAL_SOURCE_KEY,
          messages,
        );
      });
      onCleanup(() => {
        untracked(() =>
          this.globalMessageService.clearSourceMessages(
            HireEmployeePageComponent.GLOBAL_SOURCE_KEY,
          ),
        );
      });
    });

    effect(() => {
      const result = this.result();
      if (result) {
        untracked(() => {
          this.globalMessageService.success(this.texts.hireEmployeeSuccessMessage, {
            id: 'hire-employee-success',
            sectionId: 'relacion',
            sectionLabel: this.texts.relationAreaLabel,
          });
        });
      }
    });

    // El documento se comprueba al salir del campo, no al final (`b4rrhh/frontend#106`). Un valor
    // nuevo olvida al dueño del anterior; un tipo nuevo vuelve a preguntar.
    this.form.controls.identifierValue.valueChanges.subscribe(() =>
      this.hiringStore.forgetIdentifierOwner(),
    );
    this.form.controls.identifierTypeCode.valueChanges.subscribe(() => this.checkIdentifierOwner());

    // Mientras el documento tenga dueño, el control es inválido y «Contratar» se apaga solo: el
    // motivo va en el control, como los campos cerrados del #95, y la plantilla lo cuenta debajo.
    effect(() => {
      const owned = this.identifierOwner() !== null;
      untracked(() => this.markIdentifierOwned(owned));
    });

    this.form.get('ruleSystemCode')?.valueChanges.subscribe((rs: any) => {
      if (rs) {
        this.loadDependentCatalogs(rs);
      } else {
        this.resetOptions();
      }
    });

    // La vigencia se pregunta respecto al dia del alta, no respecto a hoy
    // (b4rrhh/frontend#32): si cambia la fecha, los desplegables se rehacen.
    this.form.get('hireDate')?.valueChanges.subscribe(() => {
      const rs = this.form.get('ruleSystemCode')?.value;
      if (rs) {
        this.loadDependentCatalogs(rs);
      }
    });

    this.form.get('contractTypeCode')?.valueChanges.subscribe((ct: any) => {
      const rs = this.form.get('ruleSystemCode')?.value;
      if (ct && rs) {
        this.loadContractSubtypes(rs, ct);
      } else {
        this.contractSubtypes.set([]);
      }
    });

    this.form.get('agreementCode')?.valueChanges.subscribe((ac: any) => {
      const rs = this.form.get('ruleSystemCode')?.value;
      if (ac && rs) {
        this.loadAgreementCategories(rs, ac);
      } else {
        this.agreementCategories.set([]);
      }
    });

    this.form.get('companyCode')?.valueChanges.subscribe((companyCode: any) => {
      const ruleSystemCode = this.form.get('ruleSystemCode')?.value;
      if (ruleSystemCode && companyCode) {
        this.loadWorkCentersByCompany(ruleSystemCode, companyCode);
      } else {
        this.workCenters.set([]);
        this.form.get('workCenterCode')?.setValue('');
      }
    });
  }

  private loadInitialCatalogs() {
    this.catalogError.set(null);
    this.ruleSystemsApi
      .listRuleSystems()
      .pipe(take(1))
      .subscribe({
        next: (rss) => {
          this.ruleSystems.set(
            (rss || []).map((rs) => ({ value: rs.code, label: `${rs.name} · ${rs.code}` })),
          );
        },
        error: (err: unknown) =>
          this.catalogError.set(
            describeFailure(this.texts.catalogLoadFailedMessage, toHttpFailure(err)),
          ),
      });
  }

  private loadDependentCatalogs(ruleSystemCode: string) {
    this.catalogError.set(null);
    this.workCenters.set([]);
    this.form.get('workCenterCode')?.setValue('');

    // El selector de fecha habla en texto `yyyy-MM-dd` (b4rrhh/frontend#96).
    const referenceDate = this.form.get('hireDate')?.value || null;

    (this.catalogService as any)
      .loadPresenceCompanyOptions(ruleSystemCode, referenceDate)
      .subscribe({
        next: (opts: any) => this.companies.set([...opts]),
        error: (err: unknown) =>
          this.catalogError.set(
            describeFailure(this.texts.catalogLoadFailedMessage, toHttpFailure(err)),
          ),
      });
    (this.catalogService as any)
      .loadIdentifierTypeOptions(ruleSystemCode, referenceDate)
      .subscribe({
        next: (opts: any) => this.identifierTypes.set([...opts]),
        error: (err: unknown) =>
          this.catalogError.set(
            describeFailure(this.texts.catalogLoadFailedMessage, toHttpFailure(err)),
          ),
      });
    (this.catalogService as any).loadContractTypeOptions(ruleSystemCode, referenceDate).subscribe({
      next: (opts: any) => this.contractTypes.set([...opts]),
      error: (err: unknown) =>
        this.catalogError.set(
          describeFailure(this.texts.catalogLoadFailedMessage, toHttpFailure(err)),
        ),
    });
    (this.catalogService as any)
      .loadLaborClassificationAgreementOptions(ruleSystemCode, referenceDate)
      .subscribe({
        next: (opts: any) => this.agreements.set([...opts]),
        error: (err: unknown) =>
          this.catalogError.set(
            describeFailure(this.texts.catalogLoadFailedMessage, toHttpFailure(err)),
          ),
      });
  }

  private loadWorkCentersByCompany(ruleSystemCode: string, companyCode: string) {
    (this.catalogService as any)
      .loadWorkCenterOptionsByCompany(ruleSystemCode, companyCode)
      .subscribe({
        next: (opts: any) => {
          this.workCenters.set([...opts]);

          const selectedWorkCenterCode = this.form.get('workCenterCode')?.value;
          if (
            selectedWorkCenterCode &&
            !opts.some((option: { value: string }) => option.value === selectedWorkCenterCode)
          ) {
            this.form.get('workCenterCode')?.setValue('');
          }
        },
        error: (err: unknown) =>
          this.catalogError.set(
            describeFailure(this.texts.catalogLoadFailedMessage, toHttpFailure(err)),
          ),
      });
  }

  private loadContractSubtypes(ruleSystemCode: string, contractTypeCode: string) {
    this.catalogsApi.listContractCatalogSubtypes({ ruleSystemCode, contractTypeCode }).subscribe({
      next: (resp) => {
        this.contractSubtypes.set(
          (resp || []).map((i) => ({ value: i.code, label: `${i.name} · ${i.code}` })),
        );
      },
      error: (err: unknown) =>
        this.catalogError.set(
          describeFailure(this.texts.catalogLoadFailedMessage, toHttpFailure(err)),
        ),
    });
  }

  private loadAgreementCategories(ruleSystemCode: string, agreementCode: string) {
    this.catalogsApi
      .listLaborClassificationAgreementCategories({ ruleSystemCode, agreementCode })
      .subscribe({
        next: (resp) => {
          this.agreementCategories.set(
            (resp || []).map((i) => ({ value: i.code, label: `${i.name} · ${i.code}` })),
          );
        },
        error: (err: unknown) =>
          this.catalogError.set(
            describeFailure(this.texts.catalogLoadFailedMessage, toHttpFailure(err)),
          ),
      });
  }

  private resetOptions() {
    this.workCenters.set([]);
    this.companies.set([]);
    this.identifierTypes.set([]);
    this.contractTypes.set([]);
    this.contractSubtypes.set([]);
    this.agreements.set([]);
    this.agreementCategories.set([]);
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.getRawValue();
    const identifierTypeCode = val.identifierTypeCode ?? HIRE_IDENTIFIER_DEFAULT_TYPE;
    const draft: any = {
      ...val,
      employeeTypeCode: HIRE_EMPLOYEE_DEFAULTS.employeeTypeCode,
      hireDate: val.hireDate,
      identifier: {
        identifierTypeCode,
        identifierValue: val.identifierValue ?? '',
        // El DNI y el NIE son españoles por definición; de otro documento no se sabe el país.
        issuingCountryCode: identifierTypeCode === HIRE_IDENTIFIER_DEFAULT_TYPE ? 'ESP' : null,
      },
      workingTime: {
        workingTimePercentage: val.workingTimePercentage,
      },
      costCenterDistribution: null,
    };

    this.hiringStore.hire(draft);
  }

  onCancel() {
    this.router.navigate(['/personas/empleados']);
  }

  /** Pregunta de quién es el documento escrito, si hay con qué preguntar. */
  protected checkIdentifierOwner(): void {
    const { ruleSystemCode, identifierTypeCode, identifierValue } = this.form.getRawValue();
    this.hiringStore.checkIdentifierOwner(
      ruleSystemCode ?? '',
      identifierTypeCode ?? '',
      identifierValue ?? '',
    );
  }

  private markIdentifierOwned(owned: boolean): void {
    const control = this.form.controls.identifierValue;
    if (owned === control.hasError('identifierOwned')) return;
    if (owned) {
      control.setErrors({ ...control.errors, identifierOwned: true });
      return;
    }
    // Quitar sólo el nuestro: los validadores vuelven a decir lo suyo.
    control.updateValueAndValidity({ emitEvent: false });
    this.form.updateValueAndValidity();
  }

  /** La ficha de quien ya tiene el documento. */
  protected ownerRoute(owner: HireIdentifierOwner): string[] {
    const { ruleSystemCode, employeeTypeCode, employeeNumber } = owner.employeeKey;
    return ['/personas/empleados', ruleSystemCode, employeeTypeCode, employeeNumber];
  }

  /** Su readmisión, que es el camino bueno si está cesado. */
  protected ownerRehireRoute(owner: HireIdentifierOwner): string[] {
    return [...this.ownerRoute(owner), 'rehire'];
  }

  private dependencyReasons(): HireDependencyReasons {
    const value = (name: string) => this.form.get(name)?.value;
    const noRuleSystem = value('ruleSystemCode') ? null : this.texts.hireEmployeeNeedsRuleSystem;
    return {
      identifierTypeCode: noRuleSystem,
      companyCode: noRuleSystem,
      workCenterCode:
        noRuleSystem ?? (value('companyCode') ? null : this.texts.hireEmployeeNeedsCompany),
      contractTypeCode: noRuleSystem,
      contractSubtypeCode:
        noRuleSystem ??
        (value('contractTypeCode') ? null : this.texts.hireEmployeeNeedsContractType),
      agreementCode: noRuleSystem,
      agreementCategoryCode:
        noRuleSystem ?? (value('agreementCode') ? null : this.texts.hireEmployeeNeedsAgreement),
    };
  }

  /**
   * Cierra lo que depende de un campo vacío y abre lo que ya puede elegirse. Con el estado del
   * control y no con `[disabled]` en la plantilla: en un formulario reactivo ese atributo no
   * deshabilita nada, y por eso el centro se podía abrir antes que la empresa.
   */
  private syncDependentControls(): void {
    const reasons = this.dependencyReasons();
    let changed = false;
    for (const [name, reason] of Object.entries(reasons)) {
      const control = this.form.get(name);
      if (!control) continue;
      if (reason && control.enabled) {
        control.disable({ emitEvent: false });
        changed = true;
      }
      if (!reason && control.disabled) {
        control.enable({ emitEvent: false });
        changed = true;
      }
    }
    // Abrir un campo vacío y obligatorio cambia la validez: que el botón se entere. La vuelta
    // que esto provoca ya no cambia nada, así que no hay bucle.
    if (changed) this.form.updateValueAndValidity();
  }

  protected toggleGlobalMessages(): void {
    this.globalMessageService.toggleExpanded();
  }

  protected closeGlobalMessages(): void {
    const summary = this.globalMessageSummary();
    if (summary.errorCount === 0 && summary.warningCount === 0) {
      this.globalMessageService.dismissTransientMessages();
      return;
    }

    this.globalMessageService.collapse();
  }

  protected workingTimePercentageError(): string | null {
    const control = this.form.controls.workingTimePercentage;
    if (!control.touched && !control.dirty) {
      return null;
    }

    if (control.hasError('required')) {
      return this.texts.hireEmployeeWorkingTimeRequiredMessage;
    }

    if (control.hasError('min') || control.hasError('max')) {
      return this.texts.hireEmployeeWorkingTimeRangeMessage;
    }

    return null;
  }

  protected formatHours(value: number): string {
    return formatWorkingTimeHours(value);
  }

  private buildGlobalMessages() {
    const messages = [];
    const catalogError = this.catalogError();
    if (catalogError) {
      messages.push({
        id: 'hire-catalog-error',
        level: 'error' as const,
        text: catalogError,
      });
    }

    const error = this.error() as HireEmployeeErrorCode | null;
    if (error) {
      messages.push({
        id: 'hire-request-error',
        level: 'error' as const,
        text: this.mapErrorMessage(error),
      });
    }

    return messages;
  }

  private mapErrorMessage(code: HireEmployeeErrorCode): string {
    if (code === 'already-exists') {
      // El servidor dice quién es («Este DNI ya es EMP000123…»): eso vale más que un genérico.
      const failure = this.hiringStore.failure();
      return failure?.serverMessage
        ? describeFailure(this.texts.hireEmployeeErrorMessage, failure)
        : this.texts.hireEmployeeConflictMessage;
    }

    if (code === 'invalid-catalog-value' || code === 'invalid-dependent-relation') {
      return this.texts.hireEmployeeInvalidCatalogMessage;
    }

    return describeFailure(this.texts.hireEmployeeErrorMessage, this.hiringStore.failure());
  }
}
