import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RuleSystemGateway } from '../../rulesystem/rule-system/gateway/rule-system.gateway';
import { RuleSystem } from '../../rulesystem/rule-system/models/rule-system.model';
import { RULE_SYSTEM_SCOPE_STORAGE_KEY, RuleSystemScopeStore } from './rule-system-scope.store';

const ESP: RuleSystem = { code: 'ESP', name: 'España', countryCode: 'ES', active: true };
const PRT: RuleSystem = { code: 'PRT', name: 'Portugal', countryCode: 'PT', active: true };
const OLD: RuleSystem = { code: 'OLD', name: 'Retirado', countryCode: 'ES', active: false };

describe('RuleSystemScopeStore', () => {
  let loadRuleSystems: ReturnType<typeof vi.fn>;

  function setup(items: ReadonlyArray<RuleSystem>): RuleSystemScopeStore {
    loadRuleSystems = vi.fn().mockReturnValue(of(items));
    TestBed.configureTestingModule({
      providers: [{ provide: RuleSystemGateway, useValue: { loadRuleSystems } }],
    });
    const store = TestBed.inject(RuleSystemScopeStore);
    store.load();
    return store;
  }

  beforeEach(() => localStorage.removeItem(RULE_SYSTEM_SCOPE_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(RULE_SYSTEM_SCOPE_STORAGE_KEY));

  it('con un solo sistema activo lo toma como ámbito y no es seleccionable', () => {
    const store = setup([ESP, OLD]);

    expect(store.items()).toEqual([ESP]);
    expect(store.active()).toEqual(ESP);
    expect(store.selectable()).toBe(false);
  });

  it('con varios, van por código, el ámbito es el primero y se puede elegir otro, que queda recordado', () => {
    const store = setup([PRT, ESP]);

    expect(store.items().map((item) => item.code)).toEqual(['ESP', 'PRT']);
    expect(store.selectable()).toBe(true);
    expect(store.activeCode()).toBe('ESP');

    store.select('PRT');

    expect(store.active()).toEqual(PRT);
    expect(localStorage.getItem(RULE_SYSTEM_SCOPE_STORAGE_KEY)).toBe('PRT');
  });

  it('recupera el ámbito recordado si sigue existiendo, y si no, vuelve al primero', () => {
    localStorage.setItem(RULE_SYSTEM_SCOPE_STORAGE_KEY, 'PRT');
    expect(setup([ESP, PRT]).activeCode()).toBe('PRT');

    TestBed.resetTestingModule();
    localStorage.setItem(RULE_SYSTEM_SCOPE_STORAGE_KEY, 'XXX');
    expect(setup([ESP, PRT]).activeCode()).toBe('ESP');
  });

  it('ignora un código que no está en la lista', () => {
    const store = setup([ESP, PRT]);

    store.select('XXX');

    expect(store.activeCode()).toBe('ESP');
    expect(localStorage.getItem(RULE_SYSTEM_SCOPE_STORAGE_KEY)).toBeNull();
  });

  it('si la carga falla lo dice y no deja ámbito', () => {
    loadRuleSystems = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
    TestBed.configureTestingModule({
      providers: [{ provide: RuleSystemGateway, useValue: { loadRuleSystems } }],
    });
    const store = TestBed.inject(RuleSystemScopeStore);

    store.load();

    expect(store.error()).toBe(true);
    expect(store.active()).toBeNull();
    expect(store.loading()).toBe(false);
  });
});
