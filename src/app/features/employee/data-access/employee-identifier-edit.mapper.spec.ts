import {
  mapEmployeeIdentifierApiToSlotRow,
  mapEmployeeIdentifierModelToSlotRow,
} from './employee-identifier-edit.mapper';

describe('employee-identifier-edit.mapper', () => {
  it('renders Name · CODE and keeps existing secondary segments', () => {
    const row = mapEmployeeIdentifierApiToSlotRow(
      {
        identifierTypeCode: 'NIF',
        identifierTypeName: 'Documento nacional',
        identifierValue: '12345678A',
        issuingCountryCode: 'ESP',
        expirationDate: '2030-12-31',
        isPrimary: true,
      },
      {
        primaryBadge: 'Principal',
        expirationPrefix: 'Expira',
      },
    );

    expect(row.keyLabel).toBe('Documento nacional');
    expect(row.secondaryText).toBe('NIF · ESP · Expira: 31/12/2030');
    expect(row.badges).toEqual(['Principal']);
  });

  it('falls back to code when identifierTypeName is missing', () => {
    const row = mapEmployeeIdentifierApiToSlotRow({
      identifierTypeCode: 'PASSPORT',
      identifierTypeName: null,
      identifierValue: 'XK000001',
      issuingCountryCode: null,
      expirationDate: null,
      isPrimary: false,
    });

    expect(row.keyLabel).toBe('PASSPORT');
    expect(row.secondaryText).toBeNull();
  });

  it('maps model rows with the same catalog display behavior', () => {
    const row = mapEmployeeIdentifierModelToSlotRow(
      {
        typeCode: 'NIE',
        typeName: 'Identificador extranjero',
        value: 'Y1234567X',
        issuingCountryCode: 'ESP',
        expirationDate: null,
        isPrimary: false,
      },
      {
        primaryBadge: 'Principal',
        expirationPrefix: 'Expira',
      },
    );

    expect(row.key).toBe('NIE');
    expect(row.keyLabel).toBe('Identificador extranjero');
    expect(row.secondaryText).toBe('NIE · ESP');
  });
});
