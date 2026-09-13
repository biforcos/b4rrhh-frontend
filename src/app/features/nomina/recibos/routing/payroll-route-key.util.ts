import { ParamMap } from '@angular/router';

import { PayrollBusinessKey } from '../models/payroll-business-key.model';

/**
 * La dirección de un recibo se forma con su clave de negocio, igual que la de la ficha del
 * empleado (`/personas/empleados/ESP/INTERNAL/EMP000001/relacion`) y por el mismo motivo: el `id`
 * técnico no es identidad pública (ADR-004, `backend#10`).
 *
 * Las seis partes hacen falta, y el `presenceNumber` es la que se olvida: un empleado con el mes
 * partido tiene **dos recibos del mismo periodo**, y sin ese número la dirección no distingue
 * cuál de los dos (`frontend#64`).
 */
export const payrollRouteBaseSegment = 'nomina/recibos';

export const payrollRouteParamNames = {
  ruleSystemCode: 'ruleSystemCode',
  employeeTypeCode: 'employeeTypeCode',
  employeeNumber: 'employeeNumber',
  payrollPeriodCode: 'payrollPeriodCode',
  payrollTypeCode: 'payrollTypeCode',
  presenceNumber: 'presenceNumber',
} as const;

const PAYROLL_TYPE_CODES: ReadonlyArray<PayrollBusinessKey['payrollTypeCode']> = [
  'NORMAL',
  'EXTRA',
];

export function buildPayrollKeyRoutePath(): string {
  return [
    payrollRouteParamNames.ruleSystemCode,
    payrollRouteParamNames.employeeTypeCode,
    payrollRouteParamNames.employeeNumber,
    payrollRouteParamNames.payrollPeriodCode,
    payrollRouteParamNames.payrollTypeCode,
    payrollRouteParamNames.presenceNumber,
  ]
    .map((name) => `:${name}`)
    .join('/');
}

export function buildPayrollDetailRouteCommands(
  key: PayrollBusinessKey,
): ReadonlyArray<string | number> {
  return [
    `/${payrollRouteBaseSegment}`,
    key.ruleSystemCode,
    key.employeeTypeCode,
    key.employeeNumber,
    key.payrollPeriodCode,
    key.payrollTypeCode,
    key.presenceNumber,
  ];
}

/**
 * Devuelve `null` cuando la URL no nombra un recibo posible: falta un segmento, el tipo de nómina
 * no es uno de los dos que existen, o el número de presencia no es un entero positivo.
 *
 * Nulo aquí significa «esta dirección no puede ser de ningún recibo», y la pantalla lo dice. No
 * es lo mismo que «el recibo no está»: eso lo contesta el backend con un 404, y también se dice.
 */
export function readPayrollBusinessKeyFromParamMap(paramMap: ParamMap): PayrollBusinessKey | null {
  const ruleSystemCode = paramMap.get(payrollRouteParamNames.ruleSystemCode)?.trim() ?? '';
  const employeeTypeCode = paramMap.get(payrollRouteParamNames.employeeTypeCode)?.trim() ?? '';
  const employeeNumber = paramMap.get(payrollRouteParamNames.employeeNumber)?.trim() ?? '';
  const payrollPeriodCode = paramMap.get(payrollRouteParamNames.payrollPeriodCode)?.trim() ?? '';
  const payrollTypeCode = paramMap.get(payrollRouteParamNames.payrollTypeCode)?.trim() ?? '';
  const presenceNumberRaw = paramMap.get(payrollRouteParamNames.presenceNumber)?.trim() ?? '';

  if (!ruleSystemCode || !employeeTypeCode || !employeeNumber || !payrollPeriodCode) {
    return null;
  }

  if (!isPayrollTypeCode(payrollTypeCode)) {
    return null;
  }

  if (!/^\d+$/.test(presenceNumberRaw)) {
    return null;
  }

  const presenceNumber = Number(presenceNumberRaw);
  if (presenceNumber <= 0) {
    return null;
  }

  return {
    ruleSystemCode,
    employeeTypeCode,
    employeeNumber,
    payrollPeriodCode,
    payrollTypeCode,
    presenceNumber,
  };
}

export function arePayrollBusinessKeysEqual(
  left: PayrollBusinessKey | null | undefined,
  right: PayrollBusinessKey | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return (
    left.ruleSystemCode === right.ruleSystemCode &&
    left.employeeTypeCode === right.employeeTypeCode &&
    left.employeeNumber === right.employeeNumber &&
    left.payrollPeriodCode === right.payrollPeriodCode &&
    left.payrollTypeCode === right.payrollTypeCode &&
    left.presenceNumber === right.presenceNumber
  );
}

function isPayrollTypeCode(value: string): value is PayrollBusinessKey['payrollTypeCode'] {
  return (PAYROLL_TYPE_CODES as ReadonlyArray<string>).includes(value);
}
