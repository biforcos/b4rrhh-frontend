import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { RuleSystemScopeStore } from '../../../../core/scope/rule-system-scope.store';
import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { OperacionesStore } from './operaciones.store';

/**
 * El tipo de empleado se elige, no se escribe (`b4rrhh/frontend#88`).
 *
 * Visto en la demo del 27/09: en «Empleado único» se escribió `EMP` en el tipo —lo razonable, los
 * números empiezan por EMP— y el lanzamiento no encontró a nadie. El tipo sale ahora de la lista de
 * tipos del sistema de reglas, y si sólo hay uno viene puesto y no se pregunta.
 */
describe('Operaciones: el tipo de empleado', () => {
  function montar(tipos: string[], launchCalculation = vi.fn()): OperacionesStore {
    TestBed.configureTestingModule({
      providers: [
        OperacionesStore,
        {
          provide: OperacionesGateway,
          useValue: {
            listEmployeeTypes: vi.fn().mockReturnValue(of(tipos)),
            launchCalculation,
            getCalculationRun: vi.fn(),
            bulkInvalidate: vi.fn(),
            bulkFinalize: vi.fn(),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        { provide: RuleSystemScopeStore, useValue: { whenResolved: () => of('ESP') } },
      ],
    });
    return TestBed.inject(OperacionesStore);
  }

  it('ofrece los tipos del sistema de reglas', () => {
    const store = montar(['EXTERNAL', 'INTERNAL']);

    expect(store.employeeTypes()).toEqual(['EXTERNAL', 'INTERNAL']);
  });

  it('si sólo hay uno, viene puesto en empleado único y en lista', () => {
    const store = montar(['INTERNAL']);

    expect(store.singleEmployeeType()).toBe('INTERNAL');
    expect(store.listEmployeeType()).toBe('INTERNAL');
  });

  it('si hay más de uno, no elige por nadie', () => {
    const store = montar(['EXTERNAL', 'INTERNAL']);

    expect(store.singleEmployeeType()).toBe('');
    expect(store.listEmployeeType()).toBe('');
  });

  it('la lista es un número por línea, con el tipo elegido arriba', () => {
    const launchCalculation = vi.fn().mockReturnValue(of({ runId: 7 }));
    const store = montar(['INTERNAL'], launchCalculation);
    store.setTargetMode('LIST');
    store.setEmployeeListText('EMP000001\n\n EMP000002 ');

    store.launch();

    expect(launchCalculation.mock.calls[0][0].targetSelection).toEqual({
      selectionType: 'EMPLOYEE_LIST',
      employees: [
        { employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP000001' },
        { employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP000002' },
      ],
    });
  });

  it('si el servidor rechaza el lanzamiento, se enseña lo que dice y no una frase genérica', () => {
    const launchCalculation = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              message:
                'No existe el empleado «EMP999» de tipo INTERNAL en el sistema de reglas ESP',
            },
          }),
      ),
    );
    const store = montar(['INTERNAL'], launchCalculation);
    store.setTargetMode('SINGLE');
    store.setSingleEmployeeNumber('EMP999');

    store.launch();

    // Desde `b4rrhh/frontend#92` lo pinta el molde común: lo que se intentaba y lo que dijo.
    expect(store.launchErrorMessage()).toBe(
      'No se pudo lanzar el cálculo: No existe el empleado «EMP999» de tipo INTERNAL en el sistema de reglas ESP.',
    );
  });
});
