import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * El alta cabe a 1280 (`b4rrhh/frontend#112`).
 *
 * Tenía scroll horizontal de 8 px. La rejilla del formulario (`.grid`) lleva medio rem de margen
 * negativo a cada lado, como la de PrimeFlex, para que el relleno de las columnas quede alineado
 * con el título; eso sólo funciona si el contenedor tiene el relleno que lo compensa. El contenedor
 * lo pedía con la clase `p-4`, que no define nadie —PrimeFlex no está instalado y la hoja del alta
 * copia sólo las utilidades que usa—, así que la rejilla se salía por la derecha.
 *
 * Se sujeta en el fuente: el relleno lo pone la hoja, donde se aplica de verdad, y la plantilla ya
 * no promete uno con una clase muerta.
 */
describe('la maqueta del alta cabe en su contenedor', () => {
  const dir = resolve(process.cwd(), 'src/app/features/employee/lifecycle/hire/pages');
  const scss = readFileSync(resolve(dir, 'hire-employee-page.component.scss'), 'utf8');
  const html = readFileSync(resolve(dir, 'hire-employee-page.component.html'), 'utf8');

  function rule(selector: string): string {
    const start = scss.indexOf(`${selector} {`);
    expect(start, `falta la regla ${selector}`).toBeGreaterThanOrEqual(0);
    return scss.slice(start, scss.indexOf('}', start));
  }

  it('la rejilla lleva medio rem de margen negativo a los lados', () => {
    const grid = rule('.grid');
    expect(grid).toContain('margin-left: -0.5rem');
    expect(grid).toContain('margin-right: -0.5rem');
  });

  it('y el contenedor lo compensa con su propio relleno a los lados', () => {
    expect(rule('.hire-employee-container')).toMatch(/padding-inline:\s*1rem/);
  });

  it('la plantilla no pide el relleno con una utilidad que no existe', () => {
    const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
    expect(classes).not.toContain('p-4');
  });
});
