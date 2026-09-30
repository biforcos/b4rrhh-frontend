import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RuleSystemScopeStore } from '../../../../core/scope/rule-system-scope.store';
import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { OperacionesStore } from './operaciones.store';

/**
 * Operaciones arranca en el sistema de reglas del ámbito, no en un `'ESP'` escrito a mano
 * (`b4rrhh/frontend#124`): un literal de sistema de reglas en un store miente en cuanto alguien
 * abre la aplicación con otro ámbito.
 */
describe('Operaciones: el sistema de reglas con el que arranca', () => {
  let listEmployeeTypes: ReturnType<typeof vi.fn>;

  function montar(whenResolved: () => Observable<string | null>): OperacionesStore {
    listEmployeeTypes = vi.fn().mockReturnValue(of(['INTERNAL']));
    TestBed.configureTestingModule({
      providers: [
        OperacionesStore,
        {
          provide: OperacionesGateway,
          useValue: {
            listEmployeeTypes,
            launchCalculation: vi.fn(),
            getCalculationRun: vi.fn(),
            bulkInvalidate: vi.fn(),
            bulkFinalize: vi.fn(),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        { provide: RuleSystemScopeStore, useValue: { whenResolved } },
      ],
    });
    return TestBed.inject(OperacionesStore);
  }

  it('con ámbito, arranca en el del ámbito y pide sus tipos de empleado', () => {
    const store = montar(() => of('PRT'));

    expect(store.ruleSystemCode()).toBe('PRT');
    expect(listEmployeeTypes).toHaveBeenCalledWith('PRT');
    expect(listEmployeeTypes).not.toHaveBeenCalledWith('ESP');
  });

  it('sin ámbito, arranca vacío y no pide tipos de un sistema inventado', () => {
    const store = montar(() => of(null));

    expect(store.ruleSystemCode()).toBe('');
    expect(listEmployeeTypes).not.toHaveBeenCalled();
  });

  it('si ya se escribió otro antes de resolverse el ámbito, no lo pisa', () => {
    const scope = new Subject<string | null>();
    const store = montar(() => scope);

    store.setRuleSystemCode('FRA');
    scope.next('PRT');
    scope.complete();

    expect(store.ruleSystemCode()).toBe('FRA');
  });

  it('el store no lleva ningún sistema de reglas escrito a mano', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/features/nomina/operaciones/store/operaciones.store.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/['"]ESP['"]/);
  });
});
