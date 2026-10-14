import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Nunca un botón partido en la columna de acciones (`b4rrhh/frontend#143`): con un ancho fijo de
 * 80 px, «Corregir fecha de alta» salía en tres líneas. La columna se ajusta al botón más ancho.
 */
describe('la columna de acciones de una sección temporal', () => {
  const scss = readFileSync(
    resolve(process.cwd(), 'src/app/shared/ui/temporal-section/temporal-section.component.scss'),
    'utf8',
  );
  const regla = () => {
    const inicio = scss.indexOf('.temporal-section__td--actions {');
    expect(inicio, 'falta la regla de la celda de acciones').toBeGreaterThanOrEqual(0);
    return scss.slice(inicio, scss.indexOf('}', inicio));
  };

  it('no parte el texto de sus botones', () => {
    expect(regla()).toMatch(/white-space:\s*nowrap/);
  });

  it('y no tiene un ancho fijo que lo obligue a partirse', () => {
    expect(regla()).not.toMatch(/width:\s*\d+px/);
  });
});
