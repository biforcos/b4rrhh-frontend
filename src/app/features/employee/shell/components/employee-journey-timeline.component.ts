import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { EmployeeJourneyErrorCode } from '../../data-access/employee-journey.store';
import { employeeTexts } from '../../employee.texts';
import {
  EmployeeJourneyEventModel,
  EmployeeJourneyEventStatus,
  EmployeeJourneyModel,
} from '../../models/employee-journey.model';
import { EmployeePresenceModel } from '../../models/employee-presence.model';
import { DISPLAY_DATE_FORMAT, formatDisplayDate } from '../../../../shared/utils/local-date.util';

interface JourneyDetailEntryViewModel {
  id: string;
  text: string;
}

interface GroupedJourneySecondaryEventViewModel {
  id: string;
  summary: string;
}

interface GroupedJourneyEventViewModel {
  eventDate: string;
  primaryEvent: EmployeeJourneyEventModel;
  primaryDetails: ReadonlyArray<JourneyDetailEntryViewModel>;
  secondaryEvents: ReadonlyArray<GroupedJourneySecondaryEventViewModel>;
  hasCurrentEvent: boolean;
  hasFutureEvent: boolean;
}

interface PresenceDateGroupViewModel {
  eventDate: string;
  semanticLabel: string | null;
  primaryEventLabel: string;
  secondaryEvents: ReadonlyArray<GroupedJourneySecondaryEventViewModel>;
}

interface TimelineSummaryViewModel {
  totalEvents: number;
  latestEventLabel: string | null;
  latestEventDate: string | null;
}

interface PresenceGroupViewModel {
  id: string;
  company: string | null;
  start: string;
  end: string | null;
  isActive: boolean;
  events: ReadonlyArray<EmployeeJourneyEventModel>;
  groupedEvents: ReadonlyArray<PresenceDateGroupViewModel>;
}

const trackPriorityByCode: Readonly<Record<string, number>> = {
  PRESENCE: 0,
  CONTRACT: 1,
  LABOR_CLASSIFICATION: 2,
};

const secondaryTrackLabelByCode: Readonly<Record<string, string>> = {
  PRESENCE: 'Presencia',
  CONTRACT: 'Contrato',
  LABOR_CLASSIFICATION: 'Clasificación',
};

const compactEventLabelByTrackCode: Readonly<Record<string, string>> = {
  PRESENCE: 'Alta',
  CONTRACT: 'Contrato',
  LABOR_CLASSIFICATION: 'Clasificación',
};

@Component({
  selector: 'app-employee-journey-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './employee-journey-timeline.component.html',
  styleUrls: ['./employee-journey-timeline.component.scss'],
})
export class EmployeeJourneyTimelineComponent {
  readonly journey = input<EmployeeJourneyModel | null>(null);
  readonly presences = input<ReadonlyArray<EmployeePresenceModel> | null>(null);
  readonly loading = input(false);
  readonly error = input<EmployeeJourneyErrorCode | null>(null);
  protected readonly isExpanded = signal(false);
  protected readonly expandedPresences = signal<Record<string, boolean>>({});

  protected readonly texts = employeeTexts;
  protected readonly displayDateFormat = DISPLAY_DATE_FORMAT;
  protected readonly groupedTimelineEvents = computed<ReadonlyArray<GroupedJourneyEventViewModel>>(() =>
    this.groupEventsByDate(this.journey()?.events ?? []),
  );
  protected readonly presenceGroups = computed(() =>
    this.groupEventsByPresence(this.journey()?.events ?? [], this.presences() ?? []),
  );
  protected readonly summary = computed<TimelineSummaryViewModel>(() => {
    const events = this.journey()?.events ?? [];
    if (events.length === 0) {
      return { totalEvents: 0, latestEventLabel: null, latestEventDate: null };
    }

    const latestEvent = [...events].sort((left, right) => right.eventDate.localeCompare(left.eventDate))[0] ?? null;

    return {
      totalEvents: events.length,
      latestEventLabel: latestEvent ? this.resolveCompactEventLabel(latestEvent) : null,
      latestEventDate: latestEvent?.eventDate ?? null,
    };
  });
  protected readonly collapsedSummary = computed(() => {
    if (this.loading()) {
      return this.texts.timelineLoadingMessage;
    }

    if (this.error()) {
      return this.texts.timelineLoadFailedMessage;
    }

    const summary = this.summary();
    const totalEvents = summary.totalEvents;
    if (totalEvents === 0) {
      return this.texts.timelineNoEventsMessage;
    }

    const eventsLabel =
      totalEvents === 1 ? this.texts.timelineEventsSingularLabel : this.texts.timelineEventsPluralLabel;

    if (!summary.latestEventLabel || !summary.latestEventDate) {
      return `${totalEvents} ${eventsLabel}`;
    }

    return `${totalEvents} ${eventsLabel} · ${this.texts.timelineLastEventLabel}: ${summary.latestEventLabel} (${formatDisplayDate(summary.latestEventDate)})`;
  });
  protected readonly toggleAriaLabel = computed(() =>
    this.isExpanded() ? this.texts.timelineCollapseActionLabel : this.texts.timelineExpandActionLabel,
  );
  protected readonly hasEvents = computed(() => this.presenceGroups().length > 0);

  protected toggle(): void {
    this.isExpanded.update((value) => !value);
  }

  protected isPresenceExpanded(presenceId: string, defaultExpanded: boolean): boolean {
    const map = this.expandedPresences();
    if (Object.prototype.hasOwnProperty.call(map, presenceId)) {
      return Boolean(map[presenceId]);
    }

    return defaultExpanded;
  }

  protected togglePresence(presenceId: string): void {
    this.expandedPresences.update((m) => ({ ...m, [presenceId]: !Boolean(m[presenceId]) }));
  }

  protected resolveGroupIconBackground(group: PresenceDateGroupViewModel): string {
    const label = (group.semanticLabel ?? group.primaryEventLabel).toLowerCase();
    if (label.includes('alta') || label.includes('reingreso')) return '#dcfce7';
    if (label.includes('baja') || label.includes('terminac') || label.includes('despido')) return '#fee2e2';
    if (label.includes('contrato')) return '#ede9fe';
    if (label.includes('jornada')) return '#e0f2fe';
    if (label.includes('clasificac') || label.includes('convenio')) return '#eef2ff';
    return '#f3f4f6';
  }

  protected resolveStatusLabel(status: EmployeeJourneyEventStatus): string {
    if (status === 'current') {
      return this.texts.timelineStatusCurrentLabel;
    }

    if (status === 'future') {
      return this.texts.timelineStatusFutureLabel;
    }

    return this.texts.timelineStatusCompletedLabel;
  }

  protected trackGroupedEventBy(index: number, groupedEvent: GroupedJourneyEventViewModel): string {
    const primaryEvent = groupedEvent.primaryEvent;
    return `${groupedEvent.eventDate}-${index}-${primaryEvent.eventType}-${primaryEvent.title}`;
  }

  protected trackPresenceBy(_index: number, presence: { id: string }): string {
    return presence.id;
  }

  protected resolveCompactEventLabel(event: EmployeeJourneyEventModel): string {
    const normalizedTrackCode = (event.trackCode ?? '').trim().toUpperCase();
    const haystack = `${event.eventType} ${event.title} ${event.subtitle ?? ''}`.toLowerCase();

    if (haystack.includes('work center') || haystack.includes('assignment') || haystack.includes('centro')) {
      return this.texts.timelineEventWorkCenterLabel;
    }

    if (haystack.includes('termination') || haystack.includes('despido') || haystack.includes('baja') || haystack.includes('finish')) {
      return this.texts.timelineEventTerminationLabel;
    }

    if (haystack.includes('rehire') || haystack.includes('reincorp') || haystack.includes('reingres')) {
      return this.texts.timelineEventRehireLabel;
    }

    if (normalizedTrackCode in compactEventLabelByTrackCode) {
      return compactEventLabelByTrackCode[normalizedTrackCode]!;
    }

    const normalizedTitle = event.title.trim();
    return normalizedTitle || this.texts.timelineEventGenericLabel;
  }

  private groupEventsByDate(
    events: ReadonlyArray<EmployeeJourneyEventModel>,
  ): ReadonlyArray<GroupedJourneyEventViewModel> {
    const groupedEvents = new Map<string, Array<EmployeeJourneyEventModel>>();

    const extractDate = (d: string | undefined | null) => (d ? String(d).slice(0, 10) : '');

    for (const ev of events) {
      const dk = extractDate(ev.eventDate) || '_unknown_date';
      const arr = groupedEvents.get(dk) ?? [];
      arr.push(ev);
      groupedEvents.set(dk, arr);
    }

    const result: GroupedJourneyEventViewModel[] = [];
    for (const [date, evs] of groupedEvents.entries()) {
      // pick primary by track priority, then by original order
      let primaryIndex = 0;
      let primaryPriority = Number.MAX_SAFE_INTEGER;
      for (let i = 0; i < evs.length; i++) {
        const code = (evs[i].trackCode ?? '').toString().trim().toUpperCase();
        const p = trackPriorityByCode[code] ?? 99;
        if (p < primaryPriority) {
          primaryPriority = p;
          primaryIndex = i;
        }
      }

      const primaryEvent = evs[primaryIndex];
      const secondaryEvents = evs.filter((_, i) => i !== primaryIndex).map((e) => ({
        id: `${e.eventDate}-${e.eventType}-secondary`,
        summary: this.toSecondarySummary(e),
      }));

      result.push({
        eventDate: date,
        primaryEvent,
        primaryDetails: [],
        secondaryEvents,
        hasCurrentEvent: primaryEvent.status === 'current',
        hasFutureEvent: primaryEvent.status === 'future',
      });
    }

    // sort by date desc
    result.sort((a, b) => b.eventDate.localeCompare(a.eventDate));

    return result;
  }

  private toSecondarySummary(event: EmployeeJourneyEventModel): string {
    const trackLabel = this.toSecondaryTrackLabel(event.trackCode);
    const value = this.toSecondaryTrackValue(event);

    if (!value) {
      return trackLabel;
    }

    return `${trackLabel}: ${value}`;
  }

  private toSecondaryTrackValue(event: EmployeeJourneyEventModel): string | null {
    const normalizedSubtitle = this.normalizeNarrativeValue(event.subtitle);
    if (normalizedSubtitle) {
      return normalizedSubtitle;
    }

    const details = event.details;
    if (!details) {
      return null;
    }

    if (this.isContractTrack(event.trackCode)) {
      return this.toPairedSummary(details, 'contractCode', 'contractSubtypeCode');
    }

    if (this.isLaborClassificationTrack(event.trackCode)) {
      return this.toPairedSummary(details, 'agreementCode', 'agreementCategoryCode');
    }

    if (this.isPresenceTrack(event.trackCode)) {
      return this.toPresenceContextSummary(details, null);
    }

    return null;
  }

  private toSecondaryTrackLabel(trackCode: string): string {
    const normalizedTrackCode = trackCode.trim().toUpperCase();
    return secondaryTrackLabelByCode[normalizedTrackCode] ?? 'Evento';
  }

  private toPresenceContextSummary(
    details: Readonly<Record<string, unknown>> | null,
    fallbackSubtitle: string | null,
  ): string | null {
    if (!details) {
      return this.normalizeNarrativeValue(fallbackSubtitle);
    }

    const companyCode = this.toDisplayableValue((details as any)['companyCode']);
    const presenceNumber = this.toDisplayableValue((details as any)['presenceNumber']);

    if (companyCode && presenceNumber) {
      return `${companyCode} · período #${presenceNumber}`;
    }

    if (companyCode) {
      return companyCode;
    }

    if (presenceNumber) {
      return `período #${presenceNumber}`;
    }

    return this.normalizeNarrativeValue(fallbackSubtitle);
  }

  private toPairedSummary(
    details: Readonly<Record<string, unknown>>,
    firstKey: string,
    secondKey: string,
  ): string | null {
    const firstValue = this.toDisplayableValue((details as any)[firstKey]);
    const secondValue = this.toDisplayableValue((details as any)[secondKey]);

    if (firstValue && secondValue) {
      return `${firstValue} / ${secondValue}`;
    }

    return firstValue ?? secondValue;
  }

  private normalizeNarrativeValue(value: string | null | undefined): string | null {
    const normalizedValue = value?.trim() ?? '';
    if (!normalizedValue) {
      return null;
    }

    return normalizedValue.replace(/\bperiod\s*#/gi, 'período #');
  }

  private isPresenceTrack(trackCode: string): boolean {
    return (trackCode ?? '').toString().trim().toUpperCase() === 'PRESENCE';
  }

  private isContractTrack(trackCode: string): boolean {
    return (trackCode ?? '').toString().trim().toUpperCase() === 'CONTRACT';
  }

  private isLaborClassificationTrack(trackCode: string): boolean {
    return (trackCode ?? '').toString().trim().toUpperCase() === 'LABOR_CLASSIFICATION';
  }

  private toDisplayableValue(value: unknown): string | null {
    if (typeof value === 'string') {
      const normalizedValue = value.trim();
      return normalizedValue.length > 0 ? normalizedValue : null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  }

  private groupEventsByPresence(events: ReadonlyArray<EmployeeJourneyEventModel>, presences: ReadonlyArray<EmployeePresenceModel>) {
    // STEP 1: Build presence blocks from authoritative presences list
    const presenceMap = new Map<string, {
      presence: EmployeePresenceModel;
      assigned: EmployeeJourneyEventModel[];
    }>();

    for (const p of presences) {
      const id = String((p as any).presenceNumber);
      presenceMap.set(id, { presence: p, assigned: [] });
    }

    const unassignedEvents: EmployeeJourneyEventModel[] = [];
    const extractDate = (d: string | undefined | null) => (d ? String(d).slice(0, 10) : '');

    // STEP 2: Assign events deterministically
    for (const ev of events) {
      const evDate = extractDate(ev.eventDate);

      // 2.1 presenceId in details
      const detailsPresence = ev.details && (ev.details as any)['presenceNumber'] ? String((ev.details as any)['presenceNumber']) : null;
      if (detailsPresence && presenceMap.has(detailsPresence)) {
        presenceMap.get(detailsPresence)!.assigned.push(ev);
        continue;
      }

      // 2.2 assign by date containment
      const candidates: Array<{ id: string; start: string; end: string | null }> = [];
      for (const [id, { presence }] of presenceMap.entries()) {
        const start = extractDate((presence as any).startDate);
        const end = (presence as any).endDate ? extractDate((presence as any).endDate) : null;
        if (!evDate) continue;
        if (evDate >= start && (end === null || evDate <= end)) {
          candidates.push({ id, start, end });
        }
      }

      if (candidates.length === 0) {
        // 2.4 no match -> unassigned (debug only)
        unassignedEvents.push(ev);
        continue;
      }

      // 2.3 if multiple matches pick most recent matching presence (latest startDate)
      candidates.sort((a, b) => b.start.localeCompare(a.start));
      const chosen = candidates[0];
      presenceMap.get(chosen.id)!.assigned.push(ev);
    }

    // STEP 3: For each presence, group events by exact date and build final structure
    const result: PresenceGroupViewModel[] = [];
    for (const [id, { presence, assigned }] of presenceMap.entries()) {
      // group by date preserving assigned order
      const byDate = new Map<string, EmployeeJourneyEventModel[]>();
      for (const ev of assigned) {
        const dk = extractDate(ev.eventDate) || '_unknown_date';
        const arr = byDate.get(dk) ?? [];
        arr.push(ev);
        byDate.set(dk, arr);
      }

      const dateGroups: PresenceDateGroupViewModel[] = Array.from(byDate.entries()).map(([date, evs]) => ({
        eventDate: date,
        semanticLabel: null,
        primaryEventLabel: this.resolvePrimaryEventLabel(evs),
        secondaryEvents: this.resolveSecondaryEvents(evs),
      }));

      // STEP 4: sort date groups DESC
      dateGroups.sort((a, b) => (b.eventDate ?? '').localeCompare(a.eventDate ?? ''));

      // STEP 5: events inside groups keep stable order (already preserved)

      // STEP 6: semantic labels strict rules
      for (const dg of dateGroups) {
        const evs = byDate.get(dg.eventDate) ?? [];
        const hasContract = evs.some((e) => this.isContractTrack(e.trackCode));
        const hasClassification = evs.some((e) => this.isLaborClassificationTrack(e.trackCode));
        const hasAssignment = evs.some((e) => {
          const code = (e.trackCode ?? '').toString().trim().toUpperCase();
          if (code.includes('WORK') || code.includes('ASSIGN') || code.includes('ORGANIZ')) return true;
          const txt = `${e.eventType} ${e.title} ${e.subtitle ?? ''}`.toLowerCase();
          return txt.includes('assignment') || txt.includes('work center') || txt.includes('centro');
        });

        const isRehire = evs.some((e) => `${e.eventType} ${e.title} ${e.subtitle ?? ''}`.toLowerCase().includes('rehire'));
        const isTermination = evs.some((e) => {
          const code = (e.trackCode ?? '').toString().trim().toUpperCase();
          const txt = `${e.eventType} ${e.title} ${e.subtitle ?? ''}`.toLowerCase();
          return code === 'PRESENCE' && (txt.includes('baja') || txt.includes('termination') || txt.includes('despido') || txt.includes('finish'));
        });

        if (isRehire) {
          dg.semanticLabel = this.texts.timelineSemanticRehireLabel;
          continue;
        }

        if (isTermination) {
          dg.semanticLabel = this.texts.timelineSemanticTerminationLabel;
          continue;
        }

        if (hasContract && hasClassification && hasAssignment) {
          dg.semanticLabel = this.texts.timelineSemanticHireLabel;
          continue;
        }

        dg.semanticLabel = null;
      }

      for (const dg of dateGroups) {
        if (dg.semanticLabel) {
          dg.primaryEventLabel = dg.semanticLabel;
        }
      }

      result.push({
        id,
        company: (presence as any).companyName ?? (presence as any).companyCode ?? null,
        start: (presence as any).startDate,
        end: (presence as any).endDate,
        isActive: (presence as any).isActive,
        events: assigned,
        groupedEvents: dateGroups,
      });
    }

    // Optionally: log debug info
    // console.debug('timeline: presences', result.length, 'unassigned', unassignedEvents.length);

    return result;
  }

  private resolvePrimaryEventLabel(events: ReadonlyArray<EmployeeJourneyEventModel>): string {
    const primaryEvent = this.pickPrimaryEvent(events);
    return this.resolveCompactEventLabel(primaryEvent);
  }

  private resolveSecondaryEvents(
    events: ReadonlyArray<EmployeeJourneyEventModel>,
  ): ReadonlyArray<GroupedJourneySecondaryEventViewModel> {
    const primaryEvent = this.pickPrimaryEvent(events);

    return events
      .filter((event) => event !== primaryEvent)
      .map((event, index) => ({
        id: `${event.eventDate}-${event.eventType}-${index}`,
        summary: this.resolveCompactEventLabel(event),
      }));
  }

  private pickPrimaryEvent(events: ReadonlyArray<EmployeeJourneyEventModel>): EmployeeJourneyEventModel {
    let primaryEvent = events[0]!;
    let primaryPriority = Number.MAX_SAFE_INTEGER;

    for (const event of events) {
      const normalizedTrackCode = (event.trackCode ?? '').toString().trim().toUpperCase();
      const priority = trackPriorityByCode[normalizedTrackCode] ?? 99;
      if (priority < primaryPriority) {
        primaryPriority = priority;
        primaryEvent = event;
      }
    }

    return primaryEvent;
  }
}