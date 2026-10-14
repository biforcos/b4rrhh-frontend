import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `ng serve` sin pre-empaquetado (b4rrhh/frontend#132).
 *
 * Con el pre-empaquetado de dependencias de Vite, el servidor de desarrollo cargaba PrimeNG y los
 * formularios de Angular **dos veces**: decenas de `NG0912` («Component ID generation collision»),
 * `NG01203` («No value accessor for form control») y el selector de fecha de un modal vacío aunque el
 * borrador tenía la fecha. Borrar `.angular/cache` lo arreglaba una vez y volvía al rearrancar, y así
 * se persiguió como un fallo de la aplicación (`frontend#83`, `frontend#126`). El build de producción
 * no pre-empaqueta: la demo nunca lo tuvo; sólo quien desarrolla.
 *
 * La opción vive en `angular.json` y no en un script para que valga con `npm start` y con cualquier
 * `ng serve` a mano. Este spec es el candado: quitarla vuelve a abrir la puerta a los fantasmas.
 */
describe('ng serve (b4rrhh/frontend#132)', () => {
  it('no pre-empaqueta las dependencias', () => {
    const angular = JSON.parse(readFileSync(resolve(process.cwd(), 'angular.json'), 'utf-8'));
    const serves = Object.values(angular.projects).map(
      (project) =>
        (project as { architect: { serve: { options: Record<string, unknown> } } }).architect.serve
          .options,
    );

    expect(serves.length).toBeGreaterThan(0);
    for (const options of serves) {
      expect(options['prebundle']).toBe(false);
    }
  });
});
