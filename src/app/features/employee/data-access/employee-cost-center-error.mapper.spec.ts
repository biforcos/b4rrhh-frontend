import { mapEmployeeCostCenterErrorCode } from './employee-cost-center-error.mapper';

describe('mapEmployeeCostCenterErrorCode', () => {
  it('recognizes COST_CENTER_OVERLAP from direct code property', () => {
    expect(mapEmployeeCostCenterErrorCode({ code: 'COST_CENTER_OVERLAP' })).toBe(
      'COST_CENTER_OVERLAP',
    );
  });

  it('recognizes COST_CENTER_OUTSIDE_PRESENCE from nested error.code', () => {
    expect(
      mapEmployeeCostCenterErrorCode({ error: { code: 'COST_CENTER_OUTSIDE_PRESENCE' } }),
    ).toBe('COST_CENTER_OUTSIDE_PRESENCE');
  });

  it('recognizes all known functional error codes', () => {
    const knownCodes = [
      'COST_CENTER_INVALID_WINDOW',
      'COST_CENTER_OVERLAP',
      'COST_CENTER_COVERAGE_GAP',
      'COST_CENTER_OUTSIDE_PRESENCE',
      'COST_CENTER_IS_A_CORRECTION',
      'COST_CENTER_CATALOG_NOT_FOUND',
      'COST_CENTER_DISTRIBUTION_NOT_FOUND',
      'COST_CENTER_DISTRIBUTION_ALREADY_CLOSED',
      'COST_CENTER_REPLACE_NO_ACTIVE_WINDOW',
      'COST_CENTER_CLOSE_IMPOSSIBLE_START_DATE',
    ];
    for (const code of knownCodes) {
      expect(mapEmployeeCostCenterErrorCode({ code })).toBe(code);
    }
  });

  it('returns request-failed for an unknown code', () => {
    expect(mapEmployeeCostCenterErrorCode({ code: 'SOMETHING_ELSE' })).toBe('request-failed');
  });

  it('returns request-failed when error is null', () => {
    expect(mapEmployeeCostCenterErrorCode(null)).toBe('request-failed');
  });

  it('returns request-failed when error is a plain string', () => {
    expect(mapEmployeeCostCenterErrorCode('oops')).toBe('request-failed');
  });
});
