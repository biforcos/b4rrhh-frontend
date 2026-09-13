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
  mapPayrollConceptResponseToModel,
  mapCompanyProfileResponseToModel,
  mapEmployeeProfileResponseToModel,
  mapAgreementProfileResponseToModel,
} from '../mapper/recibos.mapper';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import {
  PayrollSummaryModel,
  PayrollCompanyProfileModel,
  PayrollEmployeeProfileModel,
  PayrollAgreementProfileModel,
} from '../models/payroll-summary.model';
import { RecibosFilters } from '../models/recibos-filters.model';

export interface PayrollDetailModel {
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
