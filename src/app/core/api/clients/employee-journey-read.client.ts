import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeJourneyService } from '../generated/api/employee-journey.service';
import {
  EmployeeJourneyResponse,
  JourneyEmployeeHeader,
  JourneyEventResponse,
  JourneyEventType,
} from '../generated/model/models';
import { EmployeeBusinessKeyApiQuery } from './employee-read.client';

export interface EmployeeJourneyApiHeaderModel {
  ruleSystemCode: string;
  employeeTypeCode: string;
  employeeNumber: string;
  displayName: string | null;
}

export type EmployeeJourneyApiEventStatus = 'completed' | 'current' | 'future';

export interface EmployeeJourneyApiEventModel {
  eventDate: string;
  eventType: JourneyEventType;
  trackCode: string;
  status: EmployeeJourneyApiEventStatus;
  isCurrent: boolean;
  details: Readonly<Record<string, unknown>> | null;
}

export interface EmployeeJourneyApiModel {
  employee: EmployeeJourneyApiHeaderModel;
  events: ReadonlyArray<EmployeeJourneyApiEventModel>;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeJourneyReadClient {
  private readonly api = inject(EmployeeJourneyService);

  readEmployeeJourneyByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
  ): Observable<EmployeeJourneyApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .getEmployeeJourneyV2(normalizedKey)
      .pipe(map((journey) => this.toEmployeeJourneyApiModel(journey)));
  }

  private normalizeKey(key: EmployeeBusinessKeyApiQuery): EmployeeBusinessKeyApiQuery {
    return {
      ruleSystemCode: key.ruleSystemCode.trim(),
      employeeTypeCode: key.employeeTypeCode.trim(),
      employeeNumber: key.employeeNumber.trim(),
    };
  }

  private toEmployeeJourneyApiModel(source: EmployeeJourneyResponse): EmployeeJourneyApiModel {
    return {
      employee: this.toEmployeeJourneyApiHeaderModel(source.employee),
      events: source.events.map((event) => this.toEmployeeJourneyApiEventModel(event)),
    };
  }

  private toEmployeeJourneyApiHeaderModel(
    source: JourneyEmployeeHeader,
  ): EmployeeJourneyApiHeaderModel {
    return {
      ruleSystemCode: source.ruleSystemCode,
      employeeTypeCode: source.employeeTypeCode,
      employeeNumber: source.employeeNumber,
      displayName: this.normalizeOptionalString(source.displayName),
    };
  }

  private toEmployeeJourneyApiEventModel(
    source: JourneyEventResponse,
  ): EmployeeJourneyApiEventModel {
    return {
      eventDate: source.eventDate,
      eventType: source.eventType,
      trackCode: String(source.trackCode),
      status: this.normalizeStatus(source.status),
      isCurrent: source.isCurrent,
      details: this.toReadonlyUnknownRecord(source.details),
    };
  }

  private normalizeStatus(value: string): EmployeeJourneyApiEventStatus {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === 'current' || normalizedValue === 'future') {
      return normalizedValue;
    }

    return 'completed';
  }

  private normalizeOptionalString(value: string | null | undefined): string | null {
    const normalizedValue = value?.trim() ?? '';
    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toReadonlyUnknownRecord(
    value: Record<string, unknown> | null | undefined,
  ): Readonly<Record<string, unknown>> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const entries = Object.entries(value);
    if (entries.length === 0) {
      return null;
    }

    return Object.fromEntries(entries) as Readonly<Record<string, unknown>>;
  }
}
