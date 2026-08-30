import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { employeeDirectorySeed } from './employee-directory.seed';
import { EmployeeDirectoryReadGateway } from './employee-directory-read.gateway';
import {
  EMPLOYEE_DIRECTORY_PAGE_SIZE,
  EMPLOYEE_DIRECTORY_SEARCH_DEBOUNCE_MS,
  EmployeeDirectoryStore,
} from './employee-directory.store';
import { EmployeeDirectoryQuery } from '../models/employee-list-item.model';

describe('EmployeeDirectoryStore', () => {
  let store: EmployeeDirectoryStore;
  let readGatewayMock: {
    readDirectory: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    // El gateway devuelve la página pedida y un total que no tiene nada que ver con las filas:
    // el store no lo recalcula, lo repite (frontend#27, backend#18).
    readGatewayMock = {
      readDirectory: vi.fn((query: EmployeeDirectoryQuery) =>
        of({ items: employeeDirectorySeed, page: query.page, size: query.size, total: 310 }),
      ),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeDirectoryReadGateway, useValue: readGatewayMock }],
    });

    store = TestBed.inject(EmployeeDirectoryStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carga la primera página sin filtro al arrancar, y se queda con el total del servidor', () => {
    expect(readGatewayMock.readDirectory).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readDirectory).toHaveBeenCalledWith({
      q: '',
      status: null,
      page: 0,
      size: EMPLOYEE_DIRECTORY_PAGE_SIZE,
    });
    expect(store.employees().length).toBe(employeeDirectorySeed.length);
    expect(store.total()).toBe(310);
  });

  it('la búsqueda se la pregunta al servidor, tras una pausa y desde la primera página', () => {
    store.setPage(2);
    readGatewayMock.readDirectory.mockClear();

    store.setQuery('lid');
    store.setQuery('lidia');
    expect(readGatewayMock.readDirectory).not.toHaveBeenCalled();

    vi.advanceTimersByTime(EMPLOYEE_DIRECTORY_SEARCH_DEBOUNCE_MS);

    expect(readGatewayMock.readDirectory).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'lidia', page: 0 }),
    );
  });

  it('el estado y la página también van al servidor', () => {
    readGatewayMock.readDirectory.mockClear();

    store.setStatus('TERMINATED');
    expect(readGatewayMock.readDirectory).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'TERMINATED', page: 0 }),
    );

    store.setPage(3);
    expect(readGatewayMock.readDirectory).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'TERMINATED', page: 3 }),
    );
    // Pedir la página en la que ya se está no vuelve a preguntar (el paginador lo hace al montarse).
    store.setPage(3);
    expect(readGatewayMock.readDirectory).toHaveBeenCalledTimes(2);
  });

  it('busca por clave solo entre lo cargado', () => {
    const employee = store.findEmployeeByBusinessKey({
      ruleSystemCode: 'PA-ES',
      employeeTypeCode: 'CONTRACTOR',
      employeeNumber: '00012345',
    });

    expect(employee?.employeeNumber).toBe('00012345');
    expect(
      store.findEmployeeByBusinessKey({
        ruleSystemCode: 'PA-ES',
        employeeTypeCode: 'STAFF',
        employeeNumber: '99999999',
      }),
    ).toBeNull();
  });

  it('refresca a petición con la misma pregunta', () => {
    store.setStatus('ACTIVE');
    readGatewayMock.readDirectory.mockClear();

    store.refreshDirectory();

    expect(readGatewayMock.readDirectory).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' }),
    );
  });
});
