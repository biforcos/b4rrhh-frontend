import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';

import { DISPLAY_DATE_FORMAT, formatDisplayDate } from '../../../../shared/utils/local-date.util';
import { EmployeeJourneyErrorCode } from '../../data-access/employee-journey.store';
import {
  EmployeeJourneyEventModel,
  EmployeeJourneyModel,
} from '../../models/employee-journey.model';

interface GroupedEvent {
  title: string;
  subtitle: string | null;
  color: string;
}

interface TimelineNode {
  id: string;
  type: 'event' | 'today' | 'year';
  date: string;
  label?: string;
  events: GroupedEvent[];
  color: string;
  dotBg: string;
  dotText: string;
  icon: string;
  above: boolean;
  isPast: boolean;
}

interface EventStyle {
  color: string;
  dotBg: string;
  dotText: string;
  icon: string;
}

const DEFAULT_STYLE: EventStyle = {
  color: '#6b7280',
  dotBg: '#f3f4f6',
  dotText: '#374151',
  icon: '•',
};

function resolveEventStyle(ev: EmployeeJourneyEventModel): EventStyle {
  const t = `${ev.eventType} ${ev.title} ${ev.subtitle ?? ''}`.toLowerCase();
  const track = (ev.trackCode ?? '').toUpperCase();

  if (t.includes('rehire') || t.includes('recontrat') || t.includes('reingres')) {
    return { color: '#059669', dotBg: 'rgba(5,150,105,0.12)', dotText: '#059669', icon: '✦' };
  }
  if (
    t.includes(' hire') ||
    t.includes('alta') ||
    (track === 'PRESENCE' &&
      !t.includes('baja') &&
      !t.includes('terminat') &&
      !t.includes('finish'))
  ) {
    return { color: '#059669', dotBg: 'rgba(5,150,105,0.12)', dotText: '#059669', icon: '✦' };
  }
  if (
    t.includes('transfer') ||
    t.includes('traslad') ||
    t.includes('centro') ||
    t.includes('work center') ||
    ev.eventType?.toUpperCase().includes('WORK_CENTER')
  ) {
    return { color: '#4f46e5', dotBg: 'rgba(79,70,229,0.12)', dotText: '#4f46e5', icon: '⇄' };
  }
  if (
    t.includes('salary') ||
    t.includes('salario') ||
    t.includes('salarial') ||
    t.includes('wage')
  ) {
    return { color: '#d97706', dotBg: 'rgba(217,119,6,0.12)', dotText: '#d97706', icon: '€' };
  }
  if (
    t.includes('terminat') ||
    t.includes('baja') ||
    t.includes('cese') ||
    t.includes('despido') ||
    t.includes('finish')
  ) {
    return { color: '#dc2626', dotBg: 'rgba(220,38,38,0.12)', dotText: '#dc2626', icon: '✕' };
  }
  return DEFAULT_STYLE;
}

// Priority order for the dot icon when multiple events share a date
const ICON_PRIORITY = ['✦', '✕', '⇄', '€'];

function dominantStyle(styles: EventStyle[]): EventStyle {
  for (const icon of ICON_PRIORITY) {
    const match = styles.find((s) => s.icon === icon);
    if (match) return match;
  }
  return styles[0] ?? DEFAULT_STYLE;
}

function todayIsoString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-employee-horizontal-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './employee-horizontal-timeline.component.html',
  styleUrl: './employee-horizontal-timeline.component.scss',
})
export class EmployeeHorizontalTimelineComponent {
  readonly journey = input<EmployeeJourneyModel | null>(null);
  readonly loading = input(false);
  readonly error = input<EmployeeJourneyErrorCode | null>(null);

  private readonly containerRef = viewChild<ElementRef<HTMLElement>>('container');

  protected readonly displayDateFormat = DISPLAY_DATE_FORMAT;
  protected readonly todayStr = todayIsoString();
  protected readonly todayFormatted = formatDisplayDate(this.todayStr);

  protected readonly nodes = computed<ReadonlyArray<TimelineNode>>(() => {
    const events = this.journey()?.events ?? [];
    const sorted = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));

    // Group events by date (Map preserves insertion order → chronological)
    const byDate = new Map<string, EmployeeJourneyEventModel[]>();
    for (const ev of sorted) {
      if (!byDate.has(ev.eventDate)) byDate.set(ev.eventDate, []);
      byDate.get(ev.eventDate)!.push(ev);
    }

    const result: TimelineNode[] = [];
    let lastYear = '';
    let groupIndex = 0;
    let todayInserted = false;

    for (const [date, evs] of byDate) {
      if (!todayInserted && date > this.todayStr) {
        result.push(this.buildTodayNode());
        todayInserted = true;
      }

      const year = date.slice(0, 4);
      if (year !== lastYear) {
        result.push({
          id: `__year__${year}`,
          type: 'year',
          date,
          label: year,
          events: [],
          color: '',
          dotBg: '',
          dotText: '',
          icon: '',
          above: false,
          isPast: date <= this.todayStr,
        });
        lastYear = year;
      }

      const styles = evs.map(resolveEventStyle);
      const dominant = dominantStyle(styles);
      result.push({
        id: `${date}-${groupIndex}`,
        type: 'event',
        date,
        events: evs.map((ev, i) => ({
          title: ev.title,
          subtitle: ev.subtitle ?? null,
          color: styles[i].color,
        })),
        color: dominant.color,
        dotBg: dominant.dotBg,
        dotText: dominant.dotText,
        icon: dominant.icon,
        above: groupIndex % 2 === 0,
        isPast: date <= this.todayStr,
      });
      groupIndex++;
    }

    if (!todayInserted) {
      result.push(this.buildTodayNode());
    }

    return result;
  });

  protected readonly hasFutureEvents = computed(() =>
    this.nodes().some((n) => n.type === 'event' && !n.isPast),
  );

  constructor() {
    afterNextRender(() => {
      this.scrollToToday();
    });
  }

  private buildTodayNode(): TimelineNode {
    return {
      id: '__today__',
      type: 'today',
      date: this.todayStr,
      events: [],
      color: '#111827',
      dotBg: '#111827',
      dotText: '#fff',
      icon: '◆',
      above: false,
      isPast: false,
    };
  }

  private scrollToToday(): void {
    const container = this.containerRef()?.nativeElement;
    if (!container) return;
    const todayEl = container.querySelector<HTMLElement>('.ht__today-node');
    if (!todayEl) return;
    const containerWidth = container.offsetWidth;
    container.scrollLeft = Math.max(0, todayEl.offsetLeft - containerWidth * 0.75);
  }
}
