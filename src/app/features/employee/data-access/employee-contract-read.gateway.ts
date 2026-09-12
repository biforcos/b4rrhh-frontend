import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeContractReadClient } from '../../../core/api/clients/employee-contract-read.client';
import {
  EmployeeContractReadModel,
  mapEmployeeContractApiToReadModel,
} from '../../../core/api/mappers/employee-contract.mapper';
import { sortByTimelineRecency } from '../../../shared/utils/period-order.util';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeContractModel } from '../models/employee-contract.model';
import { EmployeeContractPlanModel } from '../models/employee-contract-plan.model';
import {
  ContractCorrectDraft,
  ContractCreateDraft,
  ContractPlanDraft,
  mapContractCorrectDraftToRequest,
  mapContractCreateDraftToRequest,
  mapContractPlanDraftToRequest,
  mapContractPlanResponseToModel,
} from './employee-contract.mapper';

/** Desempate propio del contrato, para dos períodos con el mismo estado y la misma fecha. */
function compareContractCodes(left: EmployeeContractModel, right: EmployeeContractModel): number {
  const contractCodeOrder = right.contractCode.localeCompare(left.contractCode);
  if (contractCodeOrder !== 0) {
    return contractCodeOrder;
  }

  const leftSubtype = left.contractSubtypeCode ?? '';
  const rightSubtype = right.contractSubtypeCode ?? '';
  return rightSubtype.localeCompare(leftSubtype);
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeContractReadGateway {
  private readonly employeeContractReadClient = inject(EmployeeContractReadClient);

  readEmployeeContractsByBusinessKey(
    key: EmployeeBusinessKey,
  ): Observable<ReadonlyArray<EmployeeContractModel>> {
    return this.employeeContractReadClient.readEmployeeContractsByBusinessKey(key).pipe(
      map((contracts) =>
        contracts
          .map((contract) => mapEmployeeContractApiToReadModel(contract))
          .filter((contract): contract is EmployeeContractReadModel => contract !== null)
          .map((contract) => this.toEmployeeContractModel(contract)),
      ),
      // El backend sirve ascendente; la ficha ordena como las otras tablas de períodos
      // (frontend#37). Se ordena aquí y no en el store: así lo comprueba el spec que recorre
      // los cinco gateways, en vez de depender de que alguien llame al ordenador (frontend#39).
      map((contracts) => this.sortByTimelineRecency(contracts)),
    );
  }

  createContract(key: EmployeeBusinessKey, draft: ContractCreateDraft): Observable<void> {
    return this.employeeContractReadClient
      .createContractByBusinessKey(key, mapContractCreateDraftToRequest(draft))
      .pipe(map(() => undefined));
  }

  planContractChange(
    key: EmployeeBusinessKey,
    draft: ContractPlanDraft,
  ): Observable<EmployeeContractPlanModel> {
    return this.employeeContractReadClient
      .planContractChangeByBusinessKey(key, mapContractPlanDraftToRequest(draft))
      .pipe(map((plan) => mapContractPlanResponseToModel(plan)));
  }

  correctContractOccurrence(
    key: EmployeeBusinessKey,
    startDate: string,
    draft: ContractCorrectDraft,
  ): Observable<void> {
    return this.employeeContractReadClient
      .updateContractByBusinessKey(key, startDate, mapContractCorrectDraftToRequest(draft))
      .pipe(map(() => undefined));
  }

  private sortByTimelineRecency(
    contracts: ReadonlyArray<EmployeeContractModel>,
  ): ReadonlyArray<EmployeeContractModel> {
    return sortByTimelineRecency(contracts, compareContractCodes);
  }

  private toEmployeeContractModel(source: EmployeeContractReadModel): EmployeeContractModel {
    return {
      contractCode: source.contractCode,
      contractTypeName: source.contractTypeName ?? null,
      contractSubtypeCode: source.contractSubtypeCode,
      contractSubtypeName: source.contractSubtypeName ?? null,
      startDate: source.startDate,
      endDate: source.endDate,
      isActive: source.isActive,
    };
  }
}
