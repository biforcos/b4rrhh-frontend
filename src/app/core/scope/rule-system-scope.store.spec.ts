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

  it('con varios, van por código y el ámbito es el primero; elegir otro lo recuerda aunque el desplegable no se ofrezca todavía', () => {
    const store = setup([PRT, ESP]);

    expect(store.items().map((item) => item.code)).toEqual(['ESP', 'PRT']);
    // Inerte hasta la fase 5: hay varios, pero no se ofrece elegir (ver el store).
    expect(store.selectable()).toBe(false);
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

  describe('con qué sistema arranca una pantalla con selector propio (frontend#124)', () => {
    it('con ámbito, arranca en el ámbito aunque la pantalla lo reciba detrás de otro', () => {
      const store = setup([ESP, PRT]);

      expect(store.initialCodeAmong(['FRA', 'ESP'])).toBe('ESP');
    });

    it('sin ámbito, arranca en el primero que ofrece la pantalla', () => {
      const store = setup([]);

      expect(store.initialCodeAmong(['FRA', 'ESP'])).toBe('FRA');
    });

    it('si la pantalla no ofrece el ámbito, arranca en el primero que ofrece', () => {
      const store = setup([ESP, PRT]);

      expect(store.initialCodeAmong(['FRA', 'PRT'])).toBe('FRA');
    });

    it('sin nada que ofrecer, no arranca en ninguno', () => {
      expect(setup([ESP]).initialCodeAmong([])).toBeNull();
    });

    it('avisa cuando el ámbito está resuelto, con él, y también si la carga falla', () => {
      const resolved: Array<string | null> = [];
      setup([PRT, ESP])
        .whenResolved()
        .subscribe((code) => resolved.push(code));

      TestBed.resetTestingModule();
      loadRuleSystems = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
      TestBed.configureTestingModule({
        providers: [{ provide: RuleSystemGateway, useValue: { loadRuleSystems } }],
      });
      const failing = TestBed.inject(RuleSystemScopeStore);
      failing.whenResolved().subscribe((code) => resolved.push(code));
      expect(resolved).toEqual(['ESP']);

      failing.load();

      expect(resolved).toEqual(['ESP', null]);
    });
  });
});
