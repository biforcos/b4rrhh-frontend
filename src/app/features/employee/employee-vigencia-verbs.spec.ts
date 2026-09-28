import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { employeeTexts } from './employee.texts';

/**
 * Los verbos de las vigencias de la ficha (`b4rrhh/frontend#91`), barridos y no enumerados a mano.
 *
 * Todas las secciones con vigencia hablan igual que las ausencias (`b4rrhh/frontend#84`): se
 * **corrige** una ocurrencia y se **borra**; ninguna se «edita» ni se «elimina». Este barrido recorre
 * los textos de cada sección de vigencias y los literales de las que los llevan en el componente, y
 * se queja del primero que diga otra cosa. Una sección nueva con vigencia entra sola por su prefijo.
 */
const VIGENCIA_PREFIXES = [
  'contractSection',
  'workingTimeSection',
  'laborClassificationSection',
  'workCenterSection',
  'costCenterSection',
  'extraPaymentRegimeSection',
  'addressesSection',
  'absences',
  'taxInformation',
];

const WRONG_VERB = /^(Editar|Eliminar)\b/;

describe('los verbos de las vigencias', () => {
  it('ningún texto de una sección de vigencias empieza por «Editar» ni por «Eliminar»', () => {
    const wrong = Object.entries(employeeTexts)
      .filter(([key]) => VIGENCIA_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .filter(([, value]) => typeof value === 'string' && WRONG_VERB.test(value))
      .map(([key, value]) => `${key}: ${value}`);
    expect(wrong).toEqual([]);
  });

  it('la información fiscal, que lleva sus títulos en el componente, tampoco', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/features/employee/tax-information/components/employee-tax-information-section.component.ts',
      ),
      'utf-8',
    );
    expect(source).not.toMatch(/'(Editar|Eliminar)[^']*'/);
  });
});
