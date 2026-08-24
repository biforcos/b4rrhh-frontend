import {
  EmployeeCloseWorkCenterRequest,
  EmployeeCreateWorkCenterRequest,
  EmployeeUpdateWorkCenterRequest,
} from '../../../core/api/generated/model/models';
export interface WorkCenterCreateDraft {
  workCenterCode: string;
  startDate: string;
  endDate: string;
}

export interface WorkCenterCorrectDraft {
  workCenterCode: string;
  startDate: string;
  endDate: string;
}

export function mapWorkCenterCreateDraftToRequest(draft: WorkCenterCreateDraft): EmployeeCreateWorkCenterRequest {
  return {
    workCenterCode: normalizeCode(draft.workCenterCode),
    startDate: normalizeRequiredValue(draft.startDate),
    endDate: normalizeOptionalValue(draft.endDate),
  };
}

export function mapWorkCenterCorrectDraftToRequest(draft: WorkCenterCorrectDraft): EmployeeUpdateWorkCenterRequest {
  return {
    workCenterCode: normalizeCode(draft.workCenterCode),
    startDate: normalizeRequiredValue(draft.startDate),
    endDate: normalizeOptionalValue(draft.endDate),
  };
}

export function mapWorkCenterCloseDateToRequest(endDate: string): EmployeeCloseWorkCenterRequest {
  return {
    endDate: normalizeRequiredValue(endDate),
  };
}

function normalizeCode(value: string | null | undefined): string {
  return normalizeRequiredValue(value).toUpperCase();
}

function normalizeRequiredValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}
