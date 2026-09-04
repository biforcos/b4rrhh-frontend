import {
  mapEmployeeWorkingTimeConflict,
  mapEmployeeWorkingTimeErrorCode,
} from './employee-working-time-error.mapper';

describe('mapEmployeeWorkingTimeErrorCode', () => {
  it('recognizes WORKING_TIME_OVERLAP from direct code property', () => {
    expect(mapEmployeeWorkingTimeErrorCode({ code: 'WORKING_TIME_OVERLAP' })).toBe(
      'WORKING_TIME_OVERLAP',
    );
  });

  it('recognizes WORKING_TIME_NOT_FOUND from nested error.code', () => {
    expect(mapEmployeeWorkingTimeErrorCode({ error: { code: 'WORKING_TIME_NOT_FOUND' } })).toBe(
      'WORKING_TIME_NOT_FOUND',
    );
  });

  it('recognizes all known functional error codes', () => {
    const knownCodes = [
      'WORKING_TIME_NOT_FOUND',
      'WORKING_TIME_INVALID_PERCENTAGE',
      'WORKING_TIME_INVALID_PERIOD',
      'WORKING_TIME_OVERLAP',
      'WORKING_TIME_COVERAGE_GAP',
      'WORKING_TIME_OUTSIDE_PRESENCE',
      'WORKING_TIME_NUMBER_CONFLICT',
      'WORKING_TIME_ALREADY_CLOSED',
    ];
    for (const code of knownCodes) {
      expect(mapEmployeeWorkingTimeErrorCode({ code })).toBe(code);
    }
  });

  describe('mapEmployeeWorkingTimeConflict', () => {
    it('reads the gaps and the neighbours to stretch from the 409 body', () => {
      const conflict = mapEmployeeWorkingTimeConflict({
        status: 409,
        error: {
          code: 'WORKING_TIME_COVERAGE_GAP',
          details: {
            gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
            stretchCandidates: [
              { workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
              { workingTimeNumber: 3, startDate: '2026-03-08', endDate: null },
            ],
          },
        },
      });

      expect(conflict).toEqual({
        overlaps: [],
        gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
        stretchCandidates: [
          { workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
          { workingTimeNumber: 3, startDate: '2026-03-08', endDate: null },
        ],
      });
    });

    it('reads the overlaps and leaves the rest empty', () => {
      const conflict = mapEmployeeWorkingTimeConflict({
        error: {
          code: 'WORKING_TIME_OVERLAP',
          details: { overlaps: [{ startDate: '2026-03-10', endDate: null }] },
        },
      });

      expect(conflict).toEqual({
        overlaps: [{ startDate: '2026-03-10', endDate: null }],
        gaps: [],
        stretchCandidates: [],
      });
    });

    it('is empty when the error carries no details', () => {
      expect(mapEmployeeWorkingTimeConflict({ error: { code: 'WORKING_TIME_OVERLAP' } })).toEqual({
        overlaps: [],
        gaps: [],
        stretchCandidates: [],
      });
      expect(mapEmployeeWorkingTimeConflict(null)).toEqual({
        overlaps: [],
        gaps: [],
        stretchCandidates: [],
      });
    });
  });

  it('returns request-failed for an unknown code', () => {
    expect(mapEmployeeWorkingTimeErrorCode({ code: 'UNKNOWN' })).toBe('request-failed');
  });

  it('returns request-failed when error is null', () => {
    expect(mapEmployeeWorkingTimeErrorCode(null)).toBe('request-failed');
  });
});
