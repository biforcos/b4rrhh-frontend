import { JourneyEventType } from '../../../core/api/generated/model/journey-event-type';

export interface EmployeeJourneyHeaderModel {
  ruleSystemCode: string;
  employeeTypeCode: string;
  employeeNumber: string;
  displayName: string | null;
}

export type EmployeeJourneyEventStatus = 'completed' | 'current' | 'future';

/**
 * The event type codes the contract declares. Derived from the generated enum so that a new
 * value in the backend reaches every exhaustive map over it and breaks the build there.
 */
export type EmployeeJourneyEventType = `${JourneyEventType}`;

export interface EmployeeJourneyEventModel {
  eventDate: string;
  eventType: EmployeeJourneyEventType;
  trackCode: string;
  status: EmployeeJourneyEventStatus;
  isCurrent: boolean;
  details: Readonly<Record<string, unknown>> | null;
}

export interface EmployeeJourneyModel {
  employee: EmployeeJourneyHeaderModel;
  events: ReadonlyArray<EmployeeJourneyEventModel>;
}