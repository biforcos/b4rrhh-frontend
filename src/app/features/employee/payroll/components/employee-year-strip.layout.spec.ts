import { describe, expect, it } from 'vitest';

import { EmployeeYearAbsence } from '../../models/employee-year.model';
import { layoutAbsenceBars, monthsWithPresence, periodOfBar } from './employee-year-strip.layout';

/**
 * La geometría de la tira (`b4rrhh/frontend#109`): dónde cae cada barra en el año, en qué carril
 * va cuando se solapa y qué meses sombrea la presencia. Aparte del componente para poder
 * afirmarla sin maquetar.
 */
describe('la geometría de la tira del año', () => {
  const baja = (
    startDate: string,
    endDate: string | null,
    tipo = 'IT_COMMON',
  ): EmployeeYearAbsence => ({
    absenceTypeCode: tipo,
    startDate,
    endDate,
  });

  it('una baja que cruza de mes es una sola barra, del primer día al último', () => {
    const [barra] = layoutAbsenceBars([baja('2026-03-28', '2026-04-04')], 2026, '2026-09-29');

    // 2026 no es bisiesto: el 28 de marzo es el día 87 y la barra dura 8 días.
    expect(barra.left).toBeCloseTo((86 / 365) * 100, 5);
    expect(barra.width).toBeCloseTo((8 / 365) * 100, 5);
    expect(barra.startsBeforeYear).toBe(false);
    expect(barra.endsAfterYear).toBe(false);
    expect(barra.open).toBe(false);
  });

  it('la que viene del año anterior empieza en el borde y lo dice', () => {
    const [barra] = layoutAbsenceBars([baja('2025-12-20', '2026-01-10')], 2026, '2026-09-29');

    expect(barra.left).toBe(0);
    expect(barra.width).toBeCloseTo((10 / 365) * 100, 5);
    expect(barra.startsBeforeYear).toBe(true);
    // Y sigue siendo la baja entera: sus fechas no se recortan.
    expect(barra.absence.startDate).toBe('2025-12-20');
  });

  it('una abierta llega hasta hoy, con el borde abierto', () => {
    const [barra] = layoutAbsenceBars([baja('2026-09-01', null)], 2026, '2026-09-29');

    expect(barra.open).toBe(true);
    expect(barra.width).toBeCloseTo((29 / 365) * 100, 5);
  });

  it('dos solapadas van una debajo de otra; las que no se tocan comparten carril', () => {
    const barras = layoutAbsenceBars(
      [
        baja('2026-07-01', '2026-07-20', 'VACATION'),
        baja('2026-07-10', '2026-07-12', 'IT_COMMON'),
        baja('2026-08-02', '2026-08-16', 'VACATION'),
      ],
      2026,
      '2026-09-29',
    );

    expect(barras.map((b) => b.lane)).toEqual([0, 1, 0]);
  });

  it('pulsar una barra lleva al mes en que se ve empezar dentro del año', () => {
    const [cruza, dentro] = layoutAbsenceBars(
      [baja('2025-12-20', '2026-01-10'), baja('2026-03-28', '2026-04-04')],
      2026,
      '2026-09-29',
    );

    expect(periodOfBar(cruza, 2026)).toBe(202601);
    expect(periodOfBar(dentro, 2026)).toBe(202603);
  });

  it('los meses en que no estaba son los que ninguna presencia toca', () => {
    const presente = monthsWithPresence(
      [
        { startDate: '2025-12-08', endDate: '2026-01-27' },
        { startDate: '2026-03-22', endDate: null },
      ],
      2026,
    );

    expect(presente).toEqual([
      true,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});
