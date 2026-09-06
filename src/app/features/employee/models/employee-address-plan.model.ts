/** Un tramo de fechas; `endDate` a null significa «en adelante». */
export interface AddressDatePeriod {
  startDate: string;
  endDate: string | null;
}

/**
 * Un tramo que además nombra la dirección a la que pertenece. El número es null solo en la
 * dirección que el plan añadiría, que aún no tiene ninguno.
 */
export interface AddressOccurrencePeriod extends AddressDatePeriod {
  addressNumber: number | null;
}

/** La única dirección existente que el plan movería por su cuenta: solo cambia su fecha fin (ADR-057). */
export interface AddressPlanAdjustment {
  before: AddressDatePeriod;
  after: AddressDatePeriod;
}

export type AddressPlanOperation = 'ADD' | 'REMOVE' | 'CORRECT';

/**
 * Sin `OUTSIDE_PRESENCE`: una serie de direcciones puede sobrevivir a la presencia, así que ese
 * rechazo no existe aquí.
 */
export type AddressPlanRejection = 'OVERLAP' | 'GAP_NOT_ALLOWED' | 'IS_A_CORRECTION';

/**
 * Lo que un cambio haría a la serie de direcciones de un tipo antes de aplicarlo (ADR-057,
 * decisión 6). Las direcciones no forman una serie sino una por tipo —domicilio, fiscal, de
 * envío—, y el plan solo habla de la del tipo que se toca.
 *
 * La cobertura la declara el catálogo: obligatoria en el domicilio y opcional en los demás
 * (decisión 1). La pantalla no lo consulta: en el domicilio el hueco vuelve como rechazo y en
 * los demás como consecuencia de un plan aceptado.
 */
export interface EmployeeAddressPlanModel {
  operation: AddressPlanOperation;
  accepted: boolean;
  rejection: AddressPlanRejection | null;
  occurrence: AddressOccurrencePeriod;
  /**
   * En una corrección, la dirección tal y como está hoy: la que `occurrence` sustituye. Es lo que
   * nombra un `IS_A_CORRECTION`, y con lo que la pantalla ofrece pasar a corregirla —por eso
   * lleva su número, que es como se pide la corrección—.
   */
  correctedOccurrence: AddressOccurrencePeriod | null;
  adjustedOccurrence: AddressPlanAdjustment | null;
  overlaps: ReadonlyArray<AddressDatePeriod>;
  gaps: ReadonlyArray<AddressDatePeriod>;
  stretchCandidates: ReadonlyArray<AddressDatePeriod>;
  projected: ReadonlyArray<AddressDatePeriod>;
}
