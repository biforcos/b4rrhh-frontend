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
        calculatedAt: '2026-04-24T10:00:00Z',
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
        conceptMnemonic: 'SALARIO_BASE',
        conceptLabel: 'Salario base',
        amount: undefined,
        quantity: undefined,
        rate: undefined,
        conceptNatureCode: 'EARNING',
        originPeriodCode: '202604',
        displayOrder: 10,
        mergedStepCount: 1,
        payslipSectionCode: 'DEVENGOS',
      };

      const model = mapPayrollConceptResponseToModel(response);

      expect(model.amount).toBeNull();
      expect(model.quantity).toBeNull();
      expect(model.rate).toBeNull();
      expect(model.conceptNatureCode).toBe('EARNING');
    });

    /**
     * El mnemónico y el literal son dos cosas y las dos llegan (`b4rrhh/backend#109`).
     *
     * Si esto se cruzara, el folio volvería a enseñar `SALARIO_BASE` donde va un nombre — que es
     * el defecto de partida, y se vería aquí antes que en la pantalla.
     */
    it('el mnemónico y el literal no se cruzan, y la sección declarada llega entera', () => {
      const model = mapPayrollConceptResponseToModel({
        lineNumber: 1,
        conceptCode: '720',
        conceptMnemonic: 'SS_CC_EMPRESARIO',
        conceptLabel: 'Contingencias comunes (aportación empresarial)',
        amount: 300,
        conceptNatureCode: 'INFORMATIONAL',
        displayOrder: 720,
        mergedStepCount: 1,
        payslipSectionCode: 'APORTACION_EMPRESARIAL',
      });

      expect(model.conceptMnemonic).toBe('SS_CC_EMPRESARIO');
      expect(model.conceptLabel).toBe('Contingencias comunes (aportación empresarial)');
      expect(model.payslipSectionCode).toBe('APORTACION_EMPRESARIAL');
    });

    /**
     * Un recibo servido por un backend anterior al `b4rrhh/backend#109`.
     *
     * No trae mnemónico ni sección, y las dos ausencias significan algo distinto: lo que hay en
     * el literal **es** el mnemónico —era el único sitio donde estaba— y la línea no tiene bloque.
     */
    it('de un backend anterior, el literal ES el mnemónico y la línea no tiene bloque', () => {
      const model = mapPayrollConceptResponseToModel({
        lineNumber: 1,
        conceptCode: '101',
        conceptLabel: 'SALARIO_BASE',
        amount: 1000,
        conceptNatureCode: 'EARNING',
        displayOrder: 101,
        mergedStepCount: 1,
      } as PayrollConceptResponse);

      expect(model.conceptMnemonic).toBe('SALARIO_BASE');
      expect(model.payslipSectionCode).toBeNull();
    });

    it('maps numeric values when present', () => {
      const response: PayrollConceptResponse = {
        lineNumber: 1,
        conceptCode: '001',
        conceptMnemonic: 'SALARIO_BASE',
        conceptLabel: 'Salario base',
        amount: 2100,
        quantity: 30,
        rate: 70,
        conceptNatureCode: 'EARNING',
        originPeriodCode: '202604',
        displayOrder: 10,
        mergedStepCount: 1,
        payslipSectionCode: 'DEVENGOS',
      };

      const model = mapPayrollConceptResponseToModel(response);

      expect(model.amount).toBe(2100);
      expect(model.quantity).toBe(30);
      expect(model.rate).toBe(70);
    });
  });
});
