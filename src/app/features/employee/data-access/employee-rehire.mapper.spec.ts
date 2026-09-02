import { RehireEmployeeResponse } from '../../../core/api/generated/model/models';
import { RehireEmployeeDraft } from '../models/employee-rehire.model';
import { mapDraftToRehireRequest, mapResponseToResult } from './employee-rehire.mapper';

describe('employee-rehire.mapper', () => {
  it('maps working time percentage as the only outgoing workingTime field', () => {
    const draft: RehireEmployeeDraft = {
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

    const request = mapDraftToRehireRequest(draft);

    expect(request.workingTime).toEqual({ workingTimePercentage: 80 });
    const rawWorkingTime = request.workingTime as unknown as Record<string, unknown>;

    expect(rawWorkingTime['weeklyHours']).toBeUndefined();
    expect(rawWorkingTime['dailyHours']).toBeUndefined();
    expect(rawWorkingTime['monthlyHours']).toBeUndefined();
    expect(rawWorkingTime['workingTimeNumber']).toBeUndefined();
    expect(rawWorkingTime['startDate']).toBeUndefined();
    expect(rawWorkingTime['endDate']).toBeUndefined();
  });

  it('maps backend newWorkingTime into the frontend rehire result', () => {
    const response: RehireEmployeeResponse = {
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'EMP',
      employeeNumber: 'E001',
      rehireDate: '2026-04-15',
      status: 'ACTIVE',
      newPresence: {
        presenceNumber: 2,
        companyCode: 'ES01',
        entryReasonCode: 'REHIRE',
        startDate: '2026-04-15',
      },
      newContract: {
        contractTypeCode: 'PER',
        contractSubtypeCode: 'ORD',
        startDate: '2026-04-15',
      },
      newLaborClassification: {
        agreementCode: 'AGR',
        agreementCategoryCode: 'CAT',
        startDate: '2026-04-15',
      },
      newWorkCenter: {
        workCenterAssignmentNumber: 3,
        workCenterCode: 'MADRID_01',
        startDate: '2026-04-15',
      },
      newCostCenter: undefined,
      newWorkingTime: {
        workingTimeNumber: 4,
        workingTimePercentage: 80,
        weeklyHours: 32,
        dailyHours: 6.4,
        monthlyHours: 133.34,
        startDate: '2026-04-15',
        endDate: null,
      },
    };

    const result = mapResponseToResult(response);

    expect(result.employeeKey).toEqual({
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'EMP',
      employeeNumber: 'E001',
    });
    expect(result.rehireDate).toBe('2026-04-15');
    expect(result.status).toBe('ACTIVE');
    expect(result.newWorkingTime).toEqual({
      workingTimeNumber: 4,
      workingTimePercentage: 80,
      weeklyHours: 32,
      dailyHours: 6.4,
      monthlyHours: 133.34,
      startDate: '2026-04-15',
      endDate: null,
    });
  });
});
