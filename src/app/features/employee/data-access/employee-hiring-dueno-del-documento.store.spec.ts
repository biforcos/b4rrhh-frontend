import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { HireIdentifierCheck, HireIdentifierOwner } from '../models/employee-hiring.model';
import { EmployeeHiringGateway } from './employee-hiring.gateway';
import { EmployeeHiringStore } from './employee-hiring.store';

/**
 * De quién es el documento, y si está bien escrito, preguntado al salir del campo
 * (`b4rrhh/frontend#106`, `b4rrhh/frontend#134`).
 *
 * La segunda revisión a distancia: «hasta que no rellenas toda la contratación no se habilita el
 * botón contratar, y sólo cuando se envía al servidor se devuelve que ya existe». La sesión de
 * workspace#18 encontró la otra mitad: un DNI con la letra mal pasaba el formulario entero. Ahora se
 * pregunta al `b4rrhh/backend#149` y `#171` en cuanto se sale del campo. La respuesta que llega
 * tarde no gana: si el valor cambió mientras se consultaba, se tira.
 */
describe('EmployeeHiringStore: el documento antes del alta', () => {
  const DUENO: HireIdentifierOwner = {
    employeeKey: {
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP000002',
    },
    active: false,
    ceasedOn: '2024-11-07',
    message: 'Este DNI ya es EMP000002 (cesado el 07/11/2024)',
  };
  const CON_DUENO: HireIdentifierCheck = { valid: true, reason: null, owner: DUENO };
  const LIBRE: HireIdentifierCheck = { valid: true, reason: null, owner: null };
  const MAL_ESCRITO: HireIdentifierCheck = {
    valid: false,
    reason: 'la letra debería ser Z',
    owner: null,
  };

  function montar(checkIdentifier: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeHiringGateway, useValue: { hire: vi.fn(), checkIdentifier } }],
    });
    return TestBed.inject(EmployeeHiringStore);
  }

  it('pregunta con el sistema, el tipo, el valor y el país, y guarda el dueño', () => {
    const check = vi.fn().mockReturnValue(of(CON_DUENO));
    const store = montar(check);

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '00000002W', 'ESP');

    expect(check).toHaveBeenCalledWith('ESP', 'NATIONAL_ID', '00000002W', 'ESP');
    expect(store.identifierOwner()).toEqual(DUENO);
    expect(store.identifierProblem()).toBeNull();
  });

  it('un documento libre no deja dueño ni problema', () => {
    const store = montar(vi.fn().mockReturnValue(of(LIBRE)));

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '99999999R', 'ESP');

    expect(store.identifierOwner()).toBeNull();
    expect(store.identifierProblem()).toBeNull();
  });

  it('un documento mal escrito deja el motivo, y no dueño', () => {
    const store = montar(vi.fn().mockReturnValue(of(MAL_ESCRITO)));

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '12345678A', 'ESP');

    expect(store.identifierProblem()).toBe('la letra debería ser Z');
    expect(store.identifierOwner()).toBeNull();
  });

  it('sin valor no pregunta', () => {
    const check = vi.fn();
    const store = montar(check);

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '   ');

    expect(check).not.toHaveBeenCalled();
    expect(store.identifierOwner()).toBeNull();
  });

  it('la respuesta que llega tarde no gana', () => {
    const primera = new Subject<HireIdentifierCheck>();
    const segunda = new Subject<HireIdentifierCheck>();
    const store = montar(vi.fn().mockReturnValueOnce(primera).mockReturnValueOnce(segunda));

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '00000002W');
    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '99999999R');
    segunda.next(LIBRE);
    primera.next(CON_DUENO);

    expect(store.identifierOwner()).toBeNull();
  });

  it('cambiar el valor olvida el dueño y el motivo, y tira la consulta en vuelo', () => {
    const enVuelo = new Subject<HireIdentifierCheck>();
    const store = montar(vi.fn().mockReturnValueOnce(of(MAL_ESCRITO)).mockReturnValueOnce(enVuelo));

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '12345678A');
    expect(store.identifierProblem()).toBe('la letra debería ser Z');

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '00000002W');
    store.forgetIdentifierOwner();
    enVuelo.next(CON_DUENO);

    expect(store.identifierOwner()).toBeNull();
    expect(store.identifierProblem()).toBeNull();
  });

  it('si la consulta falla, no se inventa nada: la garantía sigue siendo el alta', () => {
    const fallo = new Subject<HireIdentifierCheck>();
    const store = montar(vi.fn().mockReturnValue(fallo));

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '00000002W');
    fallo.error(new Error('sin red'));

    expect(store.identifierOwner()).toBeNull();
    expect(store.identifierProblem()).toBeNull();
    expect(store.error()).toBeNull();
  });
});
