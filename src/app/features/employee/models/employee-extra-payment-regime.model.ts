/**
 * Si al empleado se le prorratean las pagas extras en este tramo, y desde cuando
 * (`b4rrhh/backend#118`).
 *
 * <p>Un solo dato y sin tercer valor: un empleado esta en un regimen o en el otro. «No se sabe»
 * no es un regimen del que se pueda calcular una nomina.
 */
export interface EmployeeExtraPaymentRegimeModel {
  extraPaymentRegimeNumber: number;
  startDate: string;
  endDate: string | null;
  prorated: boolean;
  isActive: boolean;
}
