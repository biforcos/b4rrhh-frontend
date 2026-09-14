import { PayrollSummaryResponse } from '../../../../core/api/generated/model/payroll-summary-response';
import { PayrollCalculationStepResponse } from '../../../../core/api/generated/model/payroll-calculation-step-response';
import { PayrollConceptResponse } from '../../../../core/api/generated/model/payroll-concept-response';
import { PayrollCompanyProfileResponse } from '../../../../core/api/generated/model/payroll-company-profile-response';
import { PayrollEmployeeProfileResponse } from '../../../../core/api/generated/model/payroll-employee-profile-response';
import { PayrollAgreementProfileResponse } from '../../../../core/api/generated/model/payroll-agreement-profile-response';
import {
  PayrollSummaryModel,
  PayrollCompanyProfileModel,
  PayrollEmployeeProfileModel,
  PayrollAgreementProfileModel,
} from '../models/payroll-summary.model';
import { PayrollCalculationStepModel } from '../models/payroll-calculation-step.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';

export function mapPayrollSummaryResponseToModel(
  response: PayrollSummaryResponse,
): PayrollSummaryModel {
  return {
    ruleSystemCode: response.ruleSystemCode,
    employeeTypeCode: response.employeeTypeCode,
    employeeNumber: response.employeeNumber,
    payrollPeriodCode: response.payrollPeriodCode,
    payrollTypeCode: response.payrollTypeCode,
    presenceNumber: response.presenceNumber,
    status: response.status,
    calculatedAt: response.calculatedAt,
  };
}

export function mapPayrollConceptResponseToModel(
  response: PayrollConceptResponse,
): PayrollConceptModel {
  return {
    lineNumber: response.lineNumber,
    conceptCode: response.conceptCode,
    conceptLabel: response.conceptLabel,
    amount: response.amount ?? null,
    quantity: response.quantity ?? null,
    rate: response.rate ?? null,
    conceptNatureCode: response.conceptNatureCode,
    originPeriodCode: response.originPeriodCode ?? null,
    displayOrder: response.displayOrder,
  };
}

export function mapCompanyProfileResponseToModel(
  response: PayrollCompanyProfileResponse | undefined,
): PayrollCompanyProfileModel | null {
  if (!response) return null;
  return {
    legalName: response.legalName ?? null,
    taxIdentifier: response.taxIdentifier ?? null,
    street: response.street ?? null,
    city: response.city ?? null,
    postalCode: response.postalCode ?? null,
  };
}

export function mapEmployeeProfileResponseToModel(
  response: PayrollEmployeeProfileResponse | undefined,
): PayrollEmployeeProfileModel | null {
  if (!response) return null;
  return {
    fullName: response.fullName ?? null,
    nif: response.nif ?? null,
    street: response.street ?? null,
    city: response.city ?? null,
    postalCode: response.postalCode ?? null,
  };
}

export function mapAgreementProfileResponseToModel(
  response: PayrollAgreementProfileResponse | undefined,
): PayrollAgreementProfileModel | null {
  if (!response) return null;
  return {
    officialAgreementNumber: response.officialAgreementNumber ?? null,
    displayName: response.displayName ?? null,
    shortName: response.shortName ?? null,
    annualHours: response.annualHours ?? null,
    agreementCategoryCode: response.agreementCategoryCode ?? null,
  };
}

/**
 * Un paso del cálculo, tal cual lo sirve el contrato (`b4rrhh/backend#97`).
 *
 * Sin reordenar y sin agrupar: lo que llega ya viene en orden de ejecución, que es lo único que
 * estos pasos aportan sobre el recibo. Los siete campos que el contrato declara obligatorios se
 * copian tal cual; los cinco que pueden faltar —las dos fechas de segmento, la cantidad, la
 * tarifa y el orden de folio— pasan a `null`, y ese `null` significa algo en cada caso.
 */
export function mapPayrollCalculationStepResponseToModel(
  response: PayrollCalculationStepResponse,
): PayrollCalculationStepModel {
  return {
    executionOrder: response.executionOrder,
    conceptCode: response.conceptCode,
    conceptMnemonic: response.conceptMnemonic,
    calculationType: response.calculationType,
    functionalNature: response.functionalNature,
    executionScope: response.executionScope,
    segmentStartDate: response.segmentStartDate ?? null,
    segmentEndDate: response.segmentEndDate ?? null,
    amount: response.amount,
    quantity: response.quantity ?? null,
    rate: response.rate ?? null,
    payslipOrderCode: response.payslipOrderCode ?? null,
  };
}
