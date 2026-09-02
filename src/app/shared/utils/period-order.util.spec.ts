import { describe, expect, it } from 'vitest';

import { compareByTimelineRecency, sortByTimelineRecency } from './period-order.util';

interface PeriodFixture {
  readonly name: string;
  readonly startDate: string;
  readonly isActive: boolean;
}

const olderClosed: PeriodFixture = {
  name: 'older-closed',
  startDate: '2025-12-10',
  isActive: false,
};
const newerClosed: PeriodFixture = {
  name: 'newer-closed',
  startDate: '2026-02-01',
  isActive: false,
};
const active: PeriodFixture = { name: 'active', startDate: '2026-04-27', isActive: true };

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
      isActive: true,
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
