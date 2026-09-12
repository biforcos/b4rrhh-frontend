import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeLaborClassificationReadClient } from '../../../core/api/clients/employee-labor-classification-read.client';
import {
  EmployeeLaborClassificationReadModel,
  mapEmployeeLaborClassificationApiToReadModel,
} from '../../../core/api/mappers/employee-labor-classification.mapper';
import { sortByTimelineRecency } from '../../../shared/utils/period-order.util';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeLaborClassificationModel } from '../models/employee-labor-classification.model';
import { EmployeeLaborClassificationPlanModel } from '../models/employee-labor-classification-plan.model';
import {
  LaborClassificationCorrectDraft,
  LaborClassificationCreateDraft,
  LaborClassificationPlanDraft,
  mapLaborClassificationCorrectDraftToRequest,
  mapLaborClassificationCreateDraftToRequest,
  mapLaborClassificationPlanDraftToRequest,
  mapLaborClassificationPlanResponseToModel,
} from './employee-labor-classification.mapper';

/** Desempate propio del convenio, para dos períodos con el mismo estado y la misma fecha. */
function compareAgreementCodes(
  left: EmployeeLaborClassificationModel,
  right: EmployeeLaborClassificationModel,
): number {
  const agreementCodeOrder = right.agreementCode.localeCompare(left.agreementCode);
  if (agreementCodeOrder !== 0) {
    return agreementCodeOrder;
  }

  return right.agreementCategoryCode.localeCompare(left.agreementCategoryCode);
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeLaborClassificationReadGateway {
  private readonly employeeLaborClassificationReadClient = inject(
    EmployeeLaborClassificationReadClient,
  );

  readEmployeeLaborClassificationsByBusinessKey(
    key: EmployeeBusinessKey,
  ): Observable<ReadonlyArray<EmployeeLaborClassificationModel>> {
    return this.employeeLaborClassificationReadClient
      .readEmployeeLaborClassificationsByBusinessKey(key)
      .pipe(
        map((classifications) =>
          classifications
            .map((classification) => mapEmployeeLaborClassificationApiToReadModel(classification))
            .filter(
              (classification): classification is EmployeeLaborClassificationReadModel =>
                classification !== null,
            )
            .map((classification) => this.toEmployeeLaborClassificationModel(classification)),
        ),
        // El backend sirve ascendente; la ficha ordena como las otras tablas de períodos
        // (frontend#37). Se ordena aquí y no en el store: así lo comprueba el spec que recorre
        // los cinco gateways, en vez de depender de que alguien llame al ordenador (frontend#39).
        map((classifications) => this.sortByTimelineRecency(classifications)),
      );
  }

  createLaborClassification(
    key: EmployeeBusinessKey,
    draft: LaborClassificationCreateDraft,
  ): Observable<void> {
    return this.employeeLaborClassificationReadClient
      .createLaborClassificationByBusinessKey(
        key,
        mapLaborClassificationCreateDraftToRequest(draft),
      )
      .pipe(map(() => undefined));
  }

  planLaborClassificationChange(
    key: EmployeeBusinessKey,
    draft: LaborClassificationPlanDraft,
  ): Observable<EmployeeLaborClassificationPlanModel> {
    return this.employeeLaborClassificationReadClient
      .planLaborClassificationChangeByBusinessKey(
        key,
        mapLaborClassificationPlanDraftToRequest(draft),
      )
      .pipe(map((plan) => mapLaborClassificationPlanResponseToModel(plan)));
  }

  correctLaborClassificationOccurrence(
    key: EmployeeBusinessKey,
    startDate: string,
    draft: LaborClassificationCorrectDraft,
  ): Observable<void> {
    return this.employeeLaborClassificationReadClient
      .updateLaborClassificationByBusinessKey(
        key,
        startDate,
        mapLaborClassificationCorrectDraftToRequest(draft),
      )
      .pipe(map(() => undefined));
  }

  private sortByTimelineRecency(
    classifications: ReadonlyArray<EmployeeLaborClassificationModel>,
  ): ReadonlyArray<EmployeeLaborClassificationModel> {
    return sortByTimelineRecency(classifications, compareAgreementCodes);
  }

  private toEmployeeLaborClassificationModel(
    source: EmployeeLaborClassificationReadModel,
  ): EmployeeLaborClassificationModel {
    return {
      agreementCode: source.agreementCode,
      agreementName: source.agreementName,
      agreementCategoryCode: source.agreementCategoryCode,
      agreementCategoryName: source.agreementCategoryName,
      grupoCotizacionCode: source.grupoCotizacionCode,
      startDate: source.startDate,
      endDate: source.endDate,
      isActive: source.isActive,
    };
  }
}
