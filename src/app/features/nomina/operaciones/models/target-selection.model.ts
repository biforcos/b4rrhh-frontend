export type TargetSelectionMode = 'ALL' | 'LIST' | 'SINGLE';

export interface TargetSelectionPayload {
  selectionType: 'ALL_EMPLOYEES_WITH_PRESENCE_IN_PERIOD' | 'EMPLOYEE_LIST' | 'SINGLE_EMPLOYEE';
  employee?: { employeeTypeCode: string; employeeNumber: string };
  employees?: Array<{ employeeTypeCode: string; employeeNumber: string }>;
}

/**
 * El encargo de a quién se lanza.
 *
 * En «Lista» el tipo se elige una vez, arriba, y cada línea es un número (`b4rrhh/frontend#88`): el
 * tipo es un valor de catálogo, y escribirlo en cada línea era la forma de equivocarse que tuvo la
 * demo del 27/09.
 */
export function buildTargetSelectionPayload(
  mode: TargetSelectionMode,
  listText: string,
  listTypeCode: string,
  singleTypeCode: string,
  singleNumber: string,
): TargetSelectionPayload {
  if (mode === 'ALL') {
    return { selectionType: 'ALL_EMPLOYEES_WITH_PRESENCE_IN_PERIOD' };
  }
  if (mode === 'LIST') {
    const employees = listText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((employeeNumber) => ({ employeeTypeCode: listTypeCode.trim(), employeeNumber }));
    return { selectionType: 'EMPLOYEE_LIST', employees };
  }
  return {
    selectionType: 'SINGLE_EMPLOYEE',
    employee: { employeeTypeCode: singleTypeCode.trim(), employeeNumber: singleNumber.trim() },
  };
}
