import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ContractCatalogApiItem,
  EmployeeContractCatalogClient,
} from '../../../core/api/clients/employee-contract-catalog.client';
import { EmployeeContractCatalogItemModel } from '../models/employee-contract-catalog-item.model';
import { getCatalogDisplay } from '../shared/utils/catalog-display.util';

@Injectable({
  providedIn: 'root',
})
export class EmployeeContractCatalogGateway {
  private readonly client = inject(EmployeeContractCatalogClient);

  loadContractTypes(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<EmployeeContractCatalogItemModel>> {
    return this.client
      .listContractTypes(ruleSystemCode, referenceDate)
      .pipe(map((items) => items.map((item) => this.toCatalogItemModel(item))));
  }

  loadContractSubtypes(
    ruleSystemCode: string,
    contractTypeCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<EmployeeContractCatalogItemModel>> {
    return this.client
      .listContractSubtypes(ruleSystemCode, contractTypeCode, referenceDate)
      .pipe(map((items) => items.map((item) => this.toCatalogItemModel(item))));
  }

  private toCatalogItemModel(source: ContractCatalogApiItem): EmployeeContractCatalogItemModel {
    return {
      code: source.code,
      name: source.name,
      label: this.buildLabel(source.code, source.name),
      startDate: source.startDate,
      endDate: source.endDate,
    };
  }

  private buildLabel(code: string, name: string | null): string {
    const display = getCatalogDisplay(name, code);
    return display.code ? `${display.label} · ${display.code}` : display.label;
  }
}
