import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RULE_SYSTEM_SCOPE_STORAGE_KEY,
  RuleSystemScopeStore,
} from '../../../core/scope/rule-system-scope.store';
import { RuleSystemGateway } from '../../rule-system/gateway/rule-system.gateway';
import { AgreementCategoryProfileGateway } from '../gateway/agreement-category-profile.gateway';
import { AgreementCategoryProfileStore } from './agreement-category-profile.store';

describe('AgreementCategoryProfileStore — sistema de reglas con el que arranca (frontend#124)', () => {
  let gatewayMock: {
    loadRuleSystems: ReturnType<typeof vi.fn>;
    loadAgreements: ReturnType<typeof vi.fn>;
    loadGrupoCotizacion: ReturnType<typeof vi.fn>;
  };

  function setup(scopeCodes: ReadonlyArray<string>): AgreementCategoryProfileStore {
    gatewayMock = {
      loadRuleSystems: vi.fn().mockReturnValue(
        of([
          { code: 'FRA', name: 'France' },
          { code: 'ESP', name: 'Administración de personal' },
        ]),
      ),
      loadAgreements: vi.fn().mockReturnValue(of([])),
      loadGrupoCotizacion: vi.fn().mockReturnValue(of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AgreementCategoryProfileGateway, useValue: gatewayMock },
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
    return TestBed.inject(AgreementCategoryProfileStore);
  }

  beforeEach(() => localStorage.removeItem(RULE_SYSTEM_SCOPE_STORAGE_KEY));

  it('con ámbito, arranca en el del ámbito y carga sus convenios', () => {
    const store = setup(['ESP', 'FRA']);

    store.initialize();

    expect(store.selectedRuleSystemCode()).toBe('ESP');
    expect(gatewayMock.loadAgreements).toHaveBeenCalledWith('ESP');
  });

  it('sin ámbito, arranca en el primero que llega', () => {
    const store = setup([]);

    store.initialize();

    expect(store.selectedRuleSystemCode()).toBe('FRA');
  });
});
