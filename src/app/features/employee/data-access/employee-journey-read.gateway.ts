import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeJourneyReadClient } from '../../../core/api/clients/employee-journey-read.client';
import {
  EmployeeJourneyReadEventModel,
  EmployeeJourneyReadModel,
  mapEmployeeJourneyApiToReadModel,
} from '../../../core/api/mappers/employee-journey.mapper';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import {
  EmployeeJourneyEventModel,
  EmployeeJourneyHeaderModel,
  EmployeeJourneyModel,
} from '../models/employee-journey.model';

@Injectable({
  providedIn: 'root',
})
export class EmployeeJourneyReadGateway {
  private readonly employeeJourneyReadClient = inject(EmployeeJourneyReadClient);

  readEmployeeJourneyByBusinessKey(key: EmployeeBusinessKey): Observable<EmployeeJourneyModel> {
    return this.employeeJourneyReadClient.readEmployeeJourneyByBusinessKey(key).pipe(
      map((journey) => {
        const readModel = mapEmployeeJourneyApiToReadModel(journey);

        if (!readModel) {
          return this.toEmptyJourneyModel(key);
        }

        return this.toEmployeeJourneyModel(readModel);
      }),
    );
  }

  private toEmployeeJourneyModel(source: EmployeeJourneyReadModel): EmployeeJourneyModel {
    return {
      employee: this.toEmployeeJourneyHeaderModel(source.employee),
      events: source.events.map((event) => this.toEmployeeJourneyEventModel(event)),
    };
  }

  private toEmployeeJourneyHeaderModel(
    source: EmployeeJourneyReadModel['employee'],
  ): EmployeeJourneyHeaderModel {
    return {
      ruleSystemCode: source.ruleSystemCode,
      employeeTypeCode: source.employeeTypeCode,
      employeeNumber: source.employeeNumber,
      displayName: source.displayName,
    };
  }

  private toEmployeeJourneyEventModel(
    source: EmployeeJourneyReadEventModel,
  ): EmployeeJourneyEventModel {
    return {
      eventDate: source.eventDate,
      eventType: source.eventType,
      trackCode: source.trackCode,
      status: source.status,
      isCurrent: source.isCurrent,
      details: source.details,
    };
  }

  private toEmptyJourneyModel(key: EmployeeBusinessKey): EmployeeJourneyModel {
    return {
      employee: {
        ruleSystemCode: key.ruleSystemCode.trim(),
        employeeTypeCode: key.employeeTypeCode.trim(),
        employeeNumber: key.employeeNumber.trim(),
        displayName: null,
      },
      events: [],
    };
  }
}
