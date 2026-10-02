import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import {
  RULE_SYSTEM_SCOPE_STORAGE_KEY,
  RuleSystemScopeStore,
} from '../../../core/scope/rule-system-scope.store';
import { RuleSystemGateway } from '../../rule-system/gateway/rule-system.gateway';
import { CatalogGateway } from '../gateway/catalog.gateway';
import { RuleEntityModel } from '../models/rule-entity.model';
import { CatalogStore } from './catalog.store';

const activeOccurrence: RuleEntityModel = {
  occurrenceKey: 'IND|2026-01-01',
  ruleSystemCode: 'PA-ES',
  layerCode: 'PA-ES',
  level: 3,
  definedIn: null,
  ruleEntityTypeCode: 'CONTRACT',
  code: 'IND',
  name: 'Indefinido',
  translatedLabel: null,
  description: 'Contrato estable',
  active: true,
  startDate: '2026-01-01',
  endDate: null,
  canCorrect: true,
  canClose: true,
  canDelete: true,
};

const closedOccurrence: RuleEntityModel = {
  occurrenceKey: 'TMP|2025-01-01',
  ruleSystemCode: 'PA-ES',
  layerCode: 'PA-ES',
  level: 3,
  definedIn: null,
  ruleEntityTypeCode: 'CONTRACT',
  code: 'TMP',
  name: 'Temporal',
  translatedLabel: null,
  description: null,
  active: false,
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  canCorrect: true,
  canClose: false,
  canDelete: true,
};

describe('CatalogStore', () => {
  let store: CatalogStore;
  let gatewayMock: {
    loadRuleSystems: ReturnType<typeof vi.fn>;
    loadRuleEntityTypes: ReturnType<typeof vi.fn>;
    loadRuleEntities: ReturnType<typeof vi.fn>;
    createRuleEntity: ReturnType<typeof vi.fn>;
    correctRuleEntityByBusinessKey: ReturnType<typeof vi.fn>;
    closeRuleEntityByBusinessKey: ReturnType<typeof vi.fn>;
    deleteRuleEntityByBusinessKey: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      loadRuleSystems: vi.fn().mockReturnValue(of([{ code: 'PA-ES', name: 'Personnel ES' }])),
      loadRuleEntityTypes: vi.fn().mockReturnValue(
        of([
          { code: 'CONTRACT', name: 'Contract', level: 3 },
          { code: 'COUNTRY', name: 'Country', level: 2 },
        ]),
      ),
      loadRuleEntities: vi.fn().mockReturnValue(of([activeOccurrence, closedOccurrence])),
      createRuleEntity: vi.fn().mockReturnValue(of(activeOccurrence)),
      correctRuleEntityByBusinessKey: vi.fn().mockReturnValue(of(activeOccurrence)),
      closeRuleEntityByBusinessKey: vi
        .fn()
        .mockReturnValue(of({ ...activeOccurrence, active: false })),
      deleteRuleEntityByBusinessKey: vi.fn().mockReturnValue(of(void 0)),
    };

    store = setupWithScope([]);
    store.initialize();
  });

  /** El ámbito, cargado de verdad: el criterio de arranque vive en su store (frontend#124). */
  function setupWithScope(scopeCodes: ReadonlyArray<string>): CatalogStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogGateway, useValue: gatewayMock },
        {
          provide: RuleSystemGateway,
          useValue: {
            loadRuleSystems: vi
              .fn()
              .mockReturnValue(
                of(
                  scopeCodes.map((code) => ({ code, name: code, countryCode: 'XX', active: true })),
                ),
              ),
          },
        },
      ],
    });
    TestBed.inject(RuleSystemScopeStore).load();
    return TestBed.inject(CatalogStore);
  }

  it('initializes selected rule system and type with first available values', () => {
    expect(store.selectedRuleSystemCode()).toBe('PA-ES');
    expect(store.selectedRuleEntityTypeCode()).toBe('CONTRACT');
    expect(gatewayMock.loadRuleEntities).toHaveBeenCalledWith('PA-ES', 'CONTRACT');
  });

  describe('sistema de reglas con el que arranca (frontend#124)', () => {
    beforeEach(() => {
      localStorage.removeItem(RULE_SYSTEM_SCOPE_STORAGE_KEY);
      gatewayMock.loadRuleSystems.mockReturnValue(
        of([
          { code: 'FRA', name: 'France' },
          { code: 'ESP', name: 'Administración de personal' },
        ]),
      );
    });

    it('con ámbito, arranca en el del ámbito y no en el primero que llega', () => {
      const scoped = setupWithScope(['ESP', 'FRA']);

      scoped.initialize();

      expect(scoped.selectedRuleSystemCode()).toBe('ESP');
      expect(gatewayMock.loadRuleEntities).toHaveBeenLastCalledWith('ESP', 'CONTRACT');
    });

    it('sin ámbito, arranca en el primero que llega', () => {
      const unscoped = setupWithScope([]);

      unscoped.initialize();

      expect(unscoped.selectedRuleSystemCode()).toBe('FRA');
    });

    it('espera a que el ámbito esté resuelto antes de elegir', () => {
      const pending = new Subject<ReadonlyArray<unknown>>();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: CatalogGateway, useValue: gatewayMock },
          { provide: RuleSystemGateway, useValue: { loadRuleSystems: () => pending } },
        ],
      });
      TestBed.inject(RuleSystemScopeStore).load();
      const waiting = TestBed.inject(CatalogStore);

      waiting.initialize();
      expect(waiting.selectedRuleSystemCode()).toBeNull();

      pending.next([{ code: 'ESP', name: 'España', countryCode: 'ES', active: true }]);
      pending.complete();

      expect(waiting.selectedRuleSystemCode()).toBe('ESP');
    });
  });

  // frontend#127: se crea en su capa. Un país dado de alta desde ESP iría a INT, que también
  // montan FRA y PRT; sólo un tipo nacional ofrece el alta.
  it('offers creation only for a national type', () => {
    expect(store.selectedRuleEntityTypeLevel()).toBe(3);
    expect(store.canCreateInSelectedType()).toBe(true);

    store.selectRuleEntityType('COUNTRY');

    expect(store.selectedRuleEntityTypeLevel()).toBe(2);
    expect(store.canCreateInSelectedType()).toBe(false);
  });

  it('submits correct operation over same occurrence business key', () => {
    store.startCorrect(activeOccurrence.occurrenceKey);
    store.updateCorrectDraft('name', 'Indefinido actualizado');
    store.updateCorrectDraft('description', '  Ajustado  ');
    store.updateCorrectDraft('endDate', '2026-12-31');

    store.submitCorrect();

    expect(gatewayMock.correctRuleEntityByBusinessKey).toHaveBeenCalledWith(
      {
        ruleSystemCode: 'PA-ES',
        ruleEntityTypeCode: 'CONTRACT',
        code: 'IND',
        startDate: '2026-01-01',
      },
      {
        name: 'Indefinido actualizado',
        description: 'Ajustado',
        endDate: '2026-12-31',
      },
    );
  });

  it('submits close operation with selected endDate', () => {
    store.requestClose(activeOccurrence.occurrenceKey);
    store.updateCloseEndDate('2026-08-01');

    store.confirmClose();

    expect(gatewayMock.closeRuleEntityByBusinessKey).toHaveBeenCalledWith(
      {
        ruleSystemCode: 'PA-ES',
        ruleEntityTypeCode: 'CONTRACT',
        code: 'IND',
        startDate: '2026-01-01',
      },
      { endDate: '2026-08-01' },
    );
  });

  it('shows clear conflict message when backend rejects delete with 409', () => {
    gatewayMock.deleteRuleEntityByBusinessKey.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { message: 'RULE_ENTITY_IN_USE' } }),
      ),
    );

    store.requestDelete(closedOccurrence.occurrenceKey);
    store.confirmDelete();

    expect(store.errorMessage()).toContain('conflicto');
    expect(store.errorMessage()).toContain('RULE_ENTITY_IN_USE');
  });
});
