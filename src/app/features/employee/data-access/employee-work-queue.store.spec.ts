import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RuleSystemScopeStore } from '../../../core/scope/rule-system-scope.store';
import { EmployeeDirectoryReadGateway } from './employee-directory-read.gateway';
import {
  EMPLOYEE_WORK_QUEUE_STORAGE_KEY,
  EmployeeWorkQueueStore,
} from './employee-work-queue.store';
import { EmployeeDirectoryQuery, EmployeeListItemModel } from '../models/employee-list-item.model';

function employee(number: string): EmployeeListItemModel {
  return {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: number,
    displayName: number,
    workCenter: null,
    statusLabel: 'ACTIVE',
  };
}

/** El servidor: una lista ordenada que cumple el criterio; la cola solo la ve de una en una. */
function serverWith(list: () => ReadonlyArray<EmployeeListItemModel>) {
  return vi.fn((query: EmployeeDirectoryQuery) => {
    const all = list();
    const start = query.page * query.size;
    return of({
      items: all.slice(start, start + query.size),
      page: query.page,
      size: query.size,
      total: all.length,
    });
  });
}

describe('EmployeeWorkQueueStore', () => {
  const scopeCode = signal<string | null>('ESP');
  let store: EmployeeWorkQueueStore;
  let list: ReadonlyArray<EmployeeListItemModel>;
  let readDirectory: ReturnType<typeof vi.fn>;

  function build(): EmployeeWorkQueueStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeDirectoryReadGateway, useValue: { readDirectory } },
        { provide: RuleSystemScopeStore, useValue: { activeCode: scopeCode.asReadonly() } },
      ],
    });
    return TestBed.inject(EmployeeWorkQueueStore);
  }

  beforeEach(() => {
    localStorage.removeItem(EMPLOYEE_WORK_QUEUE_STORAGE_KEY);
    scopeCode.set('ESP');
    list = ['E01', 'E02', 'E03'].map(employee);
    readDirectory = serverWith(() => list);
    store = build();
  });

  afterEach(() => {
    localStorage.removeItem(EMPLOYEE_WORK_QUEUE_STORAGE_KEY);
  });

  it('sin cola no hay nada: ni posición, ni siguiente', () => {
    expect(store.active()).toBe(false);
    expect(store.hasNext()).toBe(false);
  });

  it('entra por el primero con el criterio, y dice «1 de N» con el total del servidor', async () => {
    const first = await store.start({ q: ' sanchez ', status: 'ACTIVE' });

    expect(first?.employeeNumber).toBe('E01');
    expect(store.position()).toBe(1);
    expect(store.total()).toBe(3);
    expect(store.queue()?.criteria).toEqual({ q: 'sanchez', status: 'ACTIVE' });
    expect(readDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'sanchez', status: 'ACTIVE', page: 0, size: 1 }),
    );
  });

  it('siguiente y anterior son un cursor sobre la consulta, y en los extremos se para y avisa', async () => {
    await store.start({ q: '', status: null });

    expect((await store.next())?.employeeNumber).toBe('E02');
    expect((await store.next())?.employeeNumber).toBe('E03');
    expect(store.position()).toBe(3);
    expect(store.hasNext()).toBe(false);

    expect(await store.next()).toBeNull();
    expect(store.notice()).toBe('last');

    expect((await store.previous())?.employeeNumber).toBe('E02');
    expect((await store.previous())?.employeeNumber).toBe('E01');
    expect(await store.previous()).toBeNull();
    expect(store.notice()).toBe('first');
  });

  it('si la cola se mueve bajo los pies, avisa en vez de saltar en silencio', async () => {
    await store.start({ q: '', status: null });
    await store.next(); // en E02

    // Alguien da de baja a E01 mientras se recorre: ahora la posición 1 es E02, no E02→E03.
    list = ['E02', 'E03'].map(employee);

    const target = await store.next();

    expect(store.notice()).toBe('moved');
    expect(target?.employeeNumber).toBe('E03');
    expect(store.total()).toBe(2);
  });

  it('si el propio empleado ya no cumple el criterio, también avisa y sigue sobre lo que hay', async () => {
    await store.start({ q: '', status: null });
    await store.next(); // en E02
    list = ['E01', 'E03'].map(employee);

    const target = await store.next();

    expect(store.notice()).toBe('moved');
    expect(target?.employeeNumber).toBe('E03');
    expect(store.total()).toBe(2);
  });

  it('sobrevive a recargar y muere al cambiar de ámbito', async () => {
    await store.start({ q: 'x', status: null });
    await store.next();

    const reloaded = build();
    expect(reloaded.active()).toBe(true);
    expect(reloaded.position()).toBe(2);
    expect(reloaded.queue()?.currentKey.employeeNumber).toBe('E02');

    scopeCode.set('PRT');
    expect(reloaded.active()).toBe(false);
  });

  it('salir la olvida, también del almacenamiento', async () => {
    await store.start({ q: '', status: null });
    store.leave();

    expect(store.active()).toBe(false);
    expect(localStorage.getItem(EMPLOYEE_WORK_QUEUE_STORAGE_KEY)).toBeNull();
  });

  it('un fallo del servidor no mueve la cola y se dice', async () => {
    await store.start({ q: '', status: null });
    readDirectory.mockImplementation(() => throwError(() => new Error('boom')));

    expect(await store.next()).toBeNull();
    expect(store.notice()).toBe('request-failed');
    expect(store.position()).toBe(1);
  });
});
