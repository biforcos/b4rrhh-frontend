import { describe, expect, it } from 'vitest';

import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { sameAsInForceNotice, withSameAsInForce } from './same-as-in-force.util';

interface Row extends TemporalSectionRow {
  value: number;
}
const row = (startDate: string, endDate: string | null, value: number): Row => ({
  startDate,
  endDate,
  isActive: endDate === null,
  value,
});
const TEMPLATE = 'Igual a la vigente desde el {desde}.';

/** El aviso de `b4rrhh/frontend#94`, sin pantalla: qué fila está en vigor y si la nueva es igual. */
describe('sameAsInForceNotice', () => {
  const rows = [row('2026-03-01', null, 50), row('2025-06-17', '2026-02-28', 100)];

  it('igual a la que está en vigor el día que empieza la nueva: avisa con su fecha', () => {
    expect(sameAsInForceNotice(rows, '2026-09-16', (r) => r.value === 50, TEMPLATE)).toBe(
      'Igual a la vigente desde el 01/03/2026.',
    );
  });

  it('distinta: no avisa', () => {
    expect(sameAsInForceNotice(rows, '2026-09-16', (r) => r.value === 100, TEMPLATE)).toBeNull();
  });

  it('mira la que estaba en vigor ese día, no la última', () => {
    expect(sameAsInForceNotice(rows, '2025-09-01', (r) => r.value === 100, TEMPLATE)).toBe(
      'Igual a la vigente desde el 17/06/2025.',
    );
  });

  it('el mismo día que empieza otra no es esto: es su corrección, y eso lo dice el backend', () => {
    expect(sameAsInForceNotice(rows, '2026-03-01', (r) => r.value === 50, TEMPLATE)).toBeNull();
  });

  it('sin fecha, o sin nada en vigor ese día, no avisa', () => {
    expect(sameAsInForceNotice(rows, '', () => true, TEMPLATE)).toBeNull();
    expect(sameAsInForceNotice(rows, '2020-01-01', () => true, TEMPLATE)).toBeNull();
  });
});

describe('withSameAsInForce', () => {
  it('el aviso va delante del plan y lo vuelve advertencia', () => {
    expect(withSameAsInForce({ tone: 'info', lines: ['plan'] }, 'igual')).toEqual({
      tone: 'warning',
      lines: ['igual', 'plan'],
    });
  });

  it('un rechazo sigue siendo rechazo y manda solo', () => {
    expect(withSameAsInForce({ tone: 'error', lines: ['no'] }, 'igual')).toEqual({
      tone: 'error',
      lines: ['no'],
    });
  });

  it('sin aviso, el plan tal cual; sin plan, el aviso', () => {
    expect(withSameAsInForce({ tone: 'info', lines: ['plan'] }, null)).toEqual({
      tone: 'info',
      lines: ['plan'],
    });
    expect(withSameAsInForce(null, 'igual')).toEqual({ tone: 'warning', lines: ['igual'] });
    expect(withSameAsInForce(null, null)).toEqual({ tone: 'info', lines: [] });
  });
});
