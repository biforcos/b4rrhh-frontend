import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Lo raro es lo opcional, y es lo que se marca (`b4rrhh/frontend#142`): «¿tengo o no tengo que
 * rellenar el nombre favorito?». Los campos que se pueden dejar vacíos llevan «opcional» junto al
 * rótulo; los obligatorios, nada. Antes era al revés: un asterisco en cada obligatorio y silencio en
 * los opcionales, que es justo donde estaba la duda.
 */
describe('el alta marca lo opcional, no lo obligatorio', () => {
  const html = readFileSync(
    resolve(
      process.cwd(),
      'src/app/features/employee/lifecycle/hire/pages/hire-employee-page.component.html',
    ),
    'utf8',
  );
  const label = (id: string) => {
    const match = html.match(new RegExp(`<label for="${id}"[\\s\\S]*?</label`));
    expect(match, `falta el rótulo de ${id}`).not.toBeNull();
    return match![0];
  };

  it.each(['lastName2', 'preferredName', 'contractSubtypeCode'])('%s lleva «opcional»', (id) => {
    expect(label(id)).toContain('fieldOptionalMark');
  });

  it.each(['firstName', 'lastName1', 'identifierValue', 'hireDate', 'companyCode'])(
    '%s no lleva nada: ni «opcional» ni asterisco',
    (id) => {
      expect(label(id)).not.toContain('fieldOptionalMark');
      expect(label(id)).not.toMatch(/\s\*\s*<\/label/);
    },
  );
});
