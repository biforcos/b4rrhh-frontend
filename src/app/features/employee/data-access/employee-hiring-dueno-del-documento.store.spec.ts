import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { HireIdentifierOwner } from '../models/employee-hiring.model';
import { EmployeeHiringGateway } from './employee-hiring.gateway';
import { EmployeeHiringStore } from './employee-hiring.store';

/**
 * De quién es el documento, preguntado al salir del campo (`b4rrhh/frontend#106`).
 *
 * La segunda revisión a distancia: «hasta que no rellenas toda la contratación no se habilita el
 * botón contratar, y sólo cuando se envía al servidor se devuelve que ya existe». El dato que
 * descalifica el alta era el primero que se escribía y el último que se comprobaba. Ahora se
 * pregunta al `b4rrhh/backend#149` en cuanto se sale del campo. La respuesta que llega tarde no
 * gana: si el valor cambió mientras se consultaba, se tira.
 */
describe('EmployeeHiringStore: el dueño del documento antes del alta', () => {
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

  function montar(findIdentifierOwner: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeHiringGateway, useValue: { hire: vi.fn(), findIdentifierOwner } },
      ],
    });
    return TestBed.inject(EmployeeHiringStore);
  }

  it('pregunta con el sistema, el tipo y el valor, y guarda el dueño', () => {
    const find = vi.fn().mockReturnValue(of(DUENO));
    const store = montar(find);

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '00000002W');

    expect(find).toHaveBeenCalledWith('ESP', 'NATIONAL_ID', '00000002W');
    expect(store.identifierOwner()).toEqual(DUENO);
  });

  it('un documento libre no deja dueño', () => {
    const store = montar(vi.fn().mockReturnValue(of(null)));

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '99999999R');

    expect(store.identifierOwner()).toBeNull();
  });

  it('sin valor no pregunta', () => {
    const find = vi.fn();
    const store = montar(find);

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '   ');

    expect(find).not.toHaveBeenCalled();
    expect(store.identifierOwner()).toBeNull();
  });

  it('la respuesta que llega tarde no gana', () => {
    const primera = new Subject<HireIdentifierOwner | null>();
    const segunda = new Subject<HireIdentifierOwner | null>();
    const store = montar(vi.fn().mockReturnValueOnce(primera).mockReturnValueOnce(segunda));

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '00000002W');
    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '99999999R');
    segunda.next(null);
    primera.next(DUENO);

    expect(store.identifierOwner()).toBeNull();
  });

  it('cambiar el valor olvida el dueño y tira la consulta en vuelo', () => {
    const enVuelo = new Subject<HireIdentifierOwner | null>();
    const store = montar(vi.fn().mockReturnValueOnce(of(DUENO)).mockReturnValueOnce(enVuelo));

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '00000002W');
    expect(store.identifierOwner()).toEqual(DUENO);

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '00000002W');
    store.forgetIdentifierOwner();
    enVuelo.next(DUENO);

    expect(store.identifierOwner()).toBeNull();
  });

  it('si la consulta falla, no se inventa nada: la garantía sigue siendo el 409 del alta', () => {
    const fallo = new Subject<HireIdentifierOwner | null>();
    const store = montar(vi.fn().mockReturnValue(fallo));

    store.checkIdentifierOwner('ESP', 'NATIONAL_ID', '00000002W');
    fallo.error(new Error('sin red'));

    expect(store.identifierOwner()).toBeNull();
    expect(store.error()).toBeNull();
  });
});
