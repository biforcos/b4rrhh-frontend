import { describe, expect, it } from 'vitest';

import { isRunFinished, runDurationMs, unitsWithoutPayslip } from './calculation-run.model';
import type { CalculationRun } from './calculation-run.model';

const base: CalculationRun = {
  runId: 1,
  status: 'COMPLETED',
  ruleSystemCode: 'ESP',
  payrollPeriodCode: '202604',
  payrollTypeCode: 'NORMAL',
  calculationEngineCode: 'GRAPH',
  calculationEngineVersion: '1.0',
  totalCandidates: 0,
  totalEligible: 0,
  totalClaimed: 0,
  totalSkippedNotEligible: 0,
  totalSkippedAlreadyClaimed: 0,
  totalCalculated: 0,
  totalNotValid: 0,
  totalErrors: 0,
  requestedAt: '2026-04-29T08:00:00',
  startedAt: null,
  finishedAt: null,
};

describe('isRunFinished', () => {
  it('returns true for COMPLETED', () =>
    expect(isRunFinished({ ...base, status: 'COMPLETED' })).toBe(true));
  it('returns true for COMPLETED_WITH_ERRORS', () =>
    expect(isRunFinished({ ...base, status: 'COMPLETED_WITH_ERRORS' })).toBe(true));
  it('returns true for FAILED', () =>
    expect(isRunFinished({ ...base, status: 'FAILED' })).toBe(true));
  it('returns false for RUNNING', () =>
    expect(isRunFinished({ ...base, status: 'RUNNING' })).toBe(false));
  it('returns false for REQUESTED', () =>
    expect(isRunFinished({ ...base, status: 'REQUESTED' })).toBe(false));
});

describe('unitsWithoutPayslip', () => {
  it('cuenta las cuatro clases de unidad que no acaba en recibo', () =>
    expect(
      unitsWithoutPayslip({
        ...base,
        totalSkippedNotEligible: 2,
        totalSkippedAlreadyClaimed: 1,
        totalNotValid: 3,
        totalErrors: 4,
      }),
    ).toBe(10));

  it('no mira el estado: COMPLETED con unidades saltadas no es cero', () => {
    // La corrida del deploy#3: status COMPLETED, 873 candidatas, 871 calculadas, 2 saltadas.
    const run = {
      ...base,
      status: 'COMPLETED' as const,
      totalCandidates: 873,
      totalCalculated: 871,
      totalSkippedNotEligible: 2,
    };

    expect(isRunFinished(run)).toBe(true);
    expect(unitsWithoutPayslip(run)).toBe(2);
  });

  it('es cero cuando todas acabaron en recibo', () =>
    expect(unitsWithoutPayslip({ ...base, totalCandidates: 5, totalCalculated: 5 })).toBe(0));
});

describe('runDurationMs', () => {
  it('mide entre el arranque y el cierre', () =>
    expect(
      runDurationMs({
        ...base,
        startedAt: '2026-04-29T08:00:00',
        finishedAt: '2026-04-29T08:05:30',
      }),
    ).toBe(330_000));

  it('sin cierre no hay duracion', () =>
    expect(
      runDurationMs({ ...base, startedAt: '2026-04-29T08:00:00', finishedAt: null }),
    ).toBeNull());

  it('sin arranque tampoco', () =>
    expect(
      runDurationMs({ ...base, startedAt: null, finishedAt: '2026-04-29T08:05:30' }),
    ).toBeNull());
});
