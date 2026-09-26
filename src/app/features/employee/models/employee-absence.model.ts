/**
 * Una ausencia del empleado (`b4rrhh/backend#127`, `b4rrhh/frontend#84`).
 *
 * <p>La clave de negocio es **el tipo y el momento en que empieza**, no un número de ocurrencia: es
 * lo que la distingue de la jornada o del contrato, que se numeran. Por eso aquí no hay
 * `absenceNumber` y sí `absenceTypeCode` con `startDate`.
 *
 * <p>Y por eso **el inicio no se puede corregir**: cambiarlo es otra ausencia. Corregir una ausencia
 * es cambiar cuándo acaba —o el testigo de derecho—; equivocarse en el día que empezó se arregla
 * borrándola y volviendo a declararla, que es lo que el API deja hacer.
 */
export interface EmployeeAbsenceModel {
  absenceTypeCode: string;
  /** Cómo se llama el tipo en el catálogo; el código si nadie le puso nombre. */
  absenceTypeLabel: string;
  startDate: string;
  endDate: string | null;
  /**
   * Si la baja lleva derecho a prestación (`b4rrhh/backend#129`).
   *
   * <p>Sólo significa algo en `IT_COMMON`: en los demás tipos no hay prestación a la que tener
   * derecho, y la pantalla no lo enseña. Lo decide el INSS con la carencia del art. 172.a) de la
   * LGSS, y aquí es un dato que alguien teclea con la resolución delante.
   */
  benefitEntitled: boolean;
  /** Si sigue abierta, o sea sin fecha de fin. */
  isOpen: boolean;
}

/** El tipo de ausencia del que cuelga la prestación por incapacidad temporal. */
export const IT_COMMON_ABSENCE_TYPE = 'IT_COMMON';

/** Si para este tipo de ausencia el testigo de derecho a prestación significa algo. */
export function hasBenefitEntitlement(absenceTypeCode: string): boolean {
  return absenceTypeCode === IT_COMMON_ABSENCE_TYPE;
}
