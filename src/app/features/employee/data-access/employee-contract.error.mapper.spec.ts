import {
  mapEmployeeContractConflict,
  mapEmployeeContractErrorCode,
} from './employee-contract.error.mapper';

describe('mapEmployeeContractErrorCode', () => {
  it('extracts a functional code from the nested error object', () => {
    const error = { error: { code: 'CONTRACT_OVERLAP', message: 'Se solapa' } };
    expect(mapEmployeeContractErrorCode(error)).toBe('CONTRACT_OVERLAP');
  });

  it('extracts a functional code from a flat error object', () => {
    expect(mapEmployeeContractErrorCode({ code: 'CONTRACT_NOT_FOUND' })).toBe('CONTRACT_NOT_FOUND');
  });

  it('reads the code the add of a coinciding start date comes back with', () => {
    const error = { error: { code: 'CONTRACT_IS_A_CORRECTION' } };
    expect(mapEmployeeContractErrorCode(error)).toBe('CONTRACT_IS_A_CORRECTION');
  });

  it('returns request-failed for a code the contract does not enumerate', () => {
    expect(mapEmployeeContractErrorCode({ error: { code: 'SOMETHING_ELSE' } })).toBe(
      'request-failed',
    );
  });

  it('returns request-failed when the error carries no code', () => {
    expect(mapEmployeeContractErrorCode({})).toBe('request-failed');
    expect(mapEmployeeContractErrorCode(null)).toBe('request-failed');
    expect(mapEmployeeContractErrorCode('something went wrong')).toBe('request-failed');
  });
});

describe('mapEmployeeContractConflict', () => {
  it('keeps the gap and the neighbour the user could stretch', () => {
    const error = {
      error: {
        code: 'CONTRACT_COVERAGE_GAP',
        details: {
          gaps: [{ startDate: '2026-02-01', endDate: '2026-02-28' }],
          stretchCandidates: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
        },
      },
    };

    expect(mapEmployeeContractConflict(error)).toEqual({
      overlaps: [],
      gaps: [{ startDate: '2026-02-01', endDate: '2026-02-28' }],
      stretchCandidates: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
      correctedOccurrence: null,
    });
  });

  it('keeps the contract the add would correct', () => {
    const error = {
      error: {
        code: 'CONTRACT_IS_A_CORRECTION',
        details: { correctedOccurrence: { startDate: '2026-03-01' } },
      },
    };

    expect(mapEmployeeContractConflict(error).correctedOccurrence).toEqual({
      startDate: '2026-03-01',
      endDate: null,
    });
  });

  it('comes back empty when the error names nothing', () => {
    expect(mapEmployeeContractConflict({ error: { code: 'CONTRACT_NOT_FOUND' } })).toEqual({
      overlaps: [],
      gaps: [],
      stretchCandidates: [],
      correctedOccurrence: null,
    });
  });
});
