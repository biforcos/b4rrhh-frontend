import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';

import {
  EmployeePresenceRectificationClient,
  PresenceRectificationField,
} from '../../../../core/api/clients/employee-presence-rectification.client';
import { RectifyPresenceDateResponse } from '../../../../core/api/generated/model/rectify-presence-date-response';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { describeFailure, toHttpFailure } from '../../../../shared/utils/http-failure.util';
import { formatDisplayDate } from '../../../../shared/utils/local-date.util';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { PeriodModalComponent } from '../../shared/ui/period-modal/period-modal.component';

/**
 * Corregir la fecha de alta o de cese de una presencia (`b4rrhh/frontend#135`, `b4rrhh/backend#172`).
 *
 * <p>La sesión de `workspace#18` dio de alta a alguien el 01/10 por error y acabó en «jaque mate»: la
 * presencia sólo se podía cerrar. Esto la rectifica, y con ella lo que empezó (o acabó) ese día. Antes
 * de confirmar se ensaya (`dryRun`) y se enseña lo que va a cambiar, nombrado; si el servidor se niega,
 * se enseña su porqué con sus palabras. Al confirmar, la ficha se relee sola: el POST pasa por el
 * interceptor de escrituras (`b4rrhh/frontend#99`); el ensayo no.</p>
 */
@Component({
  selector: 'app-employee-presence-date-correction',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PeriodModalComponent, UiDateInputComponent],
  template: `
    <app-period-modal
      [title]="title()"
      [subtitle]="subtitle()"
      [visible]="true"
      [saving]="submitting()"
      [submitEnabled]="canSubmit()"
      [submitLabel]="texts.presenceCorrectSubmitAction"
      [note]="note()"
      [noteTone]="failure() ? 'error' : 'info'"
      (visibleChange)="$event || closed.emit()"
      (submitted)="submit()"
      (cancelled)="closed.emit()"
    >
      <label class="employee-presence-date-correction__field">
        <span>{{ texts.presenceCorrectNewDateLabel }}</span>
        <app-ui-date-input
          inputId="presenceCorrectNewDate"
          [ariaLabel]="texts.presenceCorrectNewDateLabel"
          [value]="newDate()"
          (valueChanged)="dateChanged($event)"
        />
      </label>
    </app-period-modal>
  `,
  styleUrl: './employee-presence-date-correction.component.scss',
})
export class EmployeePresenceDateCorrectionComponent {
  readonly employeeKey = input.required<EmployeeBusinessKey>();
  readonly presenceNumber = input.required<number>();
  readonly field = input.required<PresenceRectificationField>();
  /** La fecha que tiene ahora, la que se corrige. */
  readonly currentDate = input.required<string>();
  readonly closed = output<void>();

  protected readonly texts = employeeTexts;

  private readonly client = inject(EmployeePresenceRectificationClient);
  private readonly globalMessageService = inject(GlobalMessageService);

  protected readonly newDate = signal('');
  protected readonly checking = signal(false);
  protected readonly submitting = signal(false);
  /** El ensayo de la fecha escrita: lo que va a cambiar. */
  protected readonly plan = signal<RectifyPresenceDateResponse | null>(null);
  /** El porqué del servidor, con sus palabras. */
  protected readonly failure = signal<string | null>(null);

  private readonly trials = new Subject<string>();

  protected readonly title = computed(() =>
    this.field() === 'START_DATE'
      ? this.texts.presenceCorrectStartTitle
      : this.texts.presenceCorrectEndTitle,
  );

  protected readonly subtitle = computed(
    () =>
      `Presencia ${this.presenceNumber()}: ${this.field() === 'START_DATE' ? 'alta' : 'cese'} del ${formatDisplayDate(this.currentDate())}`,
  );

  protected readonly note = computed<ReadonlyArray<string> | string>(() => {
    const failure = this.failure();
    if (failure) return failure;
    if (this.checking()) return this.texts.presenceCorrectCheckingMessage;
    const plan = this.plan();
    if (!plan) return this.texts.presenceCorrectPromptMessage;
    const others = plan.moves.filter((move) => move.vertical !== 'presence');
    const head = `Pasa del ${formatDisplayDate(plan.oldDate)} al ${formatDisplayDate(plan.newDate)}.`;
    if (others.length === 0) return [head, this.texts.presenceCorrectNothingElseMovesLabel];
    return [
      head,
      this.texts.presenceCorrectAlsoMovesLabel,
      ...others.map(
        (move) =>
          `${move.label}: ${span(move.startDate, move.endDate)} → ${span(move.newStartDate, move.newEndDate)}`,
      ),
    ];
  });

  protected readonly canSubmit = computed(
    () =>
      !!this.plan() &&
      !this.failure() &&
      !this.checking() &&
      !this.submitting() &&
      this.plan()?.newDate === this.newDate(),
  );

  constructor() {
    this.trials
      .pipe(
        tap(() => {
          this.plan.set(null);
          this.failure.set(null);
          this.checking.set(true);
        }),
        switchMap((date) =>
          this.client
            .rectify(this.employeeKey(), this.presenceNumber(), this.field(), date, true)
            .pipe(
              catchError((err) => {
                this.checking.set(false);
                this.failure.set(
                  describeFailure(this.texts.presenceCorrectCheckAction, toHttpFailure(err)),
                );
                return EMPTY;
              }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((plan) => {
        this.checking.set(false);
        this.plan.set(plan);
      });
  }

  protected dateChanged(date: string): void {
    this.newDate.set(date);
    if (!date) {
      this.plan.set(null);
      this.failure.set(null);
      return;
    }
    this.trials.next(date);
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.client
      .rectify(this.employeeKey(), this.presenceNumber(), this.field(), this.newDate(), false)
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.globalMessageService.success(
            `${this.texts.presenceCorrectDoneMessage}: ${formatDisplayDate(result.oldDate)} → ${formatDisplayDate(result.newDate)}.`,
            {
              id: 'employee-presence-date-corrected',
              sectionId: 'relacion',
              sectionLabel: this.texts.relationAreaLabel,
            },
          );
          this.closed.emit();
        },
        error: (err) => {
          this.submitting.set(false);
          this.failure.set(
            describeFailure(this.texts.presenceCorrectSubmitAction, toHttpFailure(err)),
          );
        },
      });
  }
}

function span(start: string, end: string | null | undefined): string {
  return end
    ? `del ${formatDisplayDate(start)} al ${formatDisplayDate(end)}`
    : `desde el ${formatDisplayDate(start)}`;
}
