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
      identifier: {
        identifierTypeCode: 'NATIONAL_ID',
        identifierValue: ' 12345678z ',
        issuingCountryCode: 'ESP',
      },
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

  // b4rrhh/backend#141 y #143: el documento viaja, normalizado; el motivo de entrada, no.
  it('sends the identity document and no entry reason', () => {
    const request = mapDraftToHireRequest({
      ruleSystemCode: 'ESP',
      firstName: 'Ana',
      lastName1: 'Lopez',
      lastName2: '',
      preferredName: '',
      hireDate: '2026-03-23',
      identifier: {
        identifierTypeCode: 'NATIONAL_ID',
        identifierValue: ' x1234567l ',
        issuingCountryCode: 'ESP',
      },
      companyCode: 'COMP',
      workCenterCode: 'WC1',
      contractTypeCode: 'CON',
      contractSubtypeCode: '',
      agreementCode: 'AGR',
      agreementCategoryCode: 'CAT',
      workingTime: { workingTimePercentage: 100 },
      costCenterDistribution: null,
    });

    expect(request.identifier).toEqual({
      identifierTypeCode: 'NATIONAL_ID',
      identifierValue: 'X1234567L',
      issuingCountryCode: 'ESP',
    });
    expect('entryReasonCode' in request).toBe(false);
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
      // El bloque de jornada es obligatorio en el contrato; este caso simula justo
      // a un backend que no lo manda, asi que el doble casting es deliberado.
    } as unknown as HireEmployeeResponse;

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
