import { ParamMap } from '@angular/router';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';

export const employeeRouteParamNames = {
  ruleSystemCode: 'ruleSystemCode',
  employeeTypeCode: 'employeeTypeCode',
  employeeNumber: 'employeeNumber',
} as const;

export function toEmployeeBusinessKey(value: EmployeeBusinessKey): EmployeeBusinessKey {
  return {
    ruleSystemCode: value.ruleSystemCode.trim(),
    employeeTypeCode: value.employeeTypeCode.trim(),
    employeeNumber: value.employeeNumber.trim(),
  };
}

export function readEmployeeBusinessKeyFromParamMap(
  paramMap: ParamMap,
): EmployeeBusinessKey | null {
  const ruleSystemCode = paramMap.get(employeeRouteParamNames.ruleSystemCode)?.trim() ?? '';
  const employeeTypeCode = paramMap.get(employeeRouteParamNames.employeeTypeCode)?.trim() ?? '';
  const employeeNumber = paramMap.get(employeeRouteParamNames.employeeNumber)?.trim() ?? '';

  if (!ruleSystemCode || !employeeTypeCode || !employeeNumber) {
    return null;
  }

  return {
    ruleSystemCode,
    employeeTypeCode,
    employeeNumber,
  };
}

export function areEmployeeBusinessKeysEqual(
  left: EmployeeBusinessKey | null | undefined,
  right: EmployeeBusinessKey | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return (
    left.ruleSystemCode === right.ruleSystemCode &&
    left.employeeTypeCode === right.employeeTypeCode &&
    left.employeeNumber === right.employeeNumber
  );
}
