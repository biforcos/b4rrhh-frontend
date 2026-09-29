import { describe, expect, it } from 'vitest';

import { inForceOn, rulesOn } from './in-force.util';

/** «Rige en fecha» (`b4rrhh/frontend#100`): inicio ≤ fecha ≤ fin, y no «no tiene fin». */
describe('rulesOn', () => {
  const ceasedOnThe30th = { startDate: '2025-10-16', endDate: '2026-09-30' };

  it('una presencia que acaba el 30 rige el 29', () =>
    expect(rulesOn(ceasedOnThe30th, '2026-09-29')).toBe(true));

  it('y el 30, que es su último día', () =>
    expect(rulesOn(ceasedOnThe30th, '2026-09-30')).toBe(true));

  it('el 1 ya no', () => expect(rulesOn(ceasedOnThe30th, '2026-10-01')).toBe(false));

  it('antes de empezar tampoco', () => expect(rulesOn(ceasedOnThe30th, '2025-10-15')).toBe(false));

  it('sin fin rige desde que empieza', () =>
    expect(rulesOn({ startDate: '2025-10-16', endDate: null }, '2030-01-01')).toBe(true));
});

describe('inForceOn', () => {
  const series = [
    { id: 'a', startDate: '2024-01-01', endDate: '2024-12-31' },
    { id: 'b', startDate: '2025-01-01', endDate: '2026-09-30' },
    { id: 'c', startDate: '2026-10-01', endDate: null },
  ];

  it('da la que rige ese día, tenga fin o no', () => {
    expect(inForceOn(series, '2026-09-29')?.id).toBe('b');
    expect(inForceOn(series, '2026-10-01')?.id).toBe('c');
  });

  it('nada si no rige ninguna', () =>
    expect(inForceOn(series.slice(0, 2), '2026-10-01')).toBeNull());
});
