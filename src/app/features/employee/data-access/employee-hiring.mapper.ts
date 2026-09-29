import {
  HireEmployeeRequest,
  HireEmployeeResponse,
} from '../../../core/api/generated/model/models';
import { HireEmployeeDraft, HireEmployeeResult } from '../models/employee-hiring.model';
import { HIRE_EMPLOYEE_DEFAULTS } from '../models/hire-employee.defaults';

export function mapDraftToHireRequest(draft: HireEmployeeDraft): HireEmployeeRequest {
  const workingTimePercentage = draft.workingTime.workingTimePercentage;
  if (!isValidWorkingTimePercentage(workingTimePercentage)) {
    throw new Error('workingTime.workingTimePercentage is required');
  }

  return {
    ruleSystemCode: draft.ruleSystemCode,
    employeeTypeCode: draft.employeeTypeCode || HIRE_EMPLOYEE_DEFAULTS.employeeTypeCode,
    firstName: draft.firstName,
    lastName1: draft.lastName1,
    lastName2: draft.lastName2 || null,
    preferredName: draft.preferredName || null,
    hireDate: draft.hireDate,
    // Sin motivo de entrada: un alta es una contratación, y el servidor la da por HIRING
    // (`b4rrhh/backend#143`).
    identifier: {
      identifierTypeCode: draft.identifier.identifierTypeCode,
      identifierValue: draft.identifier.identifierValue.trim().toUpperCase(),
      issuingCountryCode: draft.identifier.issuingCountryCode,
    },
    companyCode: draft.companyCode,
    workCenterCode: draft.workCenterCode,
    costCenterDistribution: draft.costCenterDistribution
      ? {
          items: draft.costCenterDistribution.items.map((item) => ({
            costCenterCode: item.costCenterCode.trim().toUpperCase(),
            allocationPercentage: item.allocationPercentage,
          })),
        }
      : undefined,
    laborClassification: {
      agreementCode: draft.agreementCode,
      agreementCategoryCode: draft.agreementCategoryCode,
    },
    contract: {
      contractTypeCode: draft.contractTypeCode,
      contractSubtypeCode: draft.contractSubtypeCode || '',
    },
    workingTime: {
      workingTimePercentage,
    },
  };
}

export function mapResponseToResult(response: HireEmployeeResponse): HireEmployeeResult {
  const workingTime = response.workingTime;

  return {
    employeeKey: {
      ruleSystemCode: response.ruleSystemCode,
      employeeTypeCode: response.employeeTypeCode,
      employeeNumber: response.employeeNumber,
    },
    displayName: response.displayName,
    hireDate: response.hireDate,
    status: response.status,
    workingTime: workingTime
      ? {
          workingTimeNumber: workingTime.workingTimeNumber,
          workingTimePercentage: workingTime.workingTimePercentage,
          weeklyHours: workingTime.weeklyHours,
          dailyHours: workingTime.dailyHours,
          monthlyHours: workingTime.monthlyHours,
          startDate: workingTime.startDate,
          endDate: workingTime.endDate,
        }
      : undefined,
  };
}

function isValidWorkingTimePercentage(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0 && value <= 100;
}
