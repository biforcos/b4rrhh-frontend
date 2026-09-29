import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  isDevMode,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { TerminateEmployeeResponse } from '../../../../core/api/generated/model/terminate-employee-response';
import { BASE_PATH } from '../../../../core/api/generated/variables';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { PeriodModalComponent } from '../../shared/ui/period-modal/period-modal.component';
import { employeeTexts } from '../../employee.texts';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { describeFailure, toHttpFailure } from '../../../../shared/utils/http-failure.util';
import { formatDisplayDate } from '../../../../shared/utils/local-date.util';

@Component({
  selector: 'app-employee-terminate-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PeriodModalComponent,
    UiDateInputComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // El cese es un modal como los demás de la ficha, con su molde y sus verbos (b4rrhh/frontend#98):
  // antes era un panel plano en el hueco del historial, «ahí tirado», y sin estilos.
  template: `
    <app-period-modal
      [title]="texts.terminatePanelTitle"
      [subtitle]="subtitle()"
      [visible]="true"
      [saving]="submitting()"
      [submitEnabled]="canSubmit()"
      [submitLabel]="texts.terminatePanelSubmitAction"
      [note]="errorMsg()"
      noteTone="error"
      (visibleChange)="$event || cancel()"
      (submitted)="submit()"
      (cancelled)="cancel()"
    >
      <label class="employee-terminate__field">
        <span>{{ texts.terminatePanelTerminationDateLabel }}</span>
        <app-ui-date-input
          inputId="terminationDate"
          [ariaLabel]="texts.terminatePanelTerminationDateLabel"
          [value]="form.controls.terminationDate.value"
          (valueChanged)="form.controls.terminationDate.setValue($event)"
        />
      </label>

      <label class="employee-terminate__field">
        <span>{{ texts.terminatePanelExitReasonLabel }}</span>
        <app-ui-select
          inputId="exitReasonCode"
          [ariaLabel]="texts.terminatePanelExitReasonLabel"
          [options]="options()"
          [value]="form.controls.exitReasonCode.value"
          [disabled]="optionsLoading()"
          [placeholder]="
            optionsLoading()
              ? texts.terminatePanelLoadingExitReasonsPlaceholder
              : texts.terminatePanelSelectExitReasonPlaceholder
          "
          (valueChanged)="form.controls.exitReasonCode.setValue($event)"
        />
      </label>
      @if (!optionsLoading() && options().length === 0) {
        <p class="employee-terminate__empty">{{ texts.terminatePanelEmptyOptionsMessage }}</p>
      }
    </app-period-modal>
  `,
  styleUrl: './employee-terminate-panel.component.scss',
})
export class EmployeeTerminatePanelComponent {
  private static readonly GLOBAL_FEEDBACK_SOURCE_KEY = 'employee-terminate-panel';

  protected readonly texts = employeeTexts;
  /** Single required business key input. The panel expects a populated key when opened. */
  readonly employeeKey = input<
    import('../../models/employee-business-key.model').EmployeeBusinessKey | undefined
  >(undefined);
  readonly closed = output<void>();
  /** A quién se da de baja, para el subtítulo del modal. */
  readonly employeeName = input<string | null>(null);

  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);
  private readonly fieldCatalog = inject(EmployeeFieldCatalogService);
  private readonly globalMessageService = inject(GlobalMessageService);

  readonly form = new FormGroup({
    terminationDate: new FormControl('', { nonNullable: true }),
    exitReasonCode: new FormControl('', { nonNullable: true }),
  });

  readonly options = signal<ReadonlyArray<SlotKeyOption<string>>>([]);
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  readonly optionsLoading = signal(false);
  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);

  /** La fecha del cese, como señal, para que el catálogo se rehaga cuando cambie. */
  private readonly terminationDateSignal = signal('');

  constructor() {
    this.form.controls.terminationDate.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.terminationDateSignal.set(value ?? ''));

    effect(() => {
      const key = this.employeeKey();
      // La vigencia de un motivo de salida se pregunta respecto al día del cese, no
      // respecto a hoy (b4rrhh/frontend#32).
      const referenceDate = this.terminationDateSignal() || null;
      if (!key) {
        // Panel opened without a valid employee key – reproducible error in dev
        if (isDevMode()) {
          console.error('[TerminatePanel] missing required EmployeeBusinessKey input');
        }
        this.options.set([]);
        return;
      }

      const rs = key.ruleSystemCode;
      if (!rs || rs.trim().length === 0) {
        if (isDevMode()) {
          console.error(
            '[TerminatePanel] employee key provided but ruleSystemCode is missing',
            key,
          );
        }
        this.options.set([]);
        return;
      }

      // Log once that we received the business key and ruleSystemCode (dev mode)
      if (isDevMode()) {
        console.debug('[TerminatePanel] received employeeKey', key);
        console.debug('[TerminatePanel] using ruleSystemCode', rs);
      }

      this.optionsLoading.set(true);

      const sub = this.fieldCatalog.loadPresenceExitReasonOptions(rs, referenceDate).subscribe({
        next: (opts) => {
          this.options.set(opts);
          this.optionsLoading.set(false);
          if (isDevMode()) {
            console.debug('[TerminatePanel] loaded options', opts.length);
          }
        },
        error: (e) => {
          this.options.set([]);
          this.optionsLoading.set(false);
          this.errorMsg.set(
            describeFailure(this.texts.terminatePanelLoadExitReasonsErrorMessage, toHttpFailure(e)),
          );
          if (isDevMode()) {
            console.warn('[TerminatePanel] failed loading exit reasons', e);
          }
        },
      });

      return () => sub.unsubscribe();
    });

    effect((onCleanup) => {
      const errorMessage = this.errorMsg()?.trim() ?? '';

      if (errorMessage.length > 0) {
        this.globalMessageService.setSourceMessages(
          EmployeeTerminatePanelComponent.GLOBAL_FEEDBACK_SOURCE_KEY,
          [
            {
              id: 'employee-terminate-panel-error',
              level: 'error',
              text: errorMessage,
              sectionId: 'journey',
              sectionLabel: this.texts.timelineTitle,
              sticky: true,
            },
          ],
        );
      } else {
        this.globalMessageService.clearSourceMessages(
          EmployeeTerminatePanelComponent.GLOBAL_FEEDBACK_SOURCE_KEY,
        );
      }

      onCleanup(() => {
        this.globalMessageService.clearSourceMessages(
          EmployeeTerminatePanelComponent.GLOBAL_FEEDBACK_SOURCE_KEY,
        );
      });
    });
  }

  cancel(): void {
    this.errorMsg.set(null);
    this.closed.emit();
  }

  submit(): void {
    if (this.submitting()) {
      return;
    }

    const key = this.employeeKey();
    if (!key) {
      this.errorMsg.set(this.texts.terminatePanelMissingEmployeeKeyMessage);
      if (isDevMode()) {
        console.error('[TerminatePanel] submit called without employeeKey');
      }
      return;
    }

    const rs = key.ruleSystemCode;
    const et = key.employeeTypeCode;
    const en = key.employeeNumber;

    const payload = {
      terminationDate: this.form.controls.terminationDate.value,
      exitReasonCode: this.form.controls.exitReasonCode.value,
    };

    this.submitting.set(true);
    this.errorMsg.set(null);

    const url = `${this.basePath}/employees/${encodeURIComponent(rs)}/${encodeURIComponent(et)}/${encodeURIComponent(en)}/terminate`;

    this.http
      .post<TerminateEmployeeResponse>(url, payload, { observe: 'response' as const })
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          const result = response.body;
          this.globalMessageService.success(
            result
              ? `${this.texts.terminatePanelDoneMessage} ${formatDisplayDate(result.terminationDate)}.`
              : `${this.texts.terminatePanelDoneMessage}.`,
            {
              id: 'employee-terminate-done',
              sectionId: 'journey',
              sectionLabel: this.texts.timelineTitle,
            },
          );
          this.closed.emit();
          // La ficha se relee sola: el POST del cese pasa por el interceptor de escrituras y
          // EmployeeFichaRefresher relee cabecera, presencia y línea de vida (b4rrhh/frontend#99).
          // Aquí se pedían con los load…, que no hacen nada si la clave es la misma: por eso hacía
          // falta un F5.
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          if (err.status === 400) {
            this.errorMsg.set(this.texts.terminatePanelInvalidPayloadMessage);
          } else if (err.status === 404) {
            this.errorMsg.set(this.texts.terminatePanelEmployeeNotFoundMessage);
          } else if (toHttpFailure(err).serverMessage) {
            // El servidor dice por qué no (un solape, un motivo no vigente): eso vale más que el
            // genérico (b4rrhh/frontend#92).
            this.errorMsg.set(
              describeFailure(this.texts.terminatePanelSubmitAction, toHttpFailure(err)),
            );
          } else if (err.status === 409) {
            this.errorMsg.set(this.texts.terminatePanelConflictMessage);
          } else if (err.status === 422) {
            this.errorMsg.set(this.texts.terminatePanelBusinessValidationMessage);
          } else {
            this.errorMsg.set(this.texts.terminatePanelRequestFailedMessage);
          }
        },
      });
  }

  protected readonly subtitle = computed(() => {
    const name = this.employeeName();
    return name ? `${this.texts.terminatePanelSubtitlePrefix} ${name}` : null;
  });

  protected readonly canSubmit = computed(
    () =>
      !this.optionsLoading() &&
      this.options().length > 0 &&
      (this.formValue().terminationDate ?? '').length > 0 &&
      (this.formValue().exitReasonCode ?? '').length > 0,
  );
}
