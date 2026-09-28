import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { RecibosListComponent } from './recibos-list.component';

/**
 * El molde de la plantilla (`b4rrhh/frontend#92`): cuando la búsqueda falla, **lo que dijo el
 * servidor llega a la pantalla**, detrás de lo que se intentaba. Antes salía «Error al cargar las
 * nóminas.» dijera lo que dijera el servidor.
 */
describe('La lista de recibos cuando la búsqueda falla', () => {
  function montarConFallo(error: HttpErrorResponse): HTMLElement {
    const valores = { employeeNumber: 'EMP000001' };
    const mapa = new Map(Object.entries(valores));
    (mapa as unknown as { get(k: string): string | null }).get = (k: string) =>
      (valores as Record<string, string>)[k] ?? null;
    TestBed.configureTestingModule({
      imports: [RecibosListComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: new BehaviorSubject(mapa).asObservable() },
        },
        {
          provide: RecibosGateway,
          useValue: {
            getPayslipSections: () => of([]),
            search: () => throwError(() => error),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(RecibosListComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('enseña lo que dijo el servidor', () => {
    const pantalla = montarConFallo(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'El período 20260 no tiene seis cifras' },
      }),
    );
    expect(pantalla.querySelector('.list-msg.error')?.textContent?.trim()).toBe(
      'No se pudieron cargar los recibos: El período 20260 no tiene seis cifras.',
    );
  });

  it('y si no dijo nada, lo que se sabe: sin conexión', () => {
    const pantalla = montarConFallo(new HttpErrorResponse({ status: 0 }));
    expect(pantalla.querySelector('.list-msg.error')?.textContent?.trim()).toBe(
      'No se pudieron cargar los recibos: no hay conexión con el servidor. Reintenta cuando vuelva.',
    );
  });
});
