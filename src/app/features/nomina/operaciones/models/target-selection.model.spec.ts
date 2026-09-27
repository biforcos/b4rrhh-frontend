import { describe, expect, it } from 'vitest';

import { buildTargetSelectionPayload } from './target-selection.model';

describe('buildTargetSelectionPayload', () => {
  it('ALL returns ALL_EMPLOYEES_WITH_PRESENCE_IN_PERIOD with no employee fields', () => {
    expect(buildTargetSelectionPayload('ALL', '', '', '', '')).toEqual({
      selectionType: 'ALL_EMPLOYEES_WITH_PRESENCE_IN_PERIOD',
    });
  });

  it('LIST is one number per line, all of the chosen type (frontend#88)', () => {
    const result = buildTargetSelectionPayload('LIST', 'EMP001\nEMP002', 'INTERNAL', '', '');
    expect(result).toEqual({
      selectionType: 'EMPLOYEE_LIST',
      employees: [
        { employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP001' },
        { employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP002' },
      ],
    });
  });

  it('LIST ignores blank lines', () => {
    const result = buildTargetSelectionPayload('LIST', 'EMP001\n\n', 'INTERNAL', '', '');
    expect(result.employees).toHaveLength(1);
  });

  it('LIST trims whitespace from the number', () => {
    const result = buildTargetSelectionPayload('LIST', '  EMP001 ', 'INTERNAL', '', '');
    expect(result.employees![0]).toEqual({
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP001',
    });
  });

  it('SINGLE returns single employee target', () => {
    expect(buildTargetSelectionPayload('SINGLE', '', '', 'INTERNAL', 'EMP001')).toEqual({
      selectionType: 'SINGLE_EMPLOYEE',
      employee: { employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP001' },
    });
  });
});
