import {
  CreateIdentifierRequest,
  UpdateIdentifierRequest,
} from '../../../core/api/generated/model/models';
import { EmployeeIdentifierApiModel } from '../../../core/api/clients/employee-identifier-read.client';
import { EmployeeIdentifierModel } from '../models/employee-identifier.model';
import { formatDisplayDate } from '../../../shared/utils/local-date.util';
import { SlotRowViewModel } from '../shared/ui/section/editable-slot-section.model';
import { getCatalogDisplay } from '../shared/utils/catalog-display.util';

export interface IdentifierDraft {
  key: string | null;
  value: string;
  issuingCountryCode: string;
  expirationDate: string;
  isPrimary: boolean;
}

export function createEmptyIdentifierDraft(): IdentifierDraft {
  return {
    key: null,
    value: '',
    issuingCountryCode: '',
    expirationDate: '',
    isPrimary: false,
  };
}

export interface EmployeeIdentifierRowTexts {
  primaryBadge: string;
  expirationPrefix: string;
}

export function mapEmployeeIdentifierApiToSlotRow(
  source: EmployeeIdentifierApiModel,
  texts?: EmployeeIdentifierRowTexts,
): SlotRowViewModel<string> {
  const identifierTypeCode = source.identifierTypeCode.trim().toUpperCase();
  const identifierValue = source.identifierValue.trim();
  const display = getCatalogDisplay(source.identifierTypeName, identifierTypeCode);

  return {
    key: identifierTypeCode,
    keyLabel: display.label,
    value: identifierValue,
    valueLabel: null,
    secondaryText: buildSecondaryText(source, texts, display.code),
    badges: buildBadges(source, texts),
  };
}

export function mapEmployeeIdentifierModelToSlotRow(
  source: EmployeeIdentifierModel,
  texts: EmployeeIdentifierRowTexts,
): SlotRowViewModel<string> {
  return mapEmployeeIdentifierApiToSlotRow(
    {
      identifierTypeCode: source.typeCode,
      identifierTypeName: source.typeName,
      identifierValue: source.value,
      issuingCountryCode: source.issuingCountryCode,
      expirationDate: source.expirationDate,
      isPrimary: source.isPrimary,
    },
    texts,
  );
}

function buildSecondaryText(
  source: EmployeeIdentifierApiModel,
  texts?: EmployeeIdentifierRowTexts,
  typeCode?: string,
): string | null {
  const issuingCountryCode = normalizeOptionalCountryCode(source.issuingCountryCode);
  const expirationDate = normalizeOptionalValue(source.expirationDate);
  // ADR-051 §5: las fechas, en formato local.
  const expirationLabel = expirationDate ? formatDisplayDate(expirationDate) : null;
  const expirationSegment =
    expirationLabel && texts ? `${texts.expirationPrefix}: ${expirationLabel}` : expirationLabel;

  const segments = [typeCode, issuingCountryCode, expirationSegment].filter(
    (segment): segment is string => Boolean(segment),
  );

  return segments.length > 0 ? segments.join(' · ') : null;
}

function buildBadges(
  source: EmployeeIdentifierApiModel,
  texts?: EmployeeIdentifierRowTexts,
): ReadonlyArray<string> {
  if (!texts || source.isPrimary !== true) {
    return [];
  }

  return [texts.primaryBadge];
}

export function mapIdentifierDraftToCreateIdentifierRequest(
  draft: IdentifierDraft,
): CreateIdentifierRequest {
  return {
    identifierTypeCode: normalizeIdentifierTypeCode(draft.key),
    identifierValue: normalizeValue(draft.value),
    issuingCountryCode: normalizeOptionalCountryCode(draft.issuingCountryCode),
    expirationDate: normalizeOptionalValue(draft.expirationDate),
    isPrimary: draft.isPrimary,
  };
}

export function mapIdentifierDraftToUpdateIdentifierRequest(
  draft: IdentifierDraft,
): UpdateIdentifierRequest {
  return {
    identifierValue: normalizeValue(draft.value),
    issuingCountryCode: normalizeOptionalCountryCode(draft.issuingCountryCode),
    expirationDate: normalizeOptionalValue(draft.expirationDate),
    isPrimary: draft.isPrimary,
  };
}

function normalizeIdentifierTypeCode(value: string | null): string {
  return value?.trim().toUpperCase() ?? '';
}

function normalizeValue(value: string): string {
  return value.trim();
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeOptionalCountryCode(value: string | null | undefined): string | null {
  const normalizedValue = normalizeOptionalValue(value);
  return normalizedValue ? normalizedValue.toUpperCase() : null;
}
