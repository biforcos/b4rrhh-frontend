import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeePresenceReadClient } from '../../../core/api/clients/employee-presence-read.client';
import {
  EmployeePresenceReadModel,
  mapEmployeePresenceApiToReadModel,
} from '../../../core/api/mappers/employee-presence.mapper';
import { sortByTimelineRecency } from '../../../shared/utils/period-order.util';
import { EmployeePresenceModel } from '../models/employee-presence.model';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';

@Injectable({
  providedIn: 'root',
})
export class EmployeePresenceReadGateway {
  private readonly employeePresenceReadClient = inject(EmployeePresenceReadClient);

  readEmployeePresencesByBusinessKey(
    key: EmployeeBusinessKey,
  ): Observable<ReadonlyArray<EmployeePresenceModel>> {
    return this.employeePresenceReadClient.readEmployeePresencesByBusinessKey(key).pipe(
      map((presences) =>
        presences
          .map((presence) => mapEmployeePresenceApiToReadModel(presence))
          .filter((presence): presence is EmployeePresenceReadModel => presence !== null)
          .map((presence) => this.toEmployeePresenceModel(presence)),
      ),
      // El backend sirve ascendente; la ficha ordena como las otras tres tablas (frontend#37).
      map((presences) => sortByTimelineRecency(presences)),
    );
  }

  private toEmployeePresenceModel(source: EmployeePresenceReadModel): EmployeePresenceModel {
    return {
      presenceNumber: source.presenceNumber,
      companyCode: source.companyCode,
      companyName: source.companyName ?? null,
      entryReasonCode: source.entryReasonCode,
      entryReasonName: source.entryReasonName ?? null,
      exitReasonCode: source.exitReasonCode,
      exitReasonName: source.exitReasonName ?? null,
      startDate: source.startDate,
      endDate: source.endDate,
      isActive: source.isActive,
    };
  }
}
