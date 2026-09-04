import { describe, expect, it } from 'vitest';

import {
  formatDisplayDate,
  formatLongDisplayDate,
  formatLongDisplayDateRange,
  parseLocalDate,
} from './local-date.util';

describe('formatDisplayDate', () => {
  it('formats an ISO date as dd/MM/yyyy', () => {
    expect(formatDisplayDate('2025-12-10')).toBe('10/12/2025');
  });

  it('pads day and month with zeros', () => {
    expect(formatDisplayDate('2026-01-05')).toBe('05/01/2026');
  });

  it('formats a Date instance', () => {
    expect(formatDisplayDate(new Date(2026, 2, 31))).toBe('31/03/2026');
  });

  it('returns the raw value when it is not an ISO date', () => {
    expect(formatDisplayDate('pending')).toBe('pending');
  });

  it('returns an empty string for null or undefined', () => {
    expect(formatDisplayDate(null)).toBe('');
    expect(formatDisplayDate(undefined)).toBe('');
  });

  it('round-trips with parseLocalDate', () => {
    expect(formatDisplayDate(parseLocalDate('2024-02-29'))).toBe('29/02/2024');
  });
});

describe('formatLongDisplayDate', () => {
  it('writes the month in Spanish', () => {
    expect(formatLongDisplayDate('2025-12-10')).toBe('10 de diciembre de 2025');
  });
});

describe('formatLongDisplayDateRange', () => {
  it('collapses a range within one month', () => {
    expect(formatLongDisplayDateRange('2026-03-03', '2026-03-07')).toBe(
      'del 3 al 7 de marzo de 2026',
    );
  });

  it('repeats the month across months of the same year', () => {
    expect(formatLongDisplayDateRange('2026-02-28', '2026-03-03')).toBe(
      'del 28 de febrero al 3 de marzo de 2026',
    );
  });

  it('writes both dates in full across years', () => {
    expect(formatLongDisplayDateRange('2025-12-30', '2026-01-02')).toBe(
      'del 30 de diciembre de 2025 al 2 de enero de 2026',
    );
  });

  it('names a single day when start and end coincide', () => {
    expect(formatLongDisplayDateRange('2026-03-03', '2026-03-03')).toBe('el 3 de marzo de 2026');
  });

  it('says onwards when there is no end', () => {
    expect(formatLongDisplayDateRange('2026-03-16', null)).toBe(
      'desde el 16 de marzo de 2026 en adelante',
    );
  });
});
