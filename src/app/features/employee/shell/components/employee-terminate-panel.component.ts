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
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CardModule } from 'primeng/card';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeDetailStore } from '../../data-access/employee-detail.store';
import { EmployeeJourneyStore } from '../../data-access/employee-journey.store';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeCostCenterStore } from '../../data-access/employee-cost-center.store';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { TerminateEmployeeResponse } from '../../../../core/api/generated/model/terminate-employee-response';
import { BASE_PATH } from '../../../../core/api/generated/variables';
import { PanelComponent } from '../../../../shared/ui/panel/panel.component';
import { UiTagComponent } from '../../../../shared/ui/tag/ui-tag.component';
import { DISPLAY_DATE_FORMAT } from '../../../../shared/utils/local-date.util';
import { employeeTexts } from '../../employee.texts';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';

@Component({
  selector: 'app-employee-terminate-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PanelComponent, CardModule, UiTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-panel [title]="texts.terminatePanelTitle">
      <form [formGroup]="form" (ngSubmit)="submit()" class="employee-terminate__form">
        <label>{{ texts.terminatePanelTerminationDateLabel }}</label>
        <input type="date" formControlName="terminationDate" />

        <label>{{ texts.terminatePanelExitReasonLabel }}</label>
        <select formControlName="exitReasonCode" [attr.aria-busy]="optionsLoading()">
          <option value="" disabled>
            {{
              optionsLoading()
                ? texts.terminatePanelLoadingExitReasonsPlaceholder
                : texts.terminatePanelSelectExitReasonPlaceholder
            }}
          </option>
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
        @if (!optionsLoading() && options().length === 0) {
          <p class="employee-terminate__empty">{{ texts.terminatePanelEmptyOptionsMessage }}</p>
        }

        <div class="employee-terminate__actions">
          <button type="button" (click)="cancel()">{{ texts.terminatePanelCancelAction }}</button>
          <button
            type="submit"
            [disabled]="submitting() || form.invalid || optionsLoading() || options().length === 0"
          >
            {{ texts.terminatePanelSubmitAction }}
          </button>
        </div>
      </form>

      @if (terminationResult(); as result) {
        <p-card
          [header]="texts.terminatePanelSummaryTitle"
          styleClass="employee-terminate__summary"
        >
          <div class="employee-terminate__summary-grid">
            <div class="employee-terminate__summary-row">
              <span class="employee-terminate__summary-label">{{
                texts.terminatePanelSummaryDateLabel
              }}</span>
              <span>{{ result.terminationDate | date: displayDateFormat }}</span>
            </div>
            <div class="employee-terminate__summary-row">
              <span class="employee-terminate__summary-label">{{
                texts.terminatePanelSummaryReasonLabel
              }}</span>
              <span>{{ getExitReasonLabel(result.exitReasonCode) }}</span>
            </div>
            <div class="employee-terminate__summary-row">
              <span class="employee-terminate__summary-label">{{
                texts.terminatePanelSummaryStatusLabel
              }}</span>
              <app-ui-tag [value]="mapStatus(result.status)" severity="success" />
            </div>
          </div>

          @if (result.closedWorkingTime; as closedWorkingTime) {
            <div
              class="employee-terminate__working-time"
              data-testid="termination-working-time-summary"
            >
              <h4 class="employee-terminate__working-time-title">
                {{ texts.terminatePanelSummaryWorkingTimeTitle }}
              </h4>
              <p class="employee-terminate__working-time-primary">
                {{ formatHours(closedWorkingTime.workingTimePercentage) }}% jornada
              </p>
              <p>
                {{ formatHours(closedWorkingTime.weeklyHours) }}h/semana ·
                {{ formatHours(closedWorkingTime.dailyHours) }}h/día ·
                {{ formatHours(closedWorkingTime.monthlyHours) }}h/mes
              </p>
              <p>
                {{ closedWorkingTime.startDate | date: displayDateFormat }} →
                {{ closedWorkingTime.endDate | date: displayDateFormat }}
              </p>
            </div>
          }
        </p-card>
      }
    </app-panel>
  `,
  styleUrl: './employee-terminate-panel.component.scss',
})
export class EmployeeTerminatePanelComponent {
  private static readonly GLOBAL_FEEDBACK_SOURCE_KEY = 'employee-terminate-panel';

  protected readonly texts = employeeTexts;
  protected readonly displayDateFormat = DISPLAY_DATE_FORMAT;
  /** Single required business key input. The panel expects a populated key when opened. */
  readonly employeeKey = input<
    import('../../models/employee-business-key.model').EmployeeBusinessKey | undefined
  >(undefined);
  readonly closed = output<void>();

  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);
  private readonly fieldCatalog = inject(EmployeeFieldCatalogService);
  private readonly detailStore = inject(EmployeeDetailStore);
  private readonly journeyStore = inject(EmployeeJourneyStore);
  private readonly presenceStore = inject(EmployeePresenceStore);
  private readonly workCenterStore = inject(EmployeeWorkCenterStore);
  private readonly costCenterStore = inject(EmployeeCostCenterStore);
  private readonly globalMessageService = inject(GlobalMessageService);

  readonly form = new FormGroup({
    terminationDate: new FormControl('', { nonNullable: true }),
    exitReasonCode: new FormControl('', { nonNullable: true }),
  });

  readonly options = signal<ReadonlyArray<SlotKeyOption<string>>>([]);
  readonly optionsLoading = signal(false);
  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly terminationResult = signal<TerminateEmployeeResponse | null>(null);

  constructor() {
    effect(() => {
      const key = this.employeeKey();
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

      const sub = this.fieldCatalog.loadPresenceExitReasonOptions(rs).subscribe({
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
          this.errorMsg.set(this.texts.terminatePanelLoadExitReasonsErrorMessage);
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
    this.terminationResult.set(null);

    const url = `${this.basePath}/employees/${encodeURIComponent(rs)}/${encodeURIComponent(et)}/${encodeURIComponent(en)}/terminate`;

    this.http
      .post<TerminateEmployeeResponse>(url, payload, { observe: 'response' as const })
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          this.terminationResult.set(response.body ?? null);
          // refresh stores: detail, journey, presences and work centers
          const key: EmployeeBusinessKey = {
            ruleSystemCode: rs,
            employeeTypeCode: et,
            employeeNumber: en,
          };
          this.detailStore.loadEmployeeDetailByBusinessKey(key);
          this.journeyStore.loadJourneyByBusinessKey(key);
          this.presenceStore.loadPresencesByBusinessKey(key);
          this.workCenterStore.loadWorkCenters(key);
          this.costCenterStore.loadCostCenters(key);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          if (err.status === 400) {
            this.errorMsg.set(this.texts.terminatePanelInvalidPayloadMessage);
          } else if (err.status === 404) {
            this.errorMsg.set(this.texts.terminatePanelEmployeeNotFoundMessage);
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

  protected formatHours(value: number): string {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);
  }

  protected mapStatus(status: string): string {
    if (status === 'TERMINATED') {
      return this.texts.employeeStatusInactiveLabel;
    }

    return status;
  }

  protected getExitReasonLabel(code: string): string {
    return this.options().find((option) => option.value === code)?.label ?? code;
  }
}
