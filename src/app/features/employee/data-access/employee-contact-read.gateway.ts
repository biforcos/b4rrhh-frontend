import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeContactReadClient } from '../../../core/api/clients/employee-contact-read.client';
import {
  mapEmployeeContactApiToReadModel,
  EmployeeContactReadModel,
} from '../../../core/api/mappers/employee-contact.mapper';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeContactModel } from '../models/employee-contact.model';

@Injectable({
  providedIn: 'root',
})
export class EmployeeContactReadGateway {
  private readonly employeeContactReadClient = inject(EmployeeContactReadClient);

  readEmployeeContactsByBusinessKey(
    key: EmployeeBusinessKey,
  ): Observable<ReadonlyArray<EmployeeContactModel>> {
    return this.employeeContactReadClient.readEmployeeContactsByBusinessKey(key).pipe(
      map((contacts) =>
        contacts
          .map((contact) => mapEmployeeContactApiToReadModel(contact))
          .filter((contact): contact is EmployeeContactReadModel => contact !== null)
          .map((contact) => this.toEmployeeContactModel(contact)),
      ),
    );
  }

  private toEmployeeContactModel(source: EmployeeContactReadModel): EmployeeContactModel {
    return {
      contactTypeCode: source.contactTypeCode,
      contactTypeName: source.contactTypeName ?? null,
      contactValue: source.contactValue,
      type: source.type,
      label: source.label,
      value: source.value,
    };
  }
}
