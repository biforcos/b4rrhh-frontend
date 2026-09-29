import { describe, expect, it } from 'vitest';

import {
  compareByTimelineRecency,
  periodStanding,
  sortByTimelineRecency,
} from './period-order.util';

interface PeriodFixture {
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string | null;
}

const olderClosed: PeriodFixture = {
  name: 'older-closed',
  startDate: '2025-12-10',
  endDate: '2026-01-31',
};
const newerClosed: PeriodFixture = {
  name: 'newer-closed',
  startDate: '2026-02-01',
  endDate: '2026-04-26',
};
const active: PeriodFixture = { name: 'active', startDate: '2026-04-27', endDate: null };

describe('sortByTimelineRecency', () => {
  it('puts the active period first and then the rest by start date descending', () => {
    const sorted = sortByTimelineRecency([olderClosed, active, newerClosed]);

    expect(sorted.map((period) => period.name)).toEqual(['active', 'newer-closed', 'older-closed']);
  });

  it('keeps the active period on top even when a closed one starts later', () => {
    // No es «por fecha»: es «lo que importa ahora, arriba».
    const activeButOlder: PeriodFixture = {
      name: 'active-older',
      startDate: '2024-01-01',
      endDate: null,
    };

    const sorted = sortByTimelineRecency([newerClosed, activeButOlder, olderClosed]);

    expect(sorted.map((period) => period.name)).toEqual([
      'active-older',
      'newer-closed',
      'older-closed',
    ]);
  });

  it('does not mutate the input', () => {
    const input = [olderClosed, active, newerClosed];

    sortByTimelineRecency(input);

    expect(input.map((period) => period.name)).toEqual(['older-closed', 'active', 'newer-closed']);
  });

  it('leaves ties to the tie breaker of the vertical', () => {
    const first = { ...newerClosed, name: 'a' };
    const second = { ...newerClosed, name: 'b' };

    const sorted = sortByTimelineRecency([first, second], (left, right) =>
      right.name.localeCompare(left.name),
    );

    expect(sorted.map((period) => period.name)).toEqual(['b', 'a']);
  });
});

describe('compareByTimelineRecency', () => {
  it('returns zero for a tie without a tie breaker', () => {
    expect(compareByTimelineRecency(newerClosed, { ...newerClosed })).toBe(0);
  });
});

/**
 * Vigente, prevista o cerrada, contado respecto a hoy y no a si tiene fin (`b4rrhh/frontend#110`).
 *
 * Una presencia que empieza el mes que viene no tiene fin, y la tabla la daba por «Vigente» a un
 * palmo de una cabecera que decía «readmisión el 08/10». Prevista no es vigente.
 */
describe('periodStanding', () => {
  const HOY = '2026-09-29';

  it('un período que empieza después de hoy está previsto, tenga fin o no', () => {
    expect(periodStanding({ startDate: '2026-10-08', endDate: null }, HOY)).toBe('PLANNED');
    expect(periodStanding({ startDate: '2026-10-08', endDate: '2026-12-31' }, HOY)).toBe('PLANNED');
  });

  it('el que empezó y no ha acabado está en vigor, aunque tenga fin (frontend#100)', () => {
    expect(periodStanding({ startDate: '2026-01-01', endDate: null }, HOY)).toBe('IN_FORCE');
    expect(periodStanding({ startDate: '2026-01-01', endDate: '2026-09-30' }, HOY)).toBe(
      'IN_FORCE',
    );
    expect(periodStanding({ startDate: HOY, endDate: HOY }, HOY)).toBe('IN_FORCE');
  });

  it('el que acabó antes de hoy está cerrado', () => {
    expect(periodStanding({ startDate: '2025-01-01', endDate: '2026-09-28' }, HOY)).toBe('CLOSED');
  });
});

describe('el orden con lo previsto', () => {
  const HOY = '2026-09-29';

  it('vigente, luego prevista, luego cerradas por inicio descendente', () => {
    const periods = [
      { name: 'cerrada-vieja', startDate: '2024-01-01', endDate: '2024-12-31' },
      { name: 'prevista', startDate: '2026-10-08', endDate: null },
      { name: 'cerrada-nueva', startDate: '2025-01-01', endDate: '2026-09-15' },
      { name: 'vigente', startDate: '2026-09-16', endDate: '2026-10-07' },
    ];

    expect(sortByTimelineRecency(periods, undefined, HOY).map((p) => p.name)).toEqual([
      'vigente',
      'prevista',
      'cerrada-nueva',
      'cerrada-vieja',
    ]);
  });
});
