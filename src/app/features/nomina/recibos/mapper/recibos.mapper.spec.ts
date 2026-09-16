import {
  mapPayrollSummaryResponseToModel,
  mapPayrollConceptResponseToModel,
} from './recibos.mapper';
import {
  PayrollSummaryResponse,
  PayrollSummaryResponsePayrollTypeCodeEnum,
  PayrollSummaryResponseStatusEnum,
} from '../../../../core/api/generated/model/payroll-summary-response';
import { PayrollConceptResponse } from '../../../../core/api/generated/model/payroll-concept-response';

describe('recibos.mapper', () => {
  describe('mapPayrollSummaryResponseToModel', () => {
    it('maps all fields correctly', () => {
      const response: PayrollSummaryResponse = {
        ruleSystemCode: 'MAS',
        employeeTypeCode: 'EMP',
        employeeNumber: 'MAS000001',
        payrollPeriodCode: '202604',
        payrollTypeCode: PayrollSummaryResponsePayrollTypeCodeEnum.Normal,
        presenceNumber: 1,
        status: PayrollSummaryResponseStatusEnum.Calculated,
        calculatedAt: '2026-04-24T12:00:00',
      };

      const model = mapPayrollSummaryResponseToModel(response);

      expect(model.ruleSystemCode).toBe('MAS');
      expect(model.employeeNumber).toBe('MAS000001');
      expect(model.payrollPeriodCode).toBe('202604');
      expect(model.status).toBe('CALCULATED');
    });
  });

  describe('mapPayrollConceptResponseToModel', () => {
    it('maps amount as null when undefined', () => {
      const response: PayrollConceptResponse = {
        lineNumber: 1,
        conceptCode: '001',
        conceptLabel: 'Salario base',
        amount: undefined,
        quantity: undefined,
        rate: undefined,
        conceptNatureCode: 'EARNING',
        originPeriodCode: '202604',
        displayOrder: 10,
        mergedStepCount: 1,
      };

      const model = mapPayrollConceptResponseToModel(response);

      expect(model.amount).toBeNull();
      expect(model.quantity).toBeNull();
      expect(model.rate).toBeNull();
      expect(model.conceptNatureCode).toBe('EARNING');
    });

    it('maps numeric values when present', () => {
      const response: PayrollConceptResponse = {
        lineNumber: 1,
        conceptCode: '001',
        conceptLabel: 'Salario base',
        amount: 2100,
        quantity: 30,
        rate: 70,
        conceptNatureCode: 'EARNING',
        originPeriodCode: '202604',
        displayOrder: 10,
        mergedStepCount: 1,
      };

      const model = mapPayrollConceptResponseToModel(response);

      expect(model.amount).toBe(2100);
      expect(model.quantity).toBe(30);
      expect(model.rate).toBe(70);
    });
  });
});
