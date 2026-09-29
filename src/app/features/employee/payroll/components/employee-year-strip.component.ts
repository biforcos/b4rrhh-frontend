import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { EmployeeYearAbsence, EmployeeYearModel } from '../../models/employee-year.model';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';
import { PayrollPeriod } from '../../../../shared/utils/payroll-period.util';
import {
  AbsenceBar,
  layoutAbsenceBars,
  monthsWithPresence,
  periodOfBar,
} from './employee-year-strip.layout';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Lo que se pide al pulsar una barra: ir a su mes y resaltar esa ausencia en su tabla. */
export interface AbsencePick {
  readonly period: PayrollPeriod;
  readonly absenceTypeCode: string;
  readonly startDate: string;
}

/**
 * El año de un vistazo (`b4rrhh/frontend#109`): doce meses con tres carriles —ausencias que cruzan
 * meses, entradas de nómina y correcciones a meses entregados— y, de fondo, los meses en que no
 * estaba y los que ya se entregaron.
 *
 * <p>El mes elegido es un mes de la tira; la tira no se filtra nunca. Todo lo que se pinta es un
 * botón con nombre, para el teclado y para el lector, y la identidad no va sólo en el color: la
 * barra lleva el tipo al pasar por encima y una textura por clase de ausencia, y los puntos llevan
 * el número escrito. Sin leyenda: cada carril lleva su rótulo, y ya (`frontend#108`).
 *
 * <p>Sólo presentación: el año, los datos y el mes elegido vienen de la página, y lo que se pulsa
 * se le pide a ella.
 */
@Component({
  selector: 'app-employee-year-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-year-strip.component.html',
  styleUrl: './employee-year-strip.component.scss',
})
export class EmployeeYearStripComponent {
  readonly year = input.required<number>();
  readonly data = input<EmployeeYearModel | null>(null);
  readonly selectedPeriod = input<PayrollPeriod | null>(null);
  /** El nombre de cada tipo de ausencia; sin él se enseña el código. */
  readonly absenceTypeLabels = input<ReadonlyMap<string, string>>(new Map());
  /** Hasta dónde llega una ausencia abierta. Entrada para poder fijarlo en las pruebas. */
  readonly today = input<string>(currentLocalDate());

  readonly yearRequested = output<number>();
  readonly periodPicked = output<PayrollPeriod>();
  readonly absencePicked = output<AbsencePick>();
  readonly inputsPicked = output<PayrollPeriod>();
  readonly marksPicked = output<PayrollPeriod>();

  protected readonly months = computed(() => {
    const year = this.year();
    const data = this.data()?.year === year ? this.data() : null;
    const present = monthsWithPresence(data?.presences ?? [], year);
    return MONTHS.map((name, i) => {
      const period = year * 100 + i + 1;
      const month = data?.months.find((m) => m.period === period);
      return {
        period,
        short: name.slice(0, 3),
        name,
        present: present[i],
        closed: month?.payrollState === 'CLOSED',
        inputs: month?.payrollInputCount ?? 0,
        activeMarks: month?.activeRetroMarkCount ?? 0,
        consumedMarks: month?.consumedRetroMarkCount ?? 0,
      };
    });
  });

  protected readonly bars = computed<ReadonlyArray<AbsenceBar>>(() => {
    const data = this.data();
    return data && data.year === this.year()
      ? layoutAbsenceBars(data.absences, this.year(), this.today())
      : [];
  });

  protected readonly lanes = computed(() => Math.max(1, ...this.bars().map((b) => b.lane + 1)));

  protected monthLabel(m: { name: string; present: boolean; closed: boolean }): string {
    const parts = [`${m.name} de ${this.year()}`];
    if (m.closed) parts.push('entregado');
    if (!m.present) parts.push('no estaba');
    return parts.join(' · ');
  }

  protected barLabel(bar: AbsenceBar): string {
    const a = bar.absence;
    const type = this.typeLabel(a);
    const from = formatDisplayDate(a.startDate);
    return a.endDate === null
      ? `${type}, desde el ${from}, sin cerrar`
      : `${type}, del ${from} al ${formatDisplayDate(a.endDate)}`;
  }

  /** La textura va por clase de ausencia, para que el tipo no se diga sólo con el color. */
  protected barKind(a: EmployeeYearAbsence): 'baja' | 'vacaciones' | 'permiso' {
    if (a.absenceTypeCode.startsWith('IT_')) return 'baja';
    if (a.absenceTypeCode === 'VACATION') return 'vacaciones';
    return 'permiso';
  }

  protected inputsLabel(count: number, monthName: string): string {
    return `${count} ${count === 1 ? 'entrada' : 'entradas'} en ${monthName}`;
  }

  protected marksLabel(count: number, kind: 'active' | 'consumed', monthName: string): string {
    const word = count === 1 ? 'corrección' : 'correcciones';
    const state =
      kind === 'active'
        ? count === 1
          ? 'pendiente'
          : 'pendientes'
        : count === 1
          ? 'pagada'
          : 'pagadas';
    return `${count} ${word} de ${monthName} ${state}`;
  }

  protected pickBar(bar: AbsenceBar): void {
    this.absencePicked.emit({
      period: periodOfBar(bar, this.year()),
      absenceTypeCode: bar.absence.absenceTypeCode,
      startDate: bar.absence.startDate,
    });
  }

  private typeLabel(a: EmployeeYearAbsence): string {
    return this.absenceTypeLabels().get(a.absenceTypeCode) ?? a.absenceTypeCode;
  }
}
