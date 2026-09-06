import {
  mapEmployeeLaborClassificationConflict,
  mapEmployeeLaborClassificationErrorCode,
} from './employee-labor-classification.error.mapper';

describe('mapEmployeeLaborClassificationErrorCode', () => {
  it('recognizes LABOR_CLASSIFICATION_OVERLAP from nested error.code', () => {
    expect(
      mapEmployeeLaborClassificationErrorCode({ error: { code: 'LABOR_CLASSIFICATION_OVERLAP' } }),
    ).toBe('LABOR_CLASSIFICATION_OVERLAP');
  });

  it('normalizes code to uppercase before matching', () => {
    expect(
      mapEmployeeLaborClassificationErrorCode({ error: { code: 'labor_classification_overlap' } }),
    ).toBe('LABOR_CLASSIFICATION_OVERLAP');
  });

  it('recognizes all known functional error codes', () => {
    const knownCodes = [
      'LABOR_CLASSIFICATION_OVERLAP',
      'LABOR_CLASSIFICATION_OUTSIDE_PRESENCE',
      'LABOR_CLASSIFICATION_INCOMPLETE_COVERAGE',
      'LABOR_CLASSIFICATION_IS_A_CORRECTION',
      'LABOR_CLASSIFICATION_INVALID_PERIOD',
      'LABOR_CLASSIFICATION_ALREADY_CLOSED',
      'LABOR_CLASSIFICATION_NOT_FOUND',
      'AGREEMENT_NOT_FOUND',
      'AGREEMENT_CATEGORY_NOT_FOUND',
      'AGREEMENT_CATEGORY_RELATION_INVALID',
    ];
    for (const code of knownCodes) {
      expect(mapEmployeeLaborClassificationErrorCode({ error: { code } })).toBe(code);
    }
  });

  it('returns request-failed for an unknown code', () => {
    expect(mapEmployeeLaborClassificationErrorCode({ error: { code: 'UNKNOWN_ERROR' } })).toBe(
      'request-failed',
    );
  });

  it('returns request-failed when error is null', () => {
    expect(mapEmployeeLaborClassificationErrorCode(null)).toBe('request-failed');
  });

  it('returns request-failed when error.code is not a string', () => {
    expect(mapEmployeeLaborClassificationErrorCode({ error: { code: 42 } })).toBe('request-failed');
  });
});

describe('mapEmployeeLaborClassificationConflict', () => {
  it('keeps the gap and the neighbour the user could stretch', () => {
    const error = {
      error: {
        code: 'LABOR_CLASSIFICATION_INCOMPLETE_COVERAGE',
        details: {
          gaps: [{ startDate: '2026-02-01', endDate: '2026-02-28' }],
          stretchCandidates: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
        },
      },
    };

    expect(mapEmployeeLaborClassificationConflict(error)).toEqual({
      overlaps: [],
      gaps: [{ startDate: '2026-02-01', endDate: '2026-02-28' }],
      stretchCandidates: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
      correctedOccurrence: null,
    });
  });

  it('keeps the occurrence the add would correct', () => {
    const error = {
      error: {
        code: 'LABOR_CLASSIFICATION_IS_A_CORRECTION',
        details: { correctedOccurrence: { startDate: '2026-03-01' } },
      },
    };

    expect(mapEmployeeLaborClassificationConflict(error).correctedOccurrence).toEqual({
      startDate: '2026-03-01',
      endDate: null,
    });
  });

  it('comes back empty when the error names nothing', () => {
    expect(
      mapEmployeeLaborClassificationConflict({ error: { code: 'AGREEMENT_NOT_FOUND' } }),
    ).toEqual({
      overlaps: [],
      gaps: [],
      stretchCandidates: [],
      correctedOccurrence: null,
    });
  });
});
