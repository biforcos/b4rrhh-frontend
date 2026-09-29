import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { EmployeeAbsenceStore } from '../../data-access/employee-absence.store';
import { EmployeePayrollInputStore } from '../../data-access/employee-payroll-input.store';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeeRetroMarkStore } from '../../data-access/employee-retro-mark.store';
import { EmployeeYearStore } from '../../data-access/employee-year.store';
import { employeeTexts } from '../../employee.texts';
import { GlobalUiMessage } from '../../models/global-ui-message.model';
import { EmployeeAbsenceSectionComponent } from '../../presence/components/employee-absence-section.component';
import { readEmployeeBusinessKeyFromParamMap } from '../../routing/employee-route-key.util';
import { PayrollPeriod, currentPayrollPeriod } from '../../../../shared/utils/payroll-period.util';
import { EmployeeMonthNavigatorComponent } from '../components/employee-month-navigator.component';
import { EmployeePayrollInputSectionComponent } from '../components/employee-payroll-input-section.component';
import { EmployeeRetroMarkSectionComponent } from '../components/employee-retro-mark-section.component';
import {
  AbsencePick,
  EmployeeYearStripComponent,
} from '../components/employee-year-strip.component';
import { describeFailure } from '../../../../shared/utils/http-failure.util';

/**
 * Lo que pasa cada mes (`b4rrhh/frontend#90`): ausencias, entradas de nómina y correcciones a meses
 * entregados, con un solo navegador de período para las tres.
 *
 * Es lo que quedó de la página «Nómina», que mezclaba tres naturalezas: la información fiscal (que
 * es de la persona), lo que se mete cada mes (que es esto) y el salto a los recibos (que es lo que
 * sale). Las ausencias vinieron de la relación.
 */
@Component({
  selector: 'app-employee-month-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmployeeYearStripComponent,
    EmployeeMonthNavigatorComponent,
    EmployeeAbsenceSectionComponent,
    EmployeePayrollInputSectionComponent,
    EmployeeRetroMarkSectionComponent,
  ],
  templateUrl: './employee-month-page.component.html',
  styleUrl: './employee-month-page.component.scss',
})
export class EmployeeMonthPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly absenceStore = inject(EmployeeAbsenceStore);
  private readonly retroMarkStore = inject(EmployeeRetroMarkStore);
  private readonly payrollInputStore = inject(EmployeePayrollInputStore);
  private readonly globalMessageService = inject(GlobalMessageService);
  protected readonly yearStore = inject(EmployeeYearStore);

  private previousAbsenceSuccess: 'saved' | 'deleted' | null = null;
  private previousRetroMarkSuccess: string | null = null;

  protected readonly texts = employeeTexts;
  /** El mes del que hablan las tres secciones. Arranca en el del calendario. */
  protected readonly period = signal<PayrollPeriod>(currentPayrollPeriod());
  protected readonly activeEmployeeKey = toSignal(
    this.route.paramMap.pipe(map((params) => readEmployeeBusinessKeyFromParamMap(params))),
    { initialValue: readEmployeeBusinessKeyFromParamMap(this.route.snapshot.paramMap) },
  );

  /**
   * El feedback de las secciones lo publica la página al servicio global (ADR-022, ADR-023), que es
   * donde vive el feedback en este frontend. Las secciones no pintan banderines propios. El fallo de
   * cargar las entradas también: se decía que lo pintaba su sección y la sección no lo pintaba, así
   * que la ficha de un empleado que no existe decía «no hay entradas» (b4rrhh/backend#144).
   */
  /** El año que enseña la tira. Sigue al mes elegido; las flechas de la tira lo mueven solas. */
  protected readonly stripYear = signal(Math.floor(this.period() / 100));
  /** La fila de ausencia que resalta pulsar su barra: `tipo|inicio`, la clave de la sección. */
  protected readonly highlightedAbsenceKey = signal<string | null>(null);
  /** Las correcciones de este mes, resaltadas al pulsar su marca en la tira. */
  protected readonly highlightedMarksPeriod = signal<PayrollPeriod | null>(null);
  /** El nombre de cada tipo, del mismo sitio que la sección: sus filas. */
  protected readonly absenceTypeLabels = computed<ReadonlyMap<string, string>>(
    () => new Map(this.absenceStore.absences().map((a) => [a.absenceTypeCode, a.absenceTypeLabel])),
  );

  constructor() {
    // Un mes de otro año —por el atajo o desde una sección— se lleva la tira a su año.
    effect(() => {
      const year = Math.floor(this.period() / 100);
      untracked(() => this.stripYear.set(year));
    });

    // El año se vuelve a pedir cuando cambia algo de lo que cuenta: una ausencia, una entrada o
    // una corrección que se guarda o se descarta.
    effect(() => {
      const key = this.activeEmployeeKey();
      const year = this.stripYear();
      this.absenceStore.absences();
      this.retroMarkStore.marks();
      this.payrollInputStore.success();
      untracked(() => this.yearStore.load(key, year));
    });

    effect((onCleanup) => {
      const messages = this.buildGlobalMessages();
      untracked(() => this.globalMessageService.setSourceMessages('employee-month-page', messages));
      onCleanup(() =>
        untracked(() => this.globalMessageService.clearSourceMessages('employee-month-page')),
      );
    });

    effect(() => this.publishSuccessFeedback());
  }

  protected pickPeriod(period: PayrollPeriod): void {
    this.clearHighlights();
    this.period.set(period);
  }

  protected pickAbsence(pick: AbsencePick): void {
    this.clearHighlights();
    this.period.set(pick.period);
    this.highlightedAbsenceKey.set(`${pick.absenceTypeCode}|${pick.startDate}`);
  }

  protected pickInputs(period: PayrollPeriod): void {
    this.clearHighlights();
    this.period.set(period);
    scrollToSection('employee-section-payroll-inputs');
  }

  protected pickMarks(period: PayrollPeriod): void {
    this.clearHighlights();
    this.period.set(period);
    this.highlightedMarksPeriod.set(period);
  }

  private clearHighlights(): void {
    this.highlightedAbsenceKey.set(null);
    this.highlightedMarksPeriod.set(null);
  }

  private buildGlobalMessages(): ReadonlyArray<Omit<GlobalUiMessage, 'createdAt'>> {
    const t = this.texts;
    const messages: Array<Omit<GlobalUiMessage, 'createdAt'>> = [];
    const absenceText = this.mapAbsenceErrorMessage(this.absenceStore.error());
    if (absenceText) {
      messages.push({
        id: 'absence-error',
        level: 'error',
        text: absenceText,
        sectionId: 'absence',
        sectionLabel: t.absencesSectionTitle,
        sticky: true,
      });
    }
    const inputText = this.mapPayrollInputErrorMessage(this.payrollInputStore.error());
    if (inputText) {
      messages.push({
        id: 'payroll-input-error',
        level: 'error',
        text: inputText,
        sectionId: 'payroll-inputs',
        sectionLabel: t.payrollInputsSectionTitle,
        sticky: true,
      });
    }
    const retroText = this.mapRetroMarkErrorMessage(this.retroMarkStore.error());
    if (retroText) {
      messages.push({
        id: 'retro-mark-error',
        level: 'error',
        text: retroText,
        sectionId: 'retro-marks',
        sectionLabel: t.retroMarksSectionTitle,
        sticky: true,
      });
    }
    return messages;
  }

  private publishSuccessFeedback(): void {
    const t = this.texts;

    const absenceSuccess = this.absenceStore.success();
    if (absenceSuccess && absenceSuccess !== this.previousAbsenceSuccess) {
      untracked(() =>
        this.globalMessageService.success(
          { saved: t.absencesSaveSuccessMessage, deleted: t.absencesDeleteSuccessMessage }[
            absenceSuccess
          ],
          {
            id: `employee-month-page-success-absence-${absenceSuccess}`,
            sectionId: 'absence',
            sectionLabel: t.absencesSectionTitle,
          },
        ),
      );
    }
    this.previousAbsenceSuccess = absenceSuccess;

    const retroSuccess = this.retroMarkStore.success();
    if (retroSuccess && retroSuccess !== this.previousRetroMarkSuccess) {
      untracked(() =>
        this.globalMessageService.success(t.retroMarksDiscardSuccessMessage, {
          id: `employee-month-page-success-retro-${retroSuccess}`,
          sectionId: 'retro-marks',
          sectionLabel: t.retroMarksSectionTitle,
        }),
      );
    }
    this.previousRetroMarkSuccess = retroSuccess;
  }

  /**
   * El mensaje del error de ausencias (`b4rrhh/frontend#84`).
   *
   * <p>El solape y el «fuera de la presencia» tienen mensaje propio porque se arreglan de forma
   * distinta: uno cambiando las fechas de esta ausencia, el otro mirando si el empleado estaba en la
   * empresa esos días. Darles el mismo texto sería decirle a alguien «reinténtalo» cuando lo que
   * tiene que hacer es otra cosa.
   */
  private mapAbsenceErrorMessage(code: string | null): string | null {
    const t = this.texts;
    if (code === 'overlap') return t.absencesOverlapMessage;
    // El servidor nombra la presencia en la que empieza y cuándo acaba (b4rrhh/backend#147).
    if (code === 'outside-presence')
      return this.absenceStore.failure()?.serverMessage ?? t.absencesOutsidePresenceMessage;
    if (code === 'invalid-range') return t.absencesInvalidRangeMessage;
    if (code === 'not-found') return t.absencesNotFoundMessage;
    if (code === 'request-failed')
      return describeFailure(t.absencesRequestFailedMessage, this.absenceStore.failure());
    return null;
  }

  /** Los mismos textos que la sección calculaba y no enseñaba. */
  private mapPayrollInputErrorMessage(code: string | null): string | null {
    const t = this.texts;
    if (code === 'duplicate') return t.payrollInputsDuplicateMessage;
    if (code === 'not-found') return t.payrollInputsNotFoundMessage;
    if (code === 'request-failed')
      return describeFailure(t.payrollInputsRequestFailedMessage, this.payrollInputStore.failure());
    return null;
  }

  /**
   * «Ya no está pendiente» tiene mensaje propio y no cae en «reintenta», porque no se arregla
   * reintentando: la marca se pagó o la descartó otro mientras esta pantalla estaba abierta, y lo
   * que hay que hacer es recargar y mirar en qué quedó.
   */
  private mapRetroMarkErrorMessage(code: string | null): string | null {
    const t = this.texts;
    if (code === 'not-active') return t.retroMarksNotActiveMessage;
    if (code === 'not-found') return t.retroMarksNotFoundMessage;
    if (code === 'reason-required') return t.retroMarksReasonRequiredMessage;
    if (code === 'request-failed')
      return describeFailure(t.retroMarksLoadFailedMessage, this.retroMarkStore.failure());
    return null;
  }
}

/** Bajar hasta una sección de la página, después de que el mes nuevo se haya pintado. */
function scrollToSection(id: string): void {
  setTimeout(() =>
    document.getElementById(id)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }),
  );
}
