import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EmployeeContractCatalogGateway } from '../../data-access/employee-contract-catalog.gateway';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeContractStore } from '../../data-access/employee-contract.store';
import { EmployeeContractModel } from '../../models/employee-contract.model';
import { EmployeeContractPlanModel } from '../../models/employee-contract-plan.model';
import { EmployeeContractSectionComponent } from './employee-contract-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

const activeContract: EmployeeContractModel = {
  contractCode: 'PERM',
  contractSubtypeCode: 'PERM-FULL',
  startDate: '2024-01-01',
  endDate: null,
  isActive: true,
};

function plan(overrides: Partial<EmployeeContractPlanModel> = {}): EmployeeContractPlanModel {
  return {
    operation: 'ADD',
    accepted: true,
    rejection: null,
    occurrence: { startDate: '2025-06-01', endDate: null },
    correctedOccurrence: null,
    adjustedOccurrence: null,
    overlaps: [],
    gaps: [],
    stretchCandidates: [],
    projected: [],
    ...overrides,
  };
}

class MockContractStore {
  readonly contractsState = signal<ReadonlyArray<EmployeeContractModel>>([]);
  readonly contracts = this.contractsState.asReadonly();
  readonly planState = signal<EmployeeContractPlanModel | null>(null);
  readonly plan = this.planState.asReadonly();
  readonly planningState = signal(false);
  readonly planning = this.planningState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly error = signal<string | null>(null).asReadonly();
  readonly errorConflict = signal(null).asReadonly();
  readonly success = signal<'created' | 'corrected' | null>(null).asReadonly();
  readonly loadContractsByBusinessKey = vi.fn();
  readonly createContract = vi.fn();
  readonly correctOccurrence = vi.fn();
  readonly planChange = vi.fn();
  readonly clearPlan = vi.fn();
  readonly clearFeedback = vi.fn();
}

describe('EmployeeContractSectionComponent', () => {
  let fix: ComponentFixture<EmployeeContractSectionComponent>;
  let store: MockContractStore;
  let fieldCatalog: { loadContractTypeOptions: ReturnType<typeof vi.fn> };
  let catalogGateway: { loadContractSubtypes: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = new MockContractStore();
    fieldCatalog = {
      loadContractTypeOptions: vi
        .fn()
        .mockReturnValue(of([{ value: 'PERM', label: 'Indefinido' }])),
    };
    catalogGateway = {
      loadContractSubtypes: vi.fn().mockReturnValue(
        of([
          {
            code: 'PERM-FULL',
            label: 'Full · PERM-FULL',
            name: 'Full',
            startDate: '2020-01-01',
            endDate: null,
          },
        ]),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [EmployeeContractSectionComponent, NoopAnimationsModule],
      providers: [
        { provide: EmployeeContractStore, useValue: store },
        { provide: EmployeeFieldCatalogService, useValue: fieldCatalog },
        { provide: EmployeeContractCatalogGateway, useValue: catalogGateway },
      ],
    }).compileComponents();

    fix = TestBed.createComponent(EmployeeContractSectionComponent);
    fix.componentRef.setInput('employeeBusinessKey', employeeKey);
    fix.detectChanges();
  });

  it('renders period-table with add button', () => {
    expect(fix.nativeElement.querySelector('.temporal-section__add-btn')).toBeTruthy();
  });

  it('shows a row per contract', () => {
    store.contractsState.set([activeContract]);
    fix.detectChanges();
    expect(fix.nativeElement.querySelectorAll('.temporal-section__row').length).toBe(1);
  });

  it('opens the add modal on add click', () => {
    fix.nativeElement.querySelector('.temporal-section__add-btn').click();
    fix.detectChanges();
    const component = fix.componentInstance as any;
    expect(component.modalVisible()).toBe(true);
    expect(component.modalMode()).toBe('add');
  });

  it('asks the backend what the change would do before confirming', () => {
    const component = fix.componentInstance as any;
    component.openAdd();
    component.startDateDraft.set('2025-06-01');
    fix.detectChanges();

    expect(store.planChange).toHaveBeenCalledWith(employeeKey, {
      operation: 'ADD',
      startDate: '2025-06-01',
      endDate: null,
    });
  });

  it('adds a contract only once the plan accepts it', () => {
    const component = fix.componentInstance as any;
    component.openAdd();
    component.startDateDraft.set('2025-06-01');
    component.contractCodeDraft.set('PERM');
    component.contractSubtypeCodeDraft.set('PERM-FULL');

    store.planState.set(plan({ accepted: false, rejection: 'OVERLAP' }));
    expect(component.isSubmitEnabled()).toBe(false);
    component.submit();
    expect(store.createContract).not.toHaveBeenCalled();

    store.planState.set(plan());
    expect(component.isSubmitEnabled()).toBe(true);
    component.submit();
    expect(store.createContract).toHaveBeenCalledWith(employeeKey, {
      startDate: '2025-06-01',
      endDate: null,
      contractCode: 'PERM',
      contractSubtypeCode: 'PERM-FULL',
    });
  });

  // Aviso 1: mover el inicio se hace, o se explica con fechas y nombrando la vecina que estirar.
  it('explains a start date that would leave a gap, naming the neighbour to stretch', () => {
    store.contractsState.set([activeContract]);
    fix.detectChanges();
    const component = fix.componentInstance as any;
    component.openCorrect(0);
    component.startDateDraft.set('2024-03-01');

    store.planState.set(
      plan({
        operation: 'CORRECT',
        accepted: false,
        rejection: 'GAP_NOT_ALLOWED',
        gaps: [{ startDate: '2024-01-01', endDate: '2024-02-29' }],
        stretchCandidates: [{ startDate: '2023-01-01', endDate: '2023-12-31' }],
      }),
    );
    fix.detectChanges();

    expect(component.noteTone()).toBe('error');
    expect(component.noteLines()).toEqual([
      'Quedaría un hueco del 1 de enero al 29 de febrero de 2024.',
      'Antes se puede alargar el contrato del 1 de enero al 31 de diciembre de 2023.',
    ]);
    expect(component.isSubmitEnabled()).toBe(false);
    const notes = fix.nativeElement.querySelectorAll('.period-modal__note--error');
    expect(notes.length).toBe(2);
  });

  it('plans a correction naming the contract by the day it starts', () => {
    store.contractsState.set([activeContract]);
    fix.detectChanges();
    const component = fix.componentInstance as any;
    component.openCorrect(0);
    component.startDateDraft.set('2024-03-01');
    component.endDateDraft.set('2024-12-31');
    fix.detectChanges();

    expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
      operation: 'CORRECT',
      contractStartDate: '2024-01-01',
      startDate: '2024-03-01',
      endDate: '2024-12-31',
    });
  });

  // Aviso 2: un alta con inicio coincidente se cuenta como corrección y se confirma sin reteclear.
  it('offers to correct the contract an add with a coinciding start date would correct', () => {
    const component = fix.componentInstance as any;
    component.openAdd();
    component.startDateDraft.set('2024-01-01');
    component.contractCodeDraft.set('PERM');
    component.contractSubtypeCodeDraft.set('PERM-FULL');

    store.planState.set(
      plan({
        operation: 'CORRECT',
        accepted: false,
        rejection: 'IS_A_CORRECTION',
        correctedOccurrence: { startDate: '2024-01-01', endDate: null },
      }),
    );
    fix.detectChanges();

    expect(component.noteLines()).toEqual([
      'Ya hay un contrato desde el 1 de enero de 2024 en adelante: esto no es un alta, sino una corrección suya.',
    ]);
    const action = fix.nativeElement.querySelector('.period-modal__note-action');
    expect(action.textContent.trim()).toBe('Corregir el contrato desde el 1 de enero de 2024');

    action.click();
    fix.detectChanges();

    // Nada que reteclear: el modo cambia y lo escrito se queda.
    expect(component.modalMode()).toBe('correct');
    expect(component.editingStartDate()).toBe('2024-01-01');
    expect(component.startDateDraft()).toBe('2024-01-01');
    expect(component.contractCodeDraft()).toBe('PERM');
    expect(component.contractSubtypeCodeDraft()).toBe('PERM-FULL');

    store.planState.set(plan({ operation: 'CORRECT' }));
    component.submit();
    expect(store.correctOccurrence).toHaveBeenCalledWith(employeeKey, '2024-01-01', {
      startDate: '2024-01-01',
      endDate: null,
      contractCode: 'PERM',
      contractSubtypeCode: 'PERM-FULL',
    });
  });

  it('says what the add would close while the plan accepts it', () => {
    const component = fix.componentInstance as any;
    component.openAdd();
    store.planState.set(
      plan({
        adjustedOccurrence: {
          before: { startDate: '2024-01-01', endDate: null },
          after: { startDate: '2024-01-01', endDate: '2025-05-31' },
        },
      }),
    );
    fix.detectChanges();

    expect(component.noteTone()).toBe('warning');
    expect(component.noteLines()).toEqual([
      'El contrato en vigor desde el 1 de enero de 2024 se cerrará el 31 de mayo de 2025.',
    ]);
  });

  it('says it is still working out what would change', () => {
    const component = fix.componentInstance as any;
    component.openAdd();
    store.planningState.set(true);
    expect(component.noteLines()).toEqual(['Calculando qué cambiaría…']);
  });

  it('disables subtype select when contract code is empty', () => {
    const component = fix.componentInstance as any;
    component.contractCodeDraft.set('');
    expect(component.subtypeDisabled()).toBe(true);
  });

  it('resets subtype draft and options when contract type changes', () => {
    const component = fix.componentInstance as any;
    component.contractCodeDraft.set('PERM');
    component.contractSubtypeCodeDraft.set('PERM-FULL');
    component.updateContractCode('TEMP');
    expect(component.contractSubtypeCodeDraft()).toBe('');
  });

  it('clears subtype options on catalog load error', () => {
    const component = fix.componentInstance as any;
    catalogGateway.loadContractSubtypes.mockReturnValue(
      new Observable((subscriber: any) => subscriber.error(new Error('network error'))),
    );
    component.contractCodeDraft.set('PERM');
    component.subtypeOptionsState.set([{ value: 'PERM-FULL', label: 'Full' }]);
    component['loadSubtypeOptions']('TEMP', null);
    expect(component.subtypeOptionsState()).toEqual([]);
  });
});
