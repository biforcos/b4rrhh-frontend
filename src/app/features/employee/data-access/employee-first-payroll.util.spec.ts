import { describe, expect, it } from 'vitest';

import {
  firstPayrollMessage,
  firstPayrollOf,
  noPayrollInPeriodMessage,
  notOpenYetMessage,
} from './employee-first-payroll.util';

/**
 * Si hay nómina que calcular en el período abierto (`b4rrhh/frontend#136`): la sesión de
 * `workspace#18` dio de alta a alguien el 01/10 con septiembre abierto, y «Calcular nómina» calculaba
 * septiembre y fallaba.
 */
describe('la primera nómina de un empleado', () => {
  const desdeOctubre = [{ startDate: '2026-10-01', endDate: null }];

  it('quien empieza en octubre con septiembre abierto: su primera nómina es octubre', () => {
    const first = firstPayrollOf(desdeOctubre, 202609);

    expect(first).toEqual({ kind: 'later', first: 202610 });
    expect(firstPayrollMessage(first, 202609)).toBe(
      'Su primera nómina es la de octubre, que se abre al cerrar septiembre.',
    );
  });

  it('un día de alta en el mes abierto basta: hay nómina, y no hay frase', () => {
    const first = firstPayrollOf([{ startDate: '2026-09-30', endDate: null }], 202609);

    expect(first).toEqual({ kind: 'covered' });
    expect(firstPayrollMessage(first, 202609)).toBeNull();
  });

  it('si empieza más tarde, dice cuál y que todavía no está abierta', () => {
    expect(
      firstPayrollMessage(
        firstPayrollOf([{ startDate: '2027-01-15', endDate: null }], 202609),
        202609,
      ),
    ).toBe(
      'Su primera nómina es la de enero de 2027, que todavía no está abierta: ahora está abierto septiembre.',
    );
  });

  it('cesado antes del mes abierto: no hay nómina que calcular', () => {
    const first = firstPayrollOf([{ startDate: '2026-01-01', endDate: '2026-05-13' }], 202609);

    expect(first).toEqual({ kind: 'none' });
    expect(firstPayrollMessage(first, 202609)).toBe(
      'No está de alta ningún día de septiembre, que es el mes abierto: no hay nómina que calcular.',
    );
  });

  it('readmitido después: cuenta la presencia nueva, no la cerrada', () => {
    expect(
      firstPayrollOf(
        [
          { startDate: '2026-01-01', endDate: '2026-05-13' },
          { startDate: '2026-11-02', endDate: null },
        ],
        202609,
      ),
    ).toEqual({ kind: 'later', first: 202611 });
  });

  it('en Operaciones, el mes elegido y el número del empleado', () => {
    expect(
      noPayrollInPeriodMessage('EMP000901', firstPayrollOf(desdeOctubre, 202609), 202609),
    ).toBe(
      'EMP000901 no está de alta ningún día de septiembre de 2026: su primera nómina es la de octubre de 2026.',
    );
  });

  it('un mes posterior al abierto avisa; el abierto y los anteriores no', () => {
    expect(notOpenYetMessage(202610, 202609)).toBe(
      'Octubre no está abierto todavía; lo que metas aquí se paga cuando se abra.',
    );
    expect(notOpenYetMessage(202609, 202609)).toBeNull();
    expect(notOpenYetMessage(202608, 202609)).toBeNull();
  });
});
