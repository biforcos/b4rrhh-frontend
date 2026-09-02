import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeAddressReadClient } from '../../../core/api/clients/employee-address-read.client';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';
import {
  AddressCreateDraft,
  AddressEditCurrentDraft,
  mapAddressCloseDateToRequest,
  mapAddressDraftToCreateAddressRequest,
  mapAddressEditCurrentDraftToUpdateAddressRequest,
} from './employee-address-edit.mapper';

@Injectable({
  providedIn: 'root',
})
export class EmployeeAddressGateway {
  private readonly addressClient = inject(EmployeeAddressReadClient);

  createAddress(employeeKey: EmployeeBusinessKey, draft: AddressCreateDraft): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.addressClient
      .createAddressByBusinessKey(normalizedKey, mapAddressDraftToCreateAddressRequest(draft))
      .pipe(map(() => undefined));
  }

  closeAddress(
    employeeKey: EmployeeBusinessKey,
    addressNumber: number,
    endDate: string,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.addressClient
      .closeAddressByBusinessKey(
        normalizedKey,
        addressNumber,
        mapAddressCloseDateToRequest(endDate),
      )
      .pipe(map(() => undefined));
  }

  updateAddress(
    employeeKey: EmployeeBusinessKey,
    addressNumber: number,
    draft: AddressEditCurrentDraft,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.addressClient
      .updateAddressByBusinessKey(
        normalizedKey,
        addressNumber,
        mapAddressEditCurrentDraftToUpdateAddressRequest(draft),
      )
      .pipe(map(() => undefined));
  }
}
