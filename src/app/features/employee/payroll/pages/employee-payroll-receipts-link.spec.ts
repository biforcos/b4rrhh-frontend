import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { EmployeePayrollPageComponent } from './employee-payroll-page.component';

/**
 * El salto de la ficha del empleado a sus recibos (`b4rrhh/frontend#68`), que es el paso 1.
 *
 * Es un enlace y no una pantalla, y lo que este test sujeta es **adónde apunta**: a la lista de
 * recibos con el número del empleado como filtro, y a nada más concreto.
 *
 * Que no elija recibo es la decisión del issue, no un atajo: un empleado no tiene *un* recibo, tiene
 * el de cada periodo y puede tener varias presencias. `EMP000001` tiene el suyo en la **presencia
 * 2**, así que cualquier enlace que apuntara a «su recibo» tendría que suponerle una presencia — y
 * acertaría en 998 empleados de la semilla y fallaría justo en el primero que alguien abre.
 */
describe('El salto de la ficha a sus recibos', () => {
  function enlaceDe(employeeNumber: string): HTMLAnchorElement | null {
    TestBed.configureTestingModule({
      imports: [EmployeePayrollPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(paramMap(employeeNumber)),
            snapshot: { paramMap: paramMap(employeeNumber) },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(EmployeePayrollPageComponent);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.receipts-link__action');
  }

  function paramMap(employeeNumber: string) {
    const valores: Record<string, string> = {
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber,
    };
    return {
      get: (k: string) => (k in valores ? valores[k] : null),
      has: (k: string) => k in valores,
      keys: Object.keys(valores),
    };
  }

  it('la ficha ofrece llegar a sus recibos sin escribir nada', () => {
    expect(enlaceDe('EMP000001')).not.toBeNull();
  });

  /**
   * Lleva a la lista con el filtro puesto. El número va en la *query*, no en la ruta: es un filtro
   * de esa pantalla, no parte de su dirección.
   */
  it('apunta a la lista de recibos filtrada por ese empleado', () => {
    const href = enlaceDe('EMP000001')?.getAttribute('href') ?? '';

    expect(href).toContain('/nomina/recibos');
    expect(href).toContain('employeeNumber=EMP000001');
  });

  /** Y no supone presencia ni periodo, que es lo que le haría fallar con EMP000001. */
  it('no le supone ni presencia ni periodo', () => {
    const href = enlaceDe('EMP000001')?.getAttribute('href') ?? '';

    expect(href).not.toContain('NORMAL');
    expect(href).not.toContain('presence');
    expect(href).not.toMatch(/\/\d{6}\//);
  });

  it('el enlace lleva el número del empleado que se está mirando', () => {
    const href = enlaceDe('EMP000777')?.getAttribute('href') ?? '';

    expect(href).toContain('employeeNumber=EMP000777');
  });
});
