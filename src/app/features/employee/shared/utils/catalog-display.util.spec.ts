import { getCatalogDisplay } from './catalog-display.util';

describe('getCatalogDisplay', () => {
  it('returns name as label and code as secondary when name is present', () => {
    expect(getCatalogDisplay('Technical Agreement', 'AGR_TECH')).toEqual({
      label: 'Technical Agreement',
      code: 'AGR_TECH',
    });
  });

  it('returns code as label and undefined secondary when name is null', () => {
    expect(getCatalogDisplay(null, 'AGR_TECH')).toEqual({
      label: 'AGR_TECH',
    });
  });

  it('treats empty name as missing and returns code only', () => {
    expect(getCatalogDisplay('   ', 'AGR_TECH')).toEqual({
      label: 'AGR_TECH',
    });
  });
});
