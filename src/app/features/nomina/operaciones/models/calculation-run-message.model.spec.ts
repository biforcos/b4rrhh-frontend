import { describe, expect, it } from 'vitest';

import {
  messageDestinationSection,
  messageNeedsAttention,
  messageUnit,
} from './calculation-run-message.model';
import type { CalculationRunMessage } from './calculation-run-message.model';

const executed: CalculationRunMessage = {
  messageCode: 'UNIT_ELIGIBLE_REAL_EXECUTED',
  messageCodeName: 'Calculada',
  severityCode: 'INFO',
  message: 'Eligible real execution completed for payroll unit',
  detailsJson: null,
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000298',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 1,
  createdAt: '2026-09-07T14:50:10',
};

// Tal cual lo escribio la ejecucion 1 de la corrida del deploy#3 para EMP000298.
const skipped: CalculationRunMessage = {
  ...executed,
  messageCode: 'UNIT_ELIGIBLE_REAL_SKIPPED_MISSING_INPUT',
  messageCodeName: 'Sin calcular: faltaban datos',
  severityCode: 'WARNING',
  message:
    'Eligible real execution skipped: agreementCode is required but missing in launcher context',
  detailsJson: '{"reasonCode": "AGREEMENT_CODE_MISSING", "executionMode": "ELIGIBLE_REAL"}',
};

describe('messageUnit', () => {
  it('nombra la unidad con los tres codigos de la clave y la presencia', () =>
    expect(messageUnit(skipped)).toEqual({
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP000298',
      presenceNumber: 1,
    }));

  it('sin clave completa no hay unidad, y no se inventa', () => {
    for (const missing of [
      { ruleSystemCode: null },
      { employeeTypeCode: null },
      { employeeNumber: null },
    ]) {
      expect(messageUnit({ ...skipped, ...missing })).toBeNull();
    }
  });

  it('un mensaje de toda la ejecucion no tiene unidad', () =>
    expect(
      messageUnit({
        ...skipped,
        ruleSystemCode: null,
        employeeTypeCode: null,
        employeeNumber: null,
        presenceNumber: null,
      }),
    ).toBeNull());
});

describe('messageDestinationSection', () => {
  it('si la unidad acabo en recibo, lleva a su nomina', () =>
    expect(messageDestinationSection(executed)).toBe('payroll'));

  it('si no, lleva a la relacion laboral, que es donde se arregla lo que faltaba', () =>
    expect(messageDestinationSection(skipped)).toBe('relacion'));
});

describe('messageNeedsAttention', () => {
  it('la unidad ejecutada no pide nada', () => expect(messageNeedsAttention(executed)).toBe(false));

  it('la saltada si', () => expect(messageNeedsAttention(skipped)).toBe(true));

  it('cualquier codigo que no sea el de ejecutada pide algo', () => {
    for (const code of [
      'UNIT_NOT_ELIGIBLE',
      'UNIT_ALREADY_CLAIMED',
      'UNIT_CALCULATION_ERROR',
      'CODIGO_QUE_TODAVIA_NO_EXISTE',
    ]) {
      expect(messageNeedsAttention({ ...executed, messageCode: code })).toBe(true);
    }
  });
});
