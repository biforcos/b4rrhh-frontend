import { buildWorkingTimePreview, formatWorkingTimeHours } from './working-time-preview.util';

describe('working-time-preview.util', () => {
  it('builds a read-only preview from the percentage', () => {
    expect(buildWorkingTimePreview(75)).toEqual({
      weeklyHours: 30,
      dailyHours: 6,
      monthlyHours: 125,
    });
  });

  it('returns null when the percentage is outside the accepted range', () => {
    expect(buildWorkingTimePreview(null)).toBeNull();
    expect(buildWorkingTimePreview(0)).toBeNull();
    expect(buildWorkingTimePreview(101)).toBeNull();
  });

  it('formats hour values for Spanish locale display', () => {
    expect(formatWorkingTimeHours(133.34)).toBe('133,34');
  });
});
