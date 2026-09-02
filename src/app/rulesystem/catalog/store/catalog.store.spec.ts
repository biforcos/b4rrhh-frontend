import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CatalogGateway } from '../gateway/catalog.gateway';
import { RuleEntityModel } from '../models/rule-entity.model';
import { CatalogStore } from './catalog.store';

const activeOccurrence: RuleEntityModel = {
  occurrenceKey: 'IND|2026-01-01',
  ruleSystemCode: 'PA-ES',
  ruleEntityTypeCode: 'CONTRACT',
  code: 'IND',
  name: 'Indefinido',
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
  ruleEntityTypeCode: 'CONTRACT',
  code: 'TMP',
  name: 'Temporal',
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
      loadRuleEntityTypes: vi.fn().mockReturnValue(of([{ code: 'CONTRACT', name: 'Contract' }])),
      loadRuleEntities: vi.fn().mockReturnValue(of([activeOccurrence, closedOccurrence])),
      createRuleEntity: vi.fn().mockReturnValue(of(activeOccurrence)),
      correctRuleEntityByBusinessKey: vi.fn().mockReturnValue(of(activeOccurrence)),
      closeRuleEntityByBusinessKey: vi
        .fn()
        .mockReturnValue(of({ ...activeOccurrence, active: false })),
      deleteRuleEntityByBusinessKey: vi.fn().mockReturnValue(of(void 0)),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: CatalogGateway, useValue: gatewayMock }],
    });

    store = TestBed.inject(CatalogStore);
    store.initialize();
  });

  it('initializes selected rule system and type with first available values', () => {
    expect(store.selectedRuleSystemCode()).toBe('PA-ES');
    expect(store.selectedRuleEntityTypeCode()).toBe('CONTRACT');
    expect(gatewayMock.loadRuleEntities).toHaveBeenCalledWith('PA-ES', 'CONTRACT');
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
