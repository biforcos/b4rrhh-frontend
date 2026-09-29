import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EmployeeStatus } from '../models/employee-detail.model';
import { EmployeeLifecycleAction, lifecycleActionFor } from './employee-lifecycle-action';

/**
 * Qué cabe hacer con el ciclo de vida de un empleado, para su estado y sus fechas previstas
 * (`b4rrhh/frontend#111`). La tabla entera: cada estado del servidor —y «sin detalle»— por cada
 * combinación de fecha prevista.
 *
 * Lo que se sujeta: no se ofrece lo que el backend rechazaría. A quien tiene la readmisión grabada
 * no se le ofrece readmitir, a quien tiene el cese grabado no se le ofrece cesar, y a quien no tiene
 * ninguna presencia no se le ofrece readmitir, porque no hay nada que reabrir. En su sitio, lo que
 * va a pasar y cuándo.
 */
describe('lifecycleActionFor', () => {
  const CESE = '2026-10-14';
  const VUELTA = '2026-10-08';

  type Row = [
    EmployeeStatus | null,
    { plannedTerminationDate: string | null; plannedHireDate: string | null },
    EmployeeLifecycleAction,
  ];

  const NADA = { plannedTerminationDate: null, plannedHireDate: null };
  const SOLO_CESE = { plannedTerminationDate: CESE, plannedHireDate: null };
  const SOLO_VUELTA = { plannedTerminationDate: null, plannedHireDate: VUELTA };
  const LAS_DOS = { plannedTerminationDate: CESE, plannedHireDate: VUELTA };

  const tabla: Row[] = [
    // De alta: se ofrece cesar, salvo que el cese ya esté grabado. El servidor no manda fecha de
    // alta prevista a quien está de alta; si la mandara, manda el estado.
    ['ACTIVE', NADA, { kind: 'TERMINATE' }],
    ['ACTIVE', SOLO_CESE, { kind: 'PLANNED', event: 'TERMINATION', date: CESE }],
    ['ACTIVE', SOLO_VUELTA, { kind: 'TERMINATE' }],
    ['ACTIVE', LAS_DOS, { kind: 'PLANNED', event: 'TERMINATION', date: CESE }],
    // De baja: se ofrece readmitir, salvo que la readmisión ya esté grabada.
    ['TERMINATED', NADA, { kind: 'REHIRE' }],
    ['TERMINATED', SOLO_CESE, { kind: 'REHIRE' }],
    ['TERMINATED', SOLO_VUELTA, { kind: 'PLANNED', event: 'REHIRE', date: VUELTA }],
    ['TERMINATED', LAS_DOS, { kind: 'PLANNED', event: 'REHIRE', date: VUELTA }],
    // Sin alta: con el alta grabada, se dice cuándo; sin ninguna presencia, no hay ciclo que tocar.
    ['NOT_HIRED', NADA, { kind: 'NONE' }],
    ['NOT_HIRED', SOLO_CESE, { kind: 'NONE' }],
    ['NOT_HIRED', SOLO_VUELTA, { kind: 'PLANNED', event: 'HIRE', date: VUELTA }],
    ['NOT_HIRED', LAS_DOS, { kind: 'PLANNED', event: 'HIRE', date: VUELTA }],
    // Sin detalle no hay estado (frontend#101): no se ofrece nada, y menos una readmisión.
    [null, NADA, { kind: 'NONE' }],
    [null, SOLO_CESE, { kind: 'NONE' }],
    [null, SOLO_VUELTA, { kind: 'NONE' }],
    [null, LAS_DOS, { kind: 'NONE' }],
  ];

  it.each(tabla)('%s con %o → %o', (status, fechas, esperado) => {
    expect(lifecycleActionFor(status, fechas)).toEqual(esperado);
  });

  it('la tabla recorre los cuatro estados por las cuatro combinaciones de fechas', () => {
    expect(tabla).toHaveLength(16);
    expect(
      new Set(tabla.map(([status, fechas]) => `${status}|${JSON.stringify(fechas)}`)).size,
    ).toBe(16);
  });
});

/**
 * Y es el único sitio (`b4rrhh/frontend#111`): antes el menú decidía con un `=== 'ACTIVE'` suyo.
 * Quien ofrezca cesar o readmitir lo hace desde la ficha, y la ficha pregunta aquí.
 */
describe('the lifecycle actions are only offered through lifecycleActionFor', () => {
  const featureDir = resolve(process.cwd(), 'src/app/features/employee');

  function sourcesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) return sourcesUnder(path);
      return /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
    });
  }

  const offering = sourcesUnder(featureDir)
    .filter((path) => /pageAction(Rehire|Terminate)\b/.test(readFileSync(path, 'utf8')))
    .map((path) => path.slice(featureDir.length + 1).replaceAll('\\', '/'));

  it('only the employee detail page offers them, besides the texts', () => {
    expect(offering.sort()).toEqual([
      'employee.texts.ts',
      'shell/pages/employee-detail-page.component.ts',
    ]);
  });

  it('and the page asks lifecycleActionFor instead of looking at the status itself', () => {
    const page = readFileSync(
      resolve(featureDir, 'shell/pages/employee-detail-page.component.ts'),
      'utf8',
    );
    expect(page).toContain('lifecycleActionFor(');
  });
});
