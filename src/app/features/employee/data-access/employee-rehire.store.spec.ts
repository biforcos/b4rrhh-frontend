import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeRehireGateway } from './employee-rehire.gateway';
import { EmployeeRehireStore } from './employee-rehire.store';
import { RehireEmployeeDraft } from '../models/employee-rehire.model';

const draftFixture: RehireEmployeeDraft = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'EMP',
  employeeNumber: 'E001',
  rehireDate: '2026-04-15',
  entryReasonCode: 'REHIRE',
  companyCode: 'ES01',
  workCenterCode: 'MADRID_01',
  contractTypeCode: 'PER',
  contractSubtypeCode: 'ORD',
  agreementCode: 'AGR',
  agreementCategoryCode: 'CAT',
  workingTime: {
    workingTimePercentage: 80,
  },
  costCenterDistribution: null,
};

describe('EmployeeRehireStore', () => {
  let store: EmployeeRehireStore;
  let gatewayMock: {
    rehire: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      rehire: vi.fn().mockReturnValue(
        of({
          employeeKey: {
            ruleSystemCode: 'ESP',
            employeeTypeCode: 'EMP',
            employeeNumber: 'E001',
          },
          rehireDate: '2026-04-15',
          status: 'ACTIVE',
          newWorkingTime: {
            workingTimeNumber: 1,
            workingTimePercentage: 80,
            weeklyHours: 32,
            dailyHours: 6.4,
            monthlyHours: 133.34,
            startDate: '2026-04-15',
            endDate: null,
          },
        }),
      ),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeRehireGateway, useValue: gatewayMock }],
    });

    store = TestBed.inject(EmployeeRehireStore);
  });

  it('maps 409 already active conflicts explicitly', () => {
    gatewayMock.rehire.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: {
          code: 'EMPLOYEE_ALREADY_ACTIVE',
        },
      })),
    );

    store.rehire(draftFixture);

    expect(store.error()).toBe('already-active');
  });

  it('maps 409 rehire date conflicts without collapsing them into already active', () => {
    gatewayMock.rehire.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: {
          code: 'INVALID_REHIRE_DATE',
        },
      })),
    );

    store.rehire(draftFixture);

    expect(store.error()).toBe('invalid-rehire-date');
  });

  it('maps unknown 409 conflicts to a generic rehire conflict bucket', () => {
    gatewayMock.rehire.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: {
          code: 'REHIRE_CONFLICT_UNKNOWN',
          message: 'Unexpected lifecycle conflict',
        },
      })),
    );

    store.rehire(draftFixture);

    expect(store.error()).toBe('rehire-conflict');
  });
});
