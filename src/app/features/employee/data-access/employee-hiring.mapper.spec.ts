import { HireEmployeeResponse } from '../../../core/api/generated/model/models';
import { HireEmployeeDraft } from '../models/employee-hiring.model';
import { mapDraftToHireRequest, mapResponseToResult } from './employee-hiring.mapper';

describe('employee-hiring.mapper', () => {
  it('maps working time percentage as the only outgoing workingTime field', () => {
    const draft: HireEmployeeDraft = {
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'EMP',
      firstName: 'Ana',
      lastName1: 'Lopez',
      lastName2: '',
      preferredName: '',
      hireDate: '2026-03-23',
      entryReasonCode: 'HIRE',
      companyCode: 'COMP',
      workCenterCode: 'WC1',
      contractTypeCode: 'CON',
      contractSubtypeCode: 'SUB',
      agreementCode: 'AGR',
      agreementCategoryCode: 'CAT',
      workingTime: {
        workingTimePercentage: 75,
      },
      costCenterDistribution: null,
    };

    const request = mapDraftToHireRequest(draft);

    expect(request.workingTime).toEqual({ workingTimePercentage: 75 });
    const rawWorkingTime = request.workingTime as unknown as Record<string, unknown>;

    expect(rawWorkingTime['weeklyHours']).toBeUndefined();
    expect(rawWorkingTime['dailyHours']).toBeUndefined();
    expect(rawWorkingTime['monthlyHours']).toBeUndefined();
    expect(rawWorkingTime['workingTimeNumber']).toBeUndefined();
    expect(rawWorkingTime['startDate']).toBeUndefined();
    expect(rawWorkingTime['endDate']).toBeUndefined();
  });

  it('maps the backend working time block into the frontend hire result', () => {
    const response: HireEmployeeResponse = {
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'EMP',
      employeeNumber: 'E001',
      firstName: 'Ana',
      lastName1: 'Lopez',
      lastName2: 'Garcia',
      preferredName: null,
      displayName: 'Ana Lopez Garcia',
      status: 'ACTIVE',
      hireDate: '2026-03-23',
      initialPresence: {
        presenceNumber: 1,
        startDate: '2026-03-23',
        companyCode: 'COMP',
        entryReasonCode: 'HIRE',
      },
      initialWorkCenter: {
        startDate: '2026-03-23',
        workCenterCode: 'WC1',
        workCenterName: 'Madrid Centro',
      },
      costCenter: undefined,
      initialContract: {
        startDate: '2026-03-23',
        contractTypeCode: 'CON',
        contractSubtypeCode: 'SUB',
      },
      initialLaborClassification: {
        startDate: '2026-03-23',
        agreementCode: 'AGR',
        agreementCategoryCode: 'CAT',
      },
      workingTime: {
        workingTimeNumber: 987654,
        workingTimePercentage: 75,
        weeklyHours: 30,
        dailyHours: 6,
        monthlyHours: 125,
        startDate: '2026-03-23',
        endDate: null,
      },
    };

    const result = mapResponseToResult(response);

    expect(result.employeeKey).toEqual({
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'EMP',
      employeeNumber: 'E001',
    });
    expect(result.displayName).toBe('Ana Lopez Garcia');
    expect(result.hireDate).toBe('2026-03-23');
    expect(result.status).toBe('ACTIVE');
    expect(result.workingTime).toEqual({
      workingTimeNumber: 987654,
      workingTimePercentage: 75,
      weeklyHours: 30,
      dailyHours: 6,
      monthlyHours: 125,
      startDate: '2026-03-23',
      endDate: null,
    });
  });

  it('keeps hire success mapping working when the backend omits the working time block', () => {
    const response = {
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'EMP',
      employeeNumber: 'E001',
      firstName: 'Ana',
      lastName1: 'Lopez',
      lastName2: 'Garcia',
      preferredName: null,
      displayName: 'Ana Lopez Garcia',
      status: 'ACTIVE',
      hireDate: '2026-03-23',
      initialPresence: {
        presenceNumber: 1,
        startDate: '2026-03-23',
        companyCode: 'COMP',
        entryReasonCode: 'HIRE',
      },
      initialWorkCenter: {
        startDate: '2026-03-23',
        workCenterCode: 'WC1',
        workCenterName: 'Madrid Centro',
      },
      costCenter: undefined,
      initialContract: {
        startDate: '2026-03-23',
        contractTypeCode: 'CON',
        contractSubtypeCode: 'SUB',
      },
      initialLaborClassification: {
        startDate: '2026-03-23',
        agreementCode: 'AGR',
        agreementCategoryCode: 'CAT',
      },
    } as HireEmployeeResponse;

    const result = mapResponseToResult(response);

    expect(result.employeeKey).toEqual({
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'EMP',
      employeeNumber: 'E001',
    });
    expect(result.displayName).toBe('Ana Lopez Garcia');
    expect(result.workingTime).toBeUndefined();
  });
});
