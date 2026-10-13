import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { EmployeeAddressService } from '../generated/api/employee-address.service';
import {
  AddressPlanResponse,
  AddressResponse,
  CreateAddressRequest,
  PlanAddressChangeRequest,
  UpdateAddressRequest,
} from '../generated/model/models';
import {
  PostalAddressModel,
  mapPostalAddressResponseToModel,
} from '../mappers/postal-address.mapper';
import { EmployeeBusinessKeyApiQuery } from './employee-read.client';

export interface EmployeeAddressApiModel {
  addressNumber: number;
  addressTypeCode: string;
  addressTypeName?: string | null;
  address: PostalAddressModel;
  startDate: string;
  endDate: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeAddressReadClient {
  private readonly api = inject(EmployeeAddressService);

  readEmployeeAddressesByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
  ): Observable<ReadonlyArray<EmployeeAddressApiModel>> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.listEmployeeAddressesByBusinessKey(normalizedKey).pipe(
      map((addresses) => addresses.map((address) => this.toEmployeeAddressApiModel(address))),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of([]);
        }

        return throwError(() => error);
      }),
    );
  }

  createAddressByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: CreateAddressRequest,
  ): Observable<EmployeeAddressApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .createAddressByBusinessKey({
        ...normalizedKey,
        createAddressRequest: {
          addressTypeCode: request.addressTypeCode.trim().toUpperCase(),
          address: request.address,
          startDate: request.startDate.trim(),
          endDate: this.normalizeOptionalValue(request.endDate),
        },
      })
      .pipe(map((address) => this.toEmployeeAddressApiModel(address)));
  }

  updateAddressByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    addressNumber: number,
    request: UpdateAddressRequest,
  ): Observable<EmployeeAddressApiModel> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .updateAddressByBusinessKey({
        ...normalizedKey,
        addressNumber,
        updateAddressRequest: {
          address: request.address,
          // Las fechas corregidas viajan: corregir una dirección son sus datos y su tramo
          // (ADR-057, decisión 3). Sin ellas el backend dejaba el tramo como estaba; desde el
          // backend#69 el inicio es obligatorio y omitirlo es un 400.
          startDate: request.startDate.trim(),
          endDate: this.normalizeOptionalValue(request.endDate),
        },
      })
      .pipe(map((address) => this.toEmployeeAddressApiModel(address)));
  }

  deleteAddressByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    addressNumber: number,
  ): Observable<void> {
    const normalizedKey = this.normalizeKey(key);

    return this.api
      .deleteAddressByBusinessKey({ ...normalizedKey, addressNumber })
      .pipe(map(() => undefined));
  }

  /** Pide al backend qué haría un cambio a la serie del tipo sin aplicarlo (ADR-057). */
  planAddressChangeByBusinessKey(
    key: EmployeeBusinessKeyApiQuery,
    request: PlanAddressChangeRequest,
  ): Observable<AddressPlanResponse> {
    const normalizedKey = this.normalizeKey(key);

    return this.api.planAddressChangeByBusinessKey({
      ...normalizedKey,
      planAddressChangeRequest: request,
    });
  }

  private normalizeKey(key: EmployeeBusinessKeyApiQuery): EmployeeBusinessKeyApiQuery {
    return {
      ruleSystemCode: key.ruleSystemCode.trim(),
      employeeTypeCode: key.employeeTypeCode.trim(),
      employeeNumber: key.employeeNumber.trim(),
    };
  }

  private normalizeOptionalValue(value: string | null | undefined): string | null {
    const normalizedValue = value?.trim() ?? '';
    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toEmployeeAddressApiModel(source: AddressResponse): EmployeeAddressApiModel {
    return {
      addressNumber: source.addressNumber,
      addressTypeCode: source.addressTypeCode,
      addressTypeName: source.addressTypeName ?? null,
      address: mapPostalAddressResponseToModel(source.address),
      startDate: source.startDate,
      endDate: source.endDate ?? null,
    };
  }
}
