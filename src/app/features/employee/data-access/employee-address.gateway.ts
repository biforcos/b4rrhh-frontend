import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeAddressReadClient } from '../../../core/api/clients/employee-address-read.client';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeAddressPlanModel } from '../models/employee-address-plan.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';
import {
  AddressCorrectDraft,
  AddressCreateDraft,
  AddressPlanDraft,
  mapAddressCorrectDraftToUpdateAddressRequest,
  mapAddressDraftToCreateAddressRequest,
  mapAddressPlanDraftToRequest,
  mapAddressPlanResponseToModel,
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

  planAddressChange(
    employeeKey: EmployeeBusinessKey,
    draft: AddressPlanDraft,
  ): Observable<EmployeeAddressPlanModel> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.addressClient
      .planAddressChangeByBusinessKey(normalizedKey, mapAddressPlanDraftToRequest(draft))
      .pipe(map((plan) => mapAddressPlanResponseToModel(plan)));
  }

  correctAddress(
    employeeKey: EmployeeBusinessKey,
    addressNumber: number,
    draft: AddressCorrectDraft,
  ): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.addressClient
      .updateAddressByBusinessKey(
        normalizedKey,
        addressNumber,
        mapAddressCorrectDraftToUpdateAddressRequest(draft),
      )
      .pipe(map(() => undefined));
  }

  deleteAddress(employeeKey: EmployeeBusinessKey, addressNumber: number): Observable<void> {
    const normalizedKey = toEmployeeBusinessKey(employeeKey);

    return this.addressClient.deleteAddressByBusinessKey(normalizedKey, addressNumber);
  }
}
