import {
  RehireEmployeeRequest,
  RehireEmployeeResponse,
} from '../../../core/api/generated/model/models';
import { RehireEmployeeDraft, RehireEmployeeResult } from '../models/employee-rehire.model';

export function mapDraftToRehireRequest(draft: RehireEmployeeDraft): RehireEmployeeRequest {
  const workingTimePercentage = draft.workingTime.workingTimePercentage;
  if (!isValidWorkingTimePercentage(workingTimePercentage)) {
    throw new Error('workingTime.workingTimePercentage is required');
  }

  return {
    rehireDate: draft.rehireDate,
    entryReasonCode: draft.entryReasonCode,
    companyCode: draft.companyCode,
    laborClassification: {
      agreementCode: draft.agreementCode,
      agreementCategoryCode: draft.agreementCategoryCode,
    },
    contract: {
      contractTypeCode: draft.contractTypeCode,
      contractSubtypeCode: draft.contractSubtypeCode ?? '',
    },
    workCenter: {
      workCenterCode: draft.workCenterCode,
    },
    costCenterDistribution: draft.costCenterDistribution
      ? {
          items: draft.costCenterDistribution.items.map((item) => ({
            costCenterCode: item.costCenterCode.trim().toUpperCase(),
            allocationPercentage: item.allocationPercentage,
          })),
        }
      : undefined,
    workingTime: {
      workingTimePercentage,
    },
  };
}

export function mapResponseToResult(response: RehireEmployeeResponse): RehireEmployeeResult {
  return {
    employeeKey: {
      ruleSystemCode: response.ruleSystemCode,
      employeeTypeCode: response.employeeTypeCode,
      employeeNumber: response.employeeNumber,
    },
    rehireDate: response.rehireDate,
    status: response.status,
    newWorkingTime: response.newWorkingTime
      ? {
          workingTimeNumber: response.newWorkingTime.workingTimeNumber,
          workingTimePercentage: response.newWorkingTime.workingTimePercentage,
          weeklyHours: response.newWorkingTime.weeklyHours,
          dailyHours: response.newWorkingTime.dailyHours,
          monthlyHours: response.newWorkingTime.monthlyHours,
          startDate: response.newWorkingTime.startDate,
          endDate: response.newWorkingTime.endDate,
        }
      : undefined,
  };
}

function isValidWorkingTimePercentage(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0 && value <= 100;
}
