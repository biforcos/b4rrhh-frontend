import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { PayrollResponse } from '../../../../core/api/generated/model/payroll-response';
// El estado del recibo dejo de estar escrito a mano dentro de PayrollResponse y pasa a
// referenciar el enum comun del contrato: son los mismos cuatro valores en una sola
// definicion, que es lo que backend#80 vino a dejar.
import { PayrollStatus } from '../../../../core/api/generated/model/payroll-status';
import { RecibosClient } from '../client/recibos.client';
import {
  mapPayrollSummaryResponseToModel,
  mapPayrollCalculationStepResponseToModel,
  mapPayrollConceptResponseToModel,
  mapCompanyProfileResponseToModel,
  mapEmployeeProfileResponseToModel,
  mapAgreementProfileResponseToModel,
} from '../mapper/recibos.mapper';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollCalculationStepModel } from '../models/payroll-calculation-step.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import {
  PayrollSummaryModel,
  PayrollCompanyProfileModel,
  PayrollEmployeeProfileModel,
  PayrollAgreementProfileModel,
} from '../models/payroll-summary.model';
import { RecibosFilters } from '../models/recibos-filters.model';

export interface PayrollDetailModel {
  /**
   * El recibo en sí: clave, estado y fecha de cálculo.
   *
   * Va aquí y no se busca en la lista porque **una dirección tiene que poder abrirse sin lista**
   * (`frontend#64`): la misma respuesta que trae los conceptos trae ya lo que la cabecera y los
   * botones necesitan, así que no hace falta una segunda llamada ni haber buscado antes.
   */
  summary: PayrollSummaryModel;

  /**
   * La ejecución que produjo este recibo, o `null` si no la produjo ninguna registrada.
   *
   * Va aquí y **no en `PayrollSummaryModel`**, que es el modelo que comparten la lista y el
   * detalle: la lista se sirve de `PayrollSummaryResponse`, que no trae `runId`. Meterlo en el
   * modelo común obligaría al mapa de la lista a poner `null`, y entonces «no lo sé» y «no hay
   * ninguna» serían el mismo valor — que es justo la diferencia que esta pantalla tiene que decir
   * (`frontend#69`).
   *
   * Nulo es un caso real y no un hueco: el contrato lo dice para el cálculo provisional y para el
   * recálculo suelto de un recibo, que es el que ofrece «Recalcular».
   */
  runId: number | null;
  concepts: ReadonlyArray<PayrollConceptModel>;
  companyProfile: PayrollCompanyProfileModel | null;
  employeeProfile: PayrollEmployeeProfileModel | null;
  agreementProfile: PayrollAgreementProfileModel | null;
  presenceStartDate: string | null;
  presenceEndDate: string | null;
  /**
   * La antigüedad del empleado, como fecha (`b4rrhh/backend#91`).
   *
   * No es `presenceStartDate`: para un readmitido son dos fechas distintas, y ésta es la del
   * primer alta, que es la que la ficha enseña. Nula en los recibos calculados antes de que la
   * foto la llevara, y **esa nulidad significa «no se sabe»**: no se sustituye por la de al lado.
   */
  seniorityDate: string | null;
  workCenterCode: string | null;
  workCenterName: string | null;
}

@Injectable({ providedIn: 'root' })
export class RecibosGateway {
  private readonly client = inject(RecibosClient);

  search(filters: RecibosFilters): Observable<ReadonlyArray<PayrollSummaryModel>> {
    return this.client
      .search(filters)
      .pipe(map((items) => items.map(mapPayrollSummaryResponseToModel)));
  }

  getDetail(key: PayrollBusinessKey): Observable<PayrollDetailModel> {
    return this.client.getByBusinessKey(key).pipe(
      map((response) => ({
        summary: payrollResponseToSummary(response),
        runId: response.runId ?? null,
        concepts: (response.concepts ?? [])
          .map(mapPayrollConceptResponseToModel)
          .sort((a, b) => a.displayOrder - b.displayOrder),
        companyProfile: mapCompanyProfileResponseToModel(response.companyProfile),
        employeeProfile: mapEmployeeProfileResponseToModel(response.employeeProfile),
        agreementProfile: mapAgreementProfileResponseToModel(response.agreementProfile),
        presenceStartDate: response.presenceStartDate ?? null,
        presenceEndDate: response.presenceEndDate ?? null,
        seniorityDate: response.seniorityDate ?? null,
        workCenterCode: response.workCenterCode ?? null,
        workCenterName: response.workCenterName ?? null,
      })),
    );
  }

  /**
   * Los pasos del cálculo, en el orden en que el backend los sirve.
   *
   * **Sin `sort`, a diferencia de `getDetail`.** Las líneas del recibo sí se ordenan aquí por
   * `displayOrder`, porque el recibo es una lista ordenada para imprimir. Los pasos ya vienen en
   * orden de ejecución desde el `order by` del backend, y ordenarlos otra vez por cualquier cosa
   * —el folio, la naturaleza, el código— destruiría lo único que aportan (`b4rrhh/backend#97`).
   */
  getCalculationSteps(
    key: PayrollBusinessKey,
  ): Observable<ReadonlyArray<PayrollCalculationStepModel>> {
    return this.client
      .listCalculationSteps(key)
      .pipe(map((steps) => steps.map(mapPayrollCalculationStepResponseToModel)));
  }

  invalidate(key: PayrollBusinessKey): Observable<PayrollSummaryModel> {
    return this.client.invalidate(key).pipe(map(payrollResponseToSummary));
  }

  validate(key: PayrollBusinessKey): Observable<PayrollSummaryModel> {
    return this.client.validate(key).pipe(map(payrollResponseToSummary));
  }

  recalculate(key: PayrollBusinessKey): Observable<PayrollSummaryModel> {
    return this.client.recalculate(key).pipe(map(payrollResponseToSummary));
  }
}

const PAYROLL_RESPONSE_STATUS_MAP: Record<PayrollStatus, PayrollSummaryModel['status']> = {
  [PayrollStatus.NotValid]: 'NOT_VALID',
  [PayrollStatus.Calculated]: 'CALCULATED',
  [PayrollStatus.ExplicitValidated]: 'EXPLICIT_VALIDATED',
  [PayrollStatus.Definitive]: 'DEFINITIVE',
};

function payrollResponseToSummary(r: PayrollResponse): PayrollSummaryModel {
  return {
    ruleSystemCode: r.ruleSystemCode,
    employeeTypeCode: r.employeeTypeCode,
    employeeNumber: r.employeeNumber,
    payrollPeriodCode: r.payrollPeriodCode,
    payrollTypeCode: r.payrollTypeCode,
    presenceNumber: r.presenceNumber,
    status: PAYROLL_RESPONSE_STATUS_MAP[r.status],
    calculatedAt: r.calculatedAt,
  };
}
