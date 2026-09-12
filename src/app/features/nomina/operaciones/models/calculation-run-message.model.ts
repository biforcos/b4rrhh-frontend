import { EmployeeRouteSection } from '../../../employee/routing/employee-route-builder.util';

/**
 * Un mensaje de la ejecución: lo que le pasó a **una unidad de cálculo** concreta, hasta el
 * `presenceNumber`.
 *
 * Es la diferencia entre «han fallado 2» y «estos dos, y por esto» (frontend#61). El backend los
 * escribe en `payroll.calculation_run_message` y los devuelve por
 * `GET /payroll/calculation-runs/{runId}/messages`.
 *
 * Los campos de la unidad son opcionales porque hay mensajes que no son de una unidad —los del
 * arranque y el cierre de la ejecución—, y el contrato los declara nullable.
 */
export interface CalculationRunMessage {
  messageCode: string;
  /**
   * El literal del código, resuelto del catálogo por el backend (b4rrhh/backend#81).
   *
   * Nulo si el código no está sembrado, y entonces la celda pinta el código desnudo. Aquí no
   * se rellena con un diccionario a mano: eso se desincroniza el día uno y es justo lo que el
   * `b4rrhh/backend#16` existe para evitar.
   */
  messageCodeName: string | null;
  severityCode: string;
  message: string;
  detailsJson: string | null;
  ruleSystemCode: string | null;
  employeeTypeCode: string | null;
  employeeNumber: string | null;
  payrollPeriodCode: string | null;
  payrollTypeCode: string | null;
  presenceNumber: number | null;
  createdAt: string;
}

/** El código con el que el lanzador anota que la unidad sí acabó en recibo. */
const EXECUTED_MESSAGE_CODE = 'UNIT_ELIGIBLE_REAL_EXECUTED';

export interface CalculationRunMessageUnit {
  ruleSystemCode: string;
  employeeTypeCode: string;
  employeeNumber: string;
  presenceNumber: number | null;
}

/**
 * La unidad que el mensaje nombra, o null si el mensaje no es de una unidad.
 *
 * Sin los tres códigos de la clave no hay a quién enlazar, y no se inventa: el mensaje se pinta
 * sin destino.
 */
export function messageUnit(message: CalculationRunMessage): CalculationRunMessageUnit | null {
  if (!message.ruleSystemCode || !message.employeeTypeCode || !message.employeeNumber) {
    return null;
  }
  return {
    ruleSystemCode: message.ruleSystemCode,
    employeeTypeCode: message.employeeTypeCode,
    employeeNumber: message.employeeNumber,
    presenceNumber: message.presenceNumber,
  };
}

/**
 * A qué sección de la ficha lleva la línea.
 *
 * Si la unidad acabó en recibo, a su nómina. Si no, a la relación laboral, que es donde se
 * arregla lo que faltaba —la clasificación de quien cesa a mitad de mes, por ejemplo—.
 *
 * No lleva al recibo en sí porque la pantalla de recibos no tiene ruta para uno concreto: es una
 * búsqueda con selección dentro de la página. El issue pide enlazar «cuando se pueda».
 */
export function messageDestinationSection(message: CalculationRunMessage): EmployeeRouteSection {
  return message.messageCode === EXECUTED_MESSAGE_CODE ? 'payroll' : 'relacion';
}

/** Si la línea pide algo: la unidad no acabó en recibo. */
export function messageNeedsAttention(message: CalculationRunMessage): boolean {
  return message.messageCode !== EXECUTED_MESSAGE_CODE;
}
