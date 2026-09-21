import { EmployeeExtraPaymentRegimeApiModel } from '../clients/employee-extra-payment-regime-read.client';

export interface EmployeeExtraPaymentRegimeReadModel {
  extraPaymentRegimeNumber: number;
  startDate: string;
  endDate: string | null;
  prorated: boolean;
  isActive: boolean;
}

export function mapEmployeeExtraPaymentRegimeApiToReadModel(
  source: EmployeeExtraPaymentRegimeApiModel,
): EmployeeExtraPaymentRegimeReadModel | null {
  const extraPaymentRegimeNumber = source.extraPaymentRegimeNumber;
  const startDate = source.startDate.trim();

  if (
    !Number.isInteger(extraPaymentRegimeNumber) ||
    extraPaymentRegimeNumber <= 0 ||
    startDate.length === 0
  ) {
    return null;
  }

  // Un regimen es si o no. Cualquier otra cosa no es «desconocido»: es una respuesta que este
  // modelo no sabe leer, y una fila que no se sabe leer no se pinta.
  if (typeof source.prorated !== 'boolean') {
    return null;
  }

  const endDate = normalizeOptionalValue(source.endDate);

  return {
    extraPaymentRegimeNumber,
    startDate,
    endDate,
    prorated: source.prorated,
    isActive: endDate === null,
  };
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : null;
}
