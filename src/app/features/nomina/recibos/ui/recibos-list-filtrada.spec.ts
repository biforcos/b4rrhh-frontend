import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { RecibosFilters } from '../models/recibos-filters.model';
import { RecibosListComponent } from './recibos-list.component';

/**
 * La lista de recibos abierta ya filtrada por un empleado (`b4rrhh/frontend#68`).
 *
 * El paso 1 del camino es un enlace y no una pantalla: la lista ya sabía filtrar por empleado, lo
 * que no sabía era que se lo pidieran desde fuera. Lo que este test sujeta es lo que hace que ese
 * enlace sirva de verdad:
 *
 * 1. Que el número llegue por la dirección y **la búsqueda salga sola**, sin que nadie pulse nada.
 * 2. Que `EMP000001` se busque tal cual — su recibo está en la **presencia 2**, y el salto no puede
 *    suponer ninguna presencia porque no elige recibo: filtra.
 * 3. Que un empleado **sin recibos** no deje una lista vacía y muda, que es indistinguible de «aún
 *    no has buscado».
 */
describe('La lista de recibos filtrada por un empleado', () => {
  let queryParams: BehaviorSubject<Map<string, string>>;
  let buscados: RecibosFilters[];
  let resultado: PayrollSummaryModel[];
  let fixture: ComponentFixture<RecibosListComponent>;

  const RECIBO_DE_EMP1: PayrollSummaryModel = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP000001',
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL',
    presenceNumber: 2,
    status: 'CALCULATED',
    calculatedAt: '2026-09-14T22:03:48',
  };

  function paramMapDe(valores: Record<string, string>): Map<string, string> {
    const mapa = new Map(Object.entries(valores));
    (mapa as unknown as { get(k: string): string | null }).get = (k: string) =>
      Object.prototype.hasOwnProperty.call(valores, k) ? valores[k] : null;
    return mapa;
  }

  function montar(valores: Record<string, string>): void {
    queryParams = new BehaviorSubject(paramMapDe(valores));

    TestBed.configureTestingModule({
      imports: [RecibosListComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams.asObservable() } },
        {
          provide: RecibosGateway,
          useValue: {
            search: vi.fn((filtros: RecibosFilters) => {
              buscados.push(filtros);
              return of(resultado);
            }),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(RecibosListComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    buscados = [];
    resultado = [];
  });

  it('busca sola cuando el número llega en la dirección', () => {
    resultado = [RECIBO_DE_EMP1];
    montar({ employeeNumber: 'EMP000001' });

    expect(buscados).toHaveLength(1);
    expect(buscados[0].employeeNumber).toBe('EMP000001');
  });

  /**
   * El enlace filtra, no elige recibo. Por eso no manda periodo ni presencia: `EMP000001` tiene el
   * suyo en la presencia 2, y cualquier suposición aquí acertaría en 998 empleados y fallaría en él.
   */
  it('filtra sólo por el empleado, sin suponerle periodo ni presencia', () => {
    resultado = [RECIBO_DE_EMP1];
    montar({ employeeNumber: 'EMP000001' });

    expect(buscados[0]).toEqual({ payrollPeriodCode: '', employeeNumber: 'EMP000001', status: '' });
  });

  it('enseña el recibo que encuentra, con su presencia', () => {
    resultado = [RECIBO_DE_EMP1];
    montar({ employeeNumber: 'EMP000001' });

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('EMP000001');
    expect(texto).toContain('presencia 2');
  });

  /** Sin número en la dirección no se busca: la pantalla abre como siempre, esperando. */
  it('sin número en la dirección no busca nada', () => {
    montar({});

    expect(buscados).toHaveLength(0);
  });

  describe('un empleado sin ningún recibo', () => {
    it('lo dice con su número, en vez de dejar una lista muda', () => {
      resultado = [];
      montar({ employeeNumber: 'EMP000014' });
      fixture.detectChanges();

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('EMP000014 no tiene ningún recibo');
      expect(texto).toContain('no se le ha calculado ninguna nómina');
    });

    /**
     * Y antes de buscar no se acusa a nadie de no tener recibos: la lista vacía de recién llegado
     * no es una respuesta.
     */
    it('no dice nada de eso antes de haber buscado', () => {
      montar({});
      fixture.detectChanges();

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).not.toContain('no tiene ningún recibo');
      expect(texto).not.toContain('Ningún recibo con estos filtros');
    });
  });

  it('volver con otro empleado vuelve a buscar', () => {
    resultado = [RECIBO_DE_EMP1];
    montar({ employeeNumber: 'EMP000001' });

    queryParams.next(paramMapDe({ employeeNumber: 'EMP000002' }));
    fixture.detectChanges();

    expect(buscados.map((f) => f.employeeNumber)).toEqual(['EMP000001', 'EMP000002']);
  });
});
