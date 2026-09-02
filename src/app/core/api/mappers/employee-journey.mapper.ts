import {
  EmployeeJourneyApiEventModel,
  EmployeeJourneyApiEventStatus,
  EmployeeJourneyApiHeaderModel,
  EmployeeJourneyApiModel,
} from '../clients/employee-journey-read.client';
import { JourneyEventType } from '../generated/model/journey-event-type';

export interface EmployeeJourneyReadHeaderModel {
  ruleSystemCode: string;
  employeeTypeCode: string;
  employeeNumber: string;
  displayName: string | null;
}

export type EmployeeJourneyReadEventStatus = 'completed' | 'current' | 'future';

export interface EmployeeJourneyReadEventModel {
  eventDate: string;
  eventType: JourneyEventType;
  trackCode: string;
  status: EmployeeJourneyReadEventStatus;
  isCurrent: boolean;
  details: Readonly<Record<string, unknown>> | null;
}

export interface EmployeeJourneyReadModel {
  employee: EmployeeJourneyReadHeaderModel;
  events: ReadonlyArray<EmployeeJourneyReadEventModel>;
}

export function mapEmployeeJourneyApiToReadModel(
  source: EmployeeJourneyApiModel,
): EmployeeJourneyReadModel | null {
  const employee = mapEmployeeJourneyHeaderApiToReadModel(source.employee);
  if (!employee) {
    return null;
  }

  const events = source.events
    .map((event) => mapEmployeeJourneyEventApiToReadModel(event))
    .filter((event): event is EmployeeJourneyReadEventModel => event !== null);

  return {
    employee,
    events,
  };
}

function mapEmployeeJourneyHeaderApiToReadModel(
  source: EmployeeJourneyApiHeaderModel,
): EmployeeJourneyReadHeaderModel | null {
  const ruleSystemCode = source.ruleSystemCode.trim();
  const employeeTypeCode = source.employeeTypeCode.trim();
  const employeeNumber = source.employeeNumber.trim();

  if (!ruleSystemCode || !employeeTypeCode || !employeeNumber) {
    return null;
  }

  return {
    ruleSystemCode,
    employeeTypeCode,
    employeeNumber,
    displayName: normalizeOptionalString(source.displayName),
  };
}

function mapEmployeeJourneyEventApiToReadModel(
  source: EmployeeJourneyApiEventModel,
): EmployeeJourneyReadEventModel | null {
  const eventDate = source.eventDate.trim();
  const eventType = source.eventType;
  const trackCode = source.trackCode.trim();
  const status = normalizeStatus(source.status);

  if (!eventDate || !eventType || !trackCode || !status) {
    return null;
  }

  return {
    eventDate,
    eventType,
    trackCode,
    status,
    isCurrent: source.isCurrent,
    details: normalizeDetails(source.details),
  };
}

function normalizeStatus(value: EmployeeJourneyApiEventStatus): EmployeeJourneyReadEventStatus | null {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'completed' || normalizedValue === 'current' || normalizedValue === 'future') {
    return normalizedValue;
  }

  return null;
}

function normalizeDetails(
  value: Readonly<Record<string, unknown>> | null,
): Readonly<Record<string, unknown>> | null {
  if (!value) {
    return null;
  }

  const entries = Object.entries(value)
    .map(([key, entryValue]) => [key.trim(), entryValue] as const)
    .filter(([key]) => key.length > 0);

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries) as Readonly<Record<string, unknown>>;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}