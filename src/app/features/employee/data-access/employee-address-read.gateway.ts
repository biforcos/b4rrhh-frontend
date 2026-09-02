import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeAddressReadClient } from '../../../core/api/clients/employee-address-read.client';
import {
  EmployeeAddressReadModel,
  mapEmployeeAddressApiToReadModel,
} from '../../../core/api/mappers/employee-address.mapper';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeAddressModel } from '../models/employee-address.model';

@Injectable({
  providedIn: 'root',
})
export class EmployeeAddressReadGateway {
  private readonly employeeAddressReadClient = inject(EmployeeAddressReadClient);

  readEmployeeAddressesByBusinessKey(
    key: EmployeeBusinessKey,
  ): Observable<ReadonlyArray<EmployeeAddressModel>> {
    return this.employeeAddressReadClient.readEmployeeAddressesByBusinessKey(key).pipe(
      map((addresses) =>
        addresses
          .map((address) => mapEmployeeAddressApiToReadModel(address))
          .filter((address): address is EmployeeAddressReadModel => address !== null)
          .map((address) => this.toEmployeeAddressModel(address)),
      ),
    );
  }

  private toEmployeeAddressModel(source: EmployeeAddressReadModel): EmployeeAddressModel {
    return {
      addressNumber: source.addressNumber,
      addressTypeCode: source.addressTypeCode,
      addressTypeName: source.addressTypeName ?? null,
      street: source.street,
      city: source.city,
      countryCode: source.countryCode,
      postalCode: source.postalCode,
      regionCode: source.regionCode,
      startDate: source.startDate,
      endDate: source.endDate,
      isActive: source.isActive,
    };
  }
}
