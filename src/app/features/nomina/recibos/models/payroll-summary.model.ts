import { PayrollSummaryResponseStatusEnum } from '../../../../core/api/generated/model/payroll-summary-response';
import { PayrollBusinessKey } from './payroll-business-key.model';

export type PayrollStatus = `${PayrollSummaryResponseStatusEnum}`;

export interface PayrollSummaryModel extends PayrollBusinessKey {
  status: PayrollStatus;
  calculatedAt: string;
}

/**
 * Un recibo tal como lo sirve la búsqueda, con lo que sólo la búsqueda sabe.
 *
 * `sharesPeriodWithAnotherPresence` va aquí y no en `PayrollSummaryModel`, que es también el del
 * detalle: la respuesta del detalle no lo trae, y ponerle `false` en su mapa haría decir «no tiene
 * hermana» a quien no lo sabe (`b4rrhh/frontend#104`).
 */
export interface PayrollListItemModel extends PayrollSummaryModel {
  sharesPeriodWithAnotherPresence: boolean;
  /**
   * El nombre del empleado (`b4rrhh/frontend#143`): al buscar por nombre, la lista tiene que enseñar
   * por qué entra cada fila. Sólo de la lista: las transiciones no lo traen y no lo pisan.
   */
  employeeName?: string | null;
}

export interface PayrollCompanyProfileModel {
  legalName: string | null;
  taxIdentifier: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
}

export interface PayrollEmployeeProfileModel {
  fullName: string | null;
  nif: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
}

export interface PayrollAgreementProfileModel {
  officialAgreementNumber: string | null;
  displayName: string | null;
  shortName: string | null;
  annualHours: string | null;
  agreementCategoryCode: string | null;
}
