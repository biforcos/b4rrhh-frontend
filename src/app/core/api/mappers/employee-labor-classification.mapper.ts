import { EmployeeLaborClassificationApiModel } from '../clients/employee-labor-classification-read.client';

export interface EmployeeLaborClassificationReadModel {
  agreementCode: string;
  agreementName: string | null;
  agreementCategoryCode: string;
  agreementCategoryName: string | null;
  grupoCotizacionCode: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}

export function mapEmployeeLaborClassificationApiToReadModel(
  source: EmployeeLaborClassificationApiModel,
): EmployeeLaborClassificationReadModel | null {
  const agreementCode = source.agreementCode.trim().toUpperCase();
  const agreementCategoryCode = source.agreementCategoryCode.trim().toUpperCase();
  const startDate = source.startDate.trim();

  if (!agreementCode || !agreementCategoryCode || !startDate) {
    return null;
  }

  const endDate = normalizeOptionalValue(source.endDate);

  return {
    agreementCode,
    agreementName: normalizeOptionalValue(source.agreementName),
    agreementCategoryCode,
    agreementCategoryName: normalizeOptionalValue(source.agreementCategoryName),
    grupoCotizacionCode: normalizeOptionalValue(source.grupoCotizacionCode),
    startDate,
    endDate,
    isActive: endDate === null,
  };
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}
