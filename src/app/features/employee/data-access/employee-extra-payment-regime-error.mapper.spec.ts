import {
  mapEmployeeExtraPaymentRegimeConflict,
  mapEmployeeExtraPaymentRegimeErrorCode,
} from './employee-extra-payment-regime-error.mapper';

describe('mapEmployeeExtraPaymentRegimeErrorCode', () => {
  it('recognizes EXTRA_PAYMENT_REGIME_OVERLAP from direct code property', () => {
    expect(mapEmployeeExtraPaymentRegimeErrorCode({ code: 'EXTRA_PAYMENT_REGIME_OVERLAP' })).toBe(
      'EXTRA_PAYMENT_REGIME_OVERLAP',
    );
  });

  it('recognizes EXTRA_PAYMENT_REGIME_NOT_FOUND from nested error.code', () => {
    expect(
      mapEmployeeExtraPaymentRegimeErrorCode({ error: { code: 'EXTRA_PAYMENT_REGIME_NOT_FOUND' } }),
    ).toBe('EXTRA_PAYMENT_REGIME_NOT_FOUND');
  });

  it('recognizes all known functional error codes', () => {
    const knownCodes = [
      'EXTRA_PAYMENT_REGIME_NOT_FOUND',
      'EXTRA_PAYMENT_REGIME_INVALID_PERCENTAGE',
      'EXTRA_PAYMENT_REGIME_INVALID_PERIOD',
      'EXTRA_PAYMENT_REGIME_OVERLAP',
      'EXTRA_PAYMENT_REGIME_COVERAGE_GAP',
      'EXTRA_PAYMENT_REGIME_OUTSIDE_PRESENCE',
      'EXTRA_PAYMENT_REGIME_NUMBER_CONFLICT',
      'EXTRA_PAYMENT_REGIME_ALREADY_CLOSED',
    ];
    for (const code of knownCodes) {
      expect(mapEmployeeExtraPaymentRegimeErrorCode({ code })).toBe(code);
    }
  });

  describe('mapEmployeeExtraPaymentRegimeConflict', () => {
    it('reads the gaps and the neighbours to stretch from the 409 body', () => {
      const conflict = mapEmployeeExtraPaymentRegimeConflict({
        status: 409,
        error: {
          code: 'EXTRA_PAYMENT_REGIME_COVERAGE_GAP',
          details: {
            gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
            stretchCandidates: [
              { extraPaymentRegimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
              { extraPaymentRegimeNumber: 3, startDate: '2026-03-08', endDate: null },
            ],
          },
        },
      });

      expect(conflict).toEqual({
        overlaps: [],
        gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
        stretchCandidates: [
          { extraPaymentRegimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
          { extraPaymentRegimeNumber: 3, startDate: '2026-03-08', endDate: null },
        ],
        correctedOccurrence: null,
      });
    });

    it('reads the overlaps and leaves the rest empty', () => {
      const conflict = mapEmployeeExtraPaymentRegimeConflict({
        error: {
          code: 'EXTRA_PAYMENT_REGIME_OVERLAP',
          details: { overlaps: [{ startDate: '2026-03-10', endDate: null }] },
        },
      });

      expect(conflict).toEqual({
        overlaps: [{ startDate: '2026-03-10', endDate: null }],
        gaps: [],
        stretchCandidates: [],
        correctedOccurrence: null,
      });
    });

    it('is empty when the error carries no details', () => {
      expect(
        mapEmployeeExtraPaymentRegimeConflict({ error: { code: 'EXTRA_PAYMENT_REGIME_OVERLAP' } }),
      ).toEqual({
        overlaps: [],
        gaps: [],
        stretchCandidates: [],
        correctedOccurrence: null,
      });
      expect(mapEmployeeExtraPaymentRegimeConflict(null)).toEqual({
        overlaps: [],
        gaps: [],
        stretchCandidates: [],
        correctedOccurrence: null,
      });
    });
  });

  it('returns request-failed for an unknown code', () => {
    expect(mapEmployeeExtraPaymentRegimeErrorCode({ code: 'UNKNOWN' })).toBe('request-failed');
  });

  it('returns request-failed when error is null', () => {
    expect(mapEmployeeExtraPaymentRegimeErrorCode(null)).toBe('request-failed');
  });
});
