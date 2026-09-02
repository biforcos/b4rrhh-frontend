import { UpdateEmployeeRequest } from '../../../core/api/generated/model/models';
import { EmployeeCoreIdentityDraft } from '../models/employee-core-identity-draft.model';

export function mapEmployeeCoreIdentityDraftToUpdateRequest(
  draft: EmployeeCoreIdentityDraft,
): UpdateEmployeeRequest {
  return {
    firstName: draft.firstName.trim(),
    lastName1: draft.lastName1.trim(),
    lastName2: normalizeOptionalValue(draft.lastName2),
    preferredName: normalizeOptionalValue(draft.preferredName),
  };
}

function normalizeOptionalValue(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}
