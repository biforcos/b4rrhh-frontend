import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { B4IconComponent } from '../../../../shared/ui/icon/b4-icon.component';
import { B4IconName } from '../../../../shared/ui/icon/icon-names';
import { formatDisplayDate, parseLocalDate } from '../../../../shared/utils/local-date.util';
import { employeeTexts } from '../../employee.texts';
import { EmployeeContractModel } from '../../models/employee-contract.model';
import { EmployeeLaborClassificationModel } from '../../models/employee-labor-classification.model';
import { EmployeePresenceModel } from '../../models/employee-presence.model';
import { EmployeeWorkCenterModel } from '../../models/employee-work-center.model';
import { EmployeeWorkingTimeModel } from '../../models/employee-working-time.model';
import { EmployeeRouteSection } from '../../routing/employee-route-builder.util';

export interface LifelineSegment {
  id: string;
  /** ISO. */
  start: string;
  /** ISO, o null si el tramo está abierto. */
  end: string | null;
  label: string;
  /** Lo que cuenta el título al pasar por encima; es también el nombre accesible. */
  title: string;
  /** Fila dentro del carril: 0 salvo que solape con otro tramo del mismo carril. */
  row: number;
  overlaps: boolean;
  isOpen: boolean;
  /** Orden dentro de su carril, para alternar el tono de tramos consecutivos. */
  ordinal: number;
}

export interface LifelineLane {
  key: string;
  label: string;
  section: EmployeeRouteSection;
  /** La presencia gobierna sobre las demás verticales (ADR-047): se marca. */
  governs: boolean;
  segments: ReadonlyArray<LifelineSegment>;
  rows: number;
}

export interface LifelineEvent {
  id: string;
  date: string;
  kind: 'hire' | 'rehire' | 'termination';
  label: string;
  icon: B4IconName;
  /** Se oculta la etiqueta (queda el icono con `title`) cuando chocaría con la vecina. */
  showLabel: boolean;
  /** Altura de la etiqueta bajo el eje: 0 la primera fila, 1 la segunda, para que dos hitos cercanos no se pisen. */
  tier: 0 | 1;
}

/** Una interrupción de la relación: entre el cese de una presencia y la readmisión siguiente. */
export interface LifelineBreak {
  id: string;
  start: string;
  end: string;
  days: number;
}

export interface LifelineTick {
  id: string;
  date: string;
  label: string;
  /** Enero: lleva el año en vez del mes. */
  major: boolean;
}

const DAY_MS = 86_400_000;
/** Ancho mínimo, en píxeles, para que un tramo lleve texto dentro; por debajo, solo el título. */
const MIN_LABEL_WIDTH_PX = 96;
const HOURS = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
/** Ancho mínimo de un tramo: un cambio de dos semanas en veinte años tiene que seguir viéndose. */
const MIN_SEGMENT_WIDTH_PX = 6;
const EVENT_LABEL_WIDTH_PX = 84;
/** Por debajo de dos años se marcan los meses; por encima, solo los años. */
const MONTHLY_TICKS_MAX_DAYS = 730;
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonths(iso: string, months: number): string {
  const date = parseLocalDate(iso) ?? new Date();
  date.setMonth(date.getMonth() + months);
  return toIso(date);
}

function daysBetween(fromIso: string, toIso_: string): number {
  const from = parseLocalDate(fromIso);
  const to = parseLocalDate(toIso_);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

function monthYear(iso: string): string {
  const date = parseLocalDate(iso);
  return date ? `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}` : iso;
}

function intersects(a: { start: string; end: string | null }, b: { start: string; end: string | null }): boolean {
  const aEnd = a.end ?? '9999-12-31';
  const bEnd = b.end ?? '9999-12-31';
  return a.start <= bEnd && b.start <= aEnd;
}

interface RawPeriod {
  start: string;
  end: string | null;
  label: string;
  title: string;
}

/**
 * La línea de vida del empleado (frontend#17): un eje temporal con un carril por vertical
 * temporal. De un vistazo: qué está abierto, qué se solapa y dónde hay una interrupción.
 *
 * - Todo son vigencias con `startDate`/`endDate`. El tramo abierto (`endDate` nulo) llega hasta
 *   el borde con el cabo abierto —el mismo lenguaje que el isotipo—; el cerrado termina en punta.
 * - Alta, cese y readmisión salen de las presencias: la primera presencia es el alta, cada cierre
 *   un cese y cada presencia siguiente una readmisión. Así el eje habla el vocabulario del negocio
 *   y no depende de los nombres de evento del dominio.
 * - La interrupción entre un cese y la readmisión siguiente se pinta como una columna rayada que
 *   cruza todos los carriles: se ve sin leer una fecha.
 * - Hoy va marcado y el futuro es visible (cuatro meses por delante, o más si algún tramo llega
 *   más lejos): un contrato que vence en dos meses se ve antes de que venza.
 * - La escala es lineal y se ajusta al ancho. Lo corto no desaparece: ningún tramo baja de 6 px,
 *   y su texto va al título. Ver la nota sobre la escala en el issue.
 * - Pinchar un tramo lleva a la sección de su carril.
 */
@Component({
  selector: 'app-employee-lifeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [B4IconComponent],
  templateUrl: './employee-lifeline.component.html',
  styleUrl: './employee-lifeline.component.scss',
})
export class EmployeeLifelineComponent {
  readonly presences = input<ReadonlyArray<EmployeePresenceModel>>([]);
  readonly contracts = input<ReadonlyArray<EmployeeContractModel>>([]);
  readonly workingTimes = input<ReadonlyArray<EmployeeWorkingTimeModel>>([]);
  readonly laborClassifications = input<ReadonlyArray<EmployeeLaborClassificationModel>>([]);
  readonly workCenters = input<ReadonlyArray<EmployeeWorkCenterModel>>([]);
  readonly loading = input(false);
  /** Hoy, inyectable para que los tests no dependan del reloj. */
  readonly today = input<string>(toIso(new Date()));
  /** Ancho fijo del eje en píxeles; sin él se mide el contenedor. Para tests sin layout (jsdom). */
  readonly fixedWidth = input<number | null>(null);

  readonly sectionRequested = output<EmployeeRouteSection>();

  private readonly axisRef = viewChild<ElementRef<HTMLElement>>('axis');

  protected readonly texts = employeeTexts;
  /** Ancho del eje, medido; 0 hasta que se pinta. */
  private readonly measuredWidth = signal(0);
  protected readonly axisWidth = computed(() => this.fixedWidth() ?? this.measuredWidth());

  protected readonly lanes = computed<ReadonlyArray<LifelineLane>>(() => {
    const t = this.texts;
    return [
      this.buildLane('presence', t.lifelineLanePresence, 'presence', true, this.presences().map((p) => ({
        start: p.startDate,
        end: p.endDate,
        label: `${p.companyCode} · ${t.lifelinePresenceLabelPrefix} #${p.presenceNumber}`,
        title: `${p.companyName ?? p.companyCode} · ${p.entryReasonName ?? p.entryReasonCode}`,
      }))),
      this.buildLane('contract', t.lifelineLaneContract, 'presence', false, this.contracts().map((c) => ({
        start: c.startDate,
        end: c.endDate,
        label: `${c.contractCode} · ${c.contractTypeName ?? c.contractSubtypeName ?? ''}`.replace(/ · $/, ''),
        title: `${c.contractTypeName ?? c.contractCode}${c.contractSubtypeCode ? ` / ${c.contractSubtypeCode}` : ''}`,
      }))),
      this.buildLane('working-time', t.lifelineLaneWorkingTime, 'presence', false, this.workingTimes().map((w) => ({
        start: w.startDate,
        end: w.endDate,
        label: `${w.workingTimePercentage} % · ${HOURS.format(w.weeklyHours)} h`,
        title: `${w.workingTimePercentage} % · ${HOURS.format(w.weeklyHours)} ${t.lifelineHoursPerWeekLabel}`,
      }))),
      this.buildLane('classification', t.lifelineLaneClassification, 'presence', false, this.laborClassifications().map((l) => ({
        start: l.startDate,
        end: l.endDate,
        label: `${l.agreementCategoryName ?? l.agreementCategoryCode}${l.grupoCotizacionCode ? ` · ${t.lifelineContributionGroupLabel} ${l.grupoCotizacionCode}` : ''}`,
        title: `${l.agreementName ?? l.agreementCode} · ${l.agreementCategoryName ?? l.agreementCategoryCode}`,
      }))),
      this.buildLane('work-center', t.lifelineLaneWorkCenter, 'organization', false, this.workCenters().map((w) => ({
        start: w.startDate,
        end: w.endDate,
        label: w.workCenterName ?? w.workCenterCode,
        title: `${w.workCenterName ?? w.workCenterCode} (${w.workCenterCode})`,
      }))),
    ];
  });

  protected readonly events = computed<ReadonlyArray<LifelineEvent>>(() => {
    const t = this.texts;
    const sorted = this.sortedPresences();
    const events: LifelineEvent[] = [];
    sorted.forEach((presence, index) => {
      const first = index === 0;
      events.push({
        id: `start-${index}`,
        date: presence.startDate,
        kind: first ? 'hire' : 'rehire',
        label: first ? t.lifelineHireLabel : t.lifelineRehireLabel,
        icon: first ? 'alta' : 'readmision',
        showLabel: true,
        tier: 0,
      });
      if (presence.endDate) {
        events.push({
          id: `end-${index}`,
          date: presence.endDate,
          kind: 'termination',
          label: t.lifelineTerminationLabel,
          icon: 'cese',
          showLabel: true,
          tier: 0,
        });
      }
    });
    return events.sort((a, b) => a.date.localeCompare(b.date));
  });

  /** Las interrupciones: del cese de una presencia a la readmisión siguiente. */
  protected readonly breaks = computed<ReadonlyArray<LifelineBreak>>(() => {
    const sorted = this.sortedPresences();
    const breaks: LifelineBreak[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const previousEnd = sorted[i - 1].endDate;
      if (previousEnd && sorted[i].startDate > previousEnd) {
        breaks.push({
          id: `break-${i}`,
          start: previousEnd,
          end: sorted[i].startDate,
          days: daysBetween(previousEnd, sorted[i].startDate) - 1,
        });
      }
    }
    return breaks;
  });

  protected readonly stageCount = computed(() => this.presences().length);
  protected readonly hasData = computed(() => this.lanes().some((lane) => lane.segments.length > 0));

  /** El dominio del eje: del mes del primer tramo a cuatro meses después de hoy o del último. */
  protected readonly domain = computed(() => {
    const today = this.today();
    const starts = this.lanes().flatMap((lane) => lane.segments.map((s) => s.start));
    const ends = this.lanes().flatMap((lane) => lane.segments.map((s) => s.end ?? today));
    const first = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : today;
    const last = [today, ...ends].reduce((a, b) => (a > b ? a : b));
    return { start: first.slice(0, 8) + '01', end: addMonths(last, 4) };
  });

  protected readonly rangeLabel = computed(() => {
    const { start, end } = this.domain();
    return `${monthYear(start)} — ${monthYear(end)}`;
  });

  protected readonly ticks = computed<ReadonlyArray<LifelineTick>>(() => {
    const { start, end } = this.domain();
    const monthly = daysBetween(start, end) <= MONTHLY_TICKS_MAX_DAYS;
    const ticks: LifelineTick[] = [];
    const cursor = parseLocalDate(start) ?? new Date();
    cursor.setDate(1);
    if (!monthly && cursor.getMonth() !== 0) {
      // El año en que empieza el eje se escribe en su arranque, no en el enero siguiente.
      ticks.push({ id: start, date: start, label: String(cursor.getFullYear()), major: true });
      cursor.setMonth(12);
    }
    while (toIso(cursor) <= end) {
      const iso = toIso(cursor);
      if (iso >= start) {
        const isJanuary = cursor.getMonth() === 0;
        ticks.push({
          id: iso,
          date: iso,
          label: !monthly || isJanuary ? String(cursor.getFullYear()) : MONTH_LABELS[cursor.getMonth()],
          major: !monthly || isJanuary,
        });
      }
      cursor.setMonth(cursor.getMonth() + (monthly ? 1 : 12));
    }
    return ticks;
  });

  protected readonly todayX = computed(() => this.x(this.today()));
  protected readonly todayInRange = computed(() => this.today() >= this.domain().start && this.today() <= this.domain().end);

  /**
   * Los eventos con la etiqueta colocada contra las vecinas: en la primera fila si cabe, en la
   * segunda si choca, y si choca en las dos se queda el icono solo (con su título).
   */
  protected readonly placedEvents = computed<ReadonlyArray<LifelineEvent>>(() => {
    const lastLabelX: [number, number] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
    return this.events().map((event) => {
      const x = this.x(event.date);
      const tier = ([0, 1] as const).find((t) => x - lastLabelX[t] >= EVENT_LABEL_WIDTH_PX);
      if (tier !== undefined) lastLabelX[tier] = x;
      return { ...event, showLabel: tier !== undefined, tier: tier ?? 0 };
    });
  });

  constructor() {
    // El eje solo existe cuando hay datos: se mide cuando aparece, y se sigue midiendo mientras viva.
    effect((onCleanup) => {
      const axis = this.axisRef()?.nativeElement;
      if (!axis) return;
      untracked(() => this.measuredWidth.set(Math.floor(axis.clientWidth)));
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver((entries) => {
        const width = Math.floor(entries[0]?.contentRect.width ?? 0);
        if (width !== this.measuredWidth()) this.measuredWidth.set(width);
      });
      observer.observe(axis);
      onCleanup(() => observer.disconnect());
    });
  }

  /** Píxeles desde el inicio del dominio hasta una fecha. */
  protected x(iso: string): number {
    const { start, end } = this.domain();
    const total = Math.max(1, daysBetween(start, end));
    return Math.round((daysBetween(start, iso) / total) * this.axisWidth());
  }

  protected segmentWidth(segment: LifelineSegment): number {
    const right = segment.end ? this.x(segment.end) + 1 : this.axisWidth();
    return Math.max(MIN_SEGMENT_WIDTH_PX, right - this.x(segment.start));
  }

  protected showsLabel(segment: LifelineSegment): boolean {
    return this.segmentWidth(segment) >= MIN_LABEL_WIDTH_PX;
  }

  protected breakTitle(item: LifelineBreak): string {
    const t = this.texts;
    return `${t.lifelineBreakLabel}: ${formatDisplayDate(item.start)} → ${formatDisplayDate(item.end)} · ${item.days} ${item.days === 1 ? t.lifelineDayLabel : t.lifelineDaysLabel}`;
  }

  protected eventTitle(event: LifelineEvent): string {
    return `${event.label} · ${formatDisplayDate(event.date)}`;
  }

  protected select(lane: LifelineLane): void {
    this.sectionRequested.emit(lane.section);
  }

  private sortedPresences(): ReadonlyArray<EmployeePresenceModel> {
    return [...this.presences()].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  private buildLane(
    key: string,
    label: string,
    section: EmployeeRouteSection,
    governs: boolean,
    raw: ReadonlyArray<RawPeriod>,
  ): LifelineLane {
    const t = this.texts;
    const sorted = [...raw].sort((a, b) => a.start.localeCompare(b.start));
    const rowEnds: string[] = [];
    const segments: LifelineSegment[] = sorted.map((item, index) => {
      const overlaps = sorted.some((other, j) => j !== index && intersects(item, other));
      let row = rowEnds.findIndex((end) => end < item.start);
      if (row === -1) {
        row = rowEnds.length;
        rowEnds.push(item.end ?? '9999-12-31');
      } else {
        rowEnds[row] = item.end ?? '9999-12-31';
      }
      const isOpen = item.end === null;
      const range = `${formatDisplayDate(item.start)} → ${isOpen ? t.lifelineOpenLabel : formatDisplayDate(item.end!)}`;
      return {
        id: `${key}-${index}`,
        start: item.start,
        end: item.end,
        label: item.label,
        title: `${label}: ${item.title} · ${range}${overlaps ? ` · ${t.lifelineOverlapLabel}` : ''}`,
        row,
        overlaps,
        isOpen,
        ordinal: index,
      };
    });
    return { key, label, section, governs, segments, rows: Math.max(1, rowEnds.length) };
  }
}
