import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BehaviorSubject, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { RecibosListComponent } from './recibos-list.component';

/**
 * El paginador se queda al pie de la columna (`b4rrhh/frontend#103`), como el rol y «Salir» en el
 * lateral.
 *
 * El pie ya era hermano de las filas desde el `frontend#93`, y aun así se iba con el scroll: nadie
 * acotaba la altura de la columna, así que la lista entera crecía con sus cincuenta filas y quien
 * se desplazaba era el documento, con el pie al final. Y `.page-layout` llevaba `overflow: hidden`,
 * que la hace contenedor de scroll y deja muerto cualquier `sticky` de dentro.
 *
 * El patrón es el del lateral (`app-shell.component.scss`): la columna pegada arriba con el alto de
 * la ventana, las filas con su propio scroll y el pie sin encoger. jsdom no maqueta, así que se
 * sujeta la estructura en el DOM y el patrón en el fuente de estilos; lo de los píxeles lo dice la
 * captura del issue.
 */
describe('El pie de la lista de recibos, fijo al pie de la columna', () => {
  function leer(fichero: string): string {
    return readFileSync(
      resolve(process.cwd(), 'src/app/features/nomina/recibos/ui', fichero),
      'utf8',
    );
  }

  function regla(estilos: string, selector: string): string {
    const inicio = estilos.indexOf(`\n${selector} {`);
    expect(inicio, `no encuentro la regla ${selector}`).toBeGreaterThanOrEqual(0);
    return estilos.slice(inicio, estilos.indexOf('}', inicio));
  }

  it('el pie es hermano de las filas, no hijo del contenedor que hace scroll', () => {
    const vacio = new Map<string, string>();
    (vacio as unknown as { get(k: string): string | null }).get = () => null;
    TestBed.configureTestingModule({
      imports: [RecibosListComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: { queryParamMap: new BehaviorSubject(vacio) } },
        {
          provide: RecibosGateway,
          useValue: {
            getPayslipSections: () => of([]),
            search: () => of({ items: [], page: 0, size: 50, total: 0 }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(RecibosListComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const filas = host.querySelector('.results');
    const pie = host.querySelector('.list-footer');
    expect(filas).not.toBeNull();
    expect(pie?.parentElement).toBe(filas?.parentElement);
    expect(filas?.contains(pie ?? null)).toBe(false);
  });

  it('la columna se pega arriba con el alto de la ventana, como el lateral', () => {
    const columna = regla(leer('recibos-list.component.scss'), '.list-panel');

    expect(columna).toContain('position: sticky');
    expect(columna).toContain('top: 0');
    expect(columna).toContain('align-self: flex-start');
    expect(columna).toContain('height: 100dvh');
  });

  it('las filas hacen su propio scroll y el pie no encoge', () => {
    const estilos = leer('recibos-list.component.scss');

    expect(regla(estilos, '.results')).toContain('min-height: 0');
    expect(regla(estilos, '.results')).toContain('overflow-y: auto');
    expect(regla(estilos, '.list-footer')).toContain('flex-shrink: 0');
  });

  it('nada por encima convierte la página en contenedor de scroll', () => {
    expect(regla(leer('recibos-page.component.scss'), '.page-layout')).not.toMatch(
      /overflow: (hidden|auto|scroll)/,
    );
  });
});
