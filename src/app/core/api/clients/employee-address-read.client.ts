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
import { EmployeeBusinessKeyApiQuery } from './employee-read.client';

export interface EmployeeAddressApiModel {
  addressNumber: number;
  addressTypeCode: string;
  addressTypeName?: string | null;
  street: string;
  city: string;
  countryCode: string;
  postalCode: string | null;
  regionCode: string | null;
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
          street: request.street.trim(),
          city: request.city.trim(),
          countryCode: request.countryCode.trim().toUpperCase(),
          postalCode: this.normalizeOptionalValue(request.postalCode),
          regionCode: this.normalizeOptionalValue(request.regionCode),
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
          street: request.street.trim(),
          city: request.city.trim(),
          countryCode: request.countryCode.trim().toUpperCase(),
          postalCode: this.normalizeOptionalValue(request.postalCode),
          regionCode: this.normalizeOptionalValue(request.regionCode),
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
      street: source.street,
      city: source.city,
      countryCode: source.countryCode,
      postalCode: source.postalCode ?? null,
      regionCode: source.regionCode ?? null,
      startDate: source.startDate,
      endDate: source.endDate ?? null,
    };
  }
}
