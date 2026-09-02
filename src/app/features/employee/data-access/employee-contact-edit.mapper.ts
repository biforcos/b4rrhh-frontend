import {
  CreateContactRequest,
  UpdateContactRequest,
} from '../../../core/api/generated/model/models';
import { EmployeeContactApiModel } from '../../../core/api/clients/employee-contact-read.client';
import { SlotDraft, SlotRowViewModel } from '../shared/ui/section/editable-slot-section.model';
import { EmployeeContactModel } from '../models/employee-contact.model';
import { getCatalogDisplay } from '../shared/utils/catalog-display.util';

export function mapEmployeeContactApiToSlotRow(
  source: EmployeeContactApiModel,
): SlotRowViewModel<string> {
  const contactTypeCode = source.contactTypeCode.trim();
  const contactValue = source.contactValue.trim();
  const display = getCatalogDisplay(source.contactTypeName, contactTypeCode);

  return {
    key: contactTypeCode,
    keyLabel: display.label,
    value: contactValue,
    valueLabel: null,
    secondaryText: display.code,
  };
}

export function mapEmployeeContactModelToSlotRow(
  source: EmployeeContactModel,
): SlotRowViewModel<string> {
  return mapEmployeeContactApiToSlotRow({
    contactTypeCode: source.contactTypeCode,
    contactTypeName: source.contactTypeName,
    contactValue: source.contactValue,
  });
}

export function mapSlotDraftToCreateContactRequest(draft: SlotDraft<string>): CreateContactRequest {
  return {
    contactTypeCode: normalizeKey(draft.key),
    contactValue: normalizeValue(draft.value),
  };
}

export function mapSlotDraftToUpdateContactRequest(draft: SlotDraft<string>): UpdateContactRequest {
  return {
    contactValue: normalizeValue(draft.value),
  };
}

function normalizeKey(value: string | null): string {
  return value?.trim() ?? '';
}

function normalizeValue(value: string): string {
  return value.trim();
}
