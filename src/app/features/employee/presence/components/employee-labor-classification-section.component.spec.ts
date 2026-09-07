import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EmployeeLaborClassificationCatalogGateway } from '../../data-access/employee-labor-classification-catalog.gateway';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeLaborClassificationStore } from '../../data-access/employee-labor-classification.store';
import { EmployeeLaborClassificationModel } from '../../models/employee-labor-classification.model';
import { EmployeeLaborClassificationPlanModel } from '../../models/employee-labor-classification-plan.model';
import { EmployeeLaborClassificationSectionComponent } from './employee-labor-classification-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

const activeClassification: EmployeeLaborClassificationModel = {
  agreementCode: 'AGR1',
  agreementName: null,
  agreementCategoryCode: 'CAT1',
  agreementCategoryName: null,
  startDate: '2024-01-01',
  endDate: null,
  isActive: true,
};

function plan(
  overrides: Partial<EmployeeLaborClassificationPlanModel> = {},
): EmployeeLaborClassificationPlanModel {
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

class MockClassificationStore {
  readonly classificationsState = signal<ReadonlyArray<EmployeeLaborClassificationModel>>([]);
  readonly laborClassifications = this.classificationsState.asReadonly();
  readonly planState = signal<EmployeeLaborClassificationPlanModel | null>(null);
  readonly plan = this.planState.asReadonly();
  readonly planningState = signal(false);
  readonly planning = this.planningState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly error = signal<string | null>(null).asReadonly();
  readonly errorConflict = signal(null).asReadonly();
  readonly successState = signal<'created' | 'corrected' | null>(null);
  readonly success = this.successState.asReadonly();
  readonly loadLaborClassificationsByBusinessKey = vi.fn();
  readonly createLaborClassification = vi.fn();
  readonly correctOccurrence = vi.fn();
  readonly planChange = vi.fn();
  readonly clearPlan = vi.fn();
  readonly clearFeedback = vi.fn();
}

describe('EmployeeLaborClassificationSectionComponent', () => {
  let fix: ComponentFixture<EmployeeLaborClassificationSectionComponent>;
  let store: MockClassificationStore;
  let fieldCatalog: { loadLaborClassificationAgreementOptions: ReturnType<typeof vi.fn> };
  let catalogGateway: { loadAgreementCategories: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = new MockClassificationStore();
    fieldCatalog = {
      loadLaborClassificationAgreementOptions: vi
        .fn()
        .mockReturnValue(of([{ value: 'AGR1', label: 'Convenio 1 · AGR1' }])),
    };
    catalogGateway = {
      loadAgreementCategories: vi.fn().mockReturnValue(
        of([
          {
            code: 'CAT1',
            name: 'Categoria 1',
            label: 'Categoria 1 · CAT1',
            startDate: '2020-01-01',
            endDate: null,
          },
        ]),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [EmployeeLaborClassificationSectionComponent, NoopAnimationsModule],
      providers: [
        { provide: EmployeeLaborClassificationStore, useValue: store },
        { provide: EmployeeFieldCatalogService, useValue: fieldCatalog },
        { provide: EmployeeLaborClassificationCatalogGateway, useValue: catalogGateway },
      ],
    }).compileComponents();

    fix = TestBed.createComponent(EmployeeLaborClassificationSectionComponent);
    fix.componentRef.setInput('employeeBusinessKey', employeeKey);
    fix.detectChanges();
  });

  it('renders period-table with add button', () => {
    expect(fix.nativeElement.querySelector('.section-heading__add-btn')).toBeTruthy();
  });

  it('shows a row per labor classification', () => {
    store.classificationsState.set([activeClassification]);
    fix.detectChanges();
    expect(fix.nativeElement.querySelectorAll('.temporal-section__row').length).toBe(1);
  });

  it('opens the add modal on add click', () => {
    fix.nativeElement.querySelector('.section-heading__add-btn').click();
    fix.detectChanges();
    const c = fix.componentInstance as any;
    expect(c.modalVisible()).toBe(true);
    expect(c.modalMode()).toBe('add');
  });

  it('asks the backend what the change would do before confirming', () => {
    const c = fix.componentInstance as any;
    c.openAdd();
    c.startDateDraft.set('2025-06-01');
    fix.detectChanges();

    expect(store.planChange).toHaveBeenCalledWith(employeeKey, {
      operation: 'ADD',
      startDate: '2025-06-01',
      endDate: null,
    });
  });

  it('adds a labor classification only once the plan accepts it', () => {
    const c = fix.componentInstance as any;
    c.openAdd();
    c.startDateDraft.set('2025-06-01');
    c.agreementCodeDraft.set('AGR1');
    c.agreementCategoryCodeDraft.set('CAT1');

    store.planState.set(plan({ accepted: false, rejection: 'OVERLAP' }));
    expect(c.isSubmitEnabled()).toBe(false);
    c.submit();
    expect(store.createLaborClassification).not.toHaveBeenCalled();

    store.planState.set(plan());
    expect(c.isSubmitEnabled()).toBe(true);
    c.submit();
    expect(store.createLaborClassification).toHaveBeenCalledWith(employeeKey, {
      startDate: '2025-06-01',
      endDate: null,
      agreementCode: 'AGR1',
      agreementCategoryCode: 'CAT1',
    });
  });

  // Aviso 1: mover el inicio se hace, o se explica con fechas y nombrando la vecina que estirar.
  it('explains a start date that would leave a gap, naming the neighbour to stretch', () => {
    store.classificationsState.set([activeClassification]);
    fix.detectChanges();
    const c = fix.componentInstance as any;
    c.openCorrect(0);
    c.startDateDraft.set('2024-03-01');

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

    expect(c.noteTone()).toBe('error');
    expect(c.noteLines()).toEqual([
      'Quedaría un hueco del 1 de enero al 29 de febrero de 2024.',
      'Antes se puede alargar la clasificación laboral del 1 de enero al 31 de diciembre de 2023.',
    ]);
    expect(c.isSubmitEnabled()).toBe(false);
    expect(fix.nativeElement.querySelectorAll('.period-modal__note--error').length).toBe(2);
  });

  it('plans a correction naming the occurrence by the day it starts', () => {
    store.classificationsState.set([activeClassification]);
    fix.detectChanges();
    const c = fix.componentInstance as any;
    c.openCorrect(0);
    c.startDateDraft.set('2024-03-01');
    c.endDateDraft.set('2024-12-31');
    fix.detectChanges();

    expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
      operation: 'CORRECT',
      laborClassificationStartDate: '2024-01-01',
      startDate: '2024-03-01',
      endDate: '2024-12-31',
    });
  });

  // Aviso 2: un alta con inicio coincidente se cuenta como corrección y se confirma sin reteclear.
  it('offers to correct the occurrence an add with a coinciding start date would correct', () => {
    const c = fix.componentInstance as any;
    c.openAdd();
    c.startDateDraft.set('2024-01-01');
    c.agreementCodeDraft.set('AGR1');
    c.agreementCategoryCodeDraft.set('CAT1');

    store.planState.set(
      plan({
        operation: 'CORRECT',
        accepted: false,
        rejection: 'IS_A_CORRECTION',
        correctedOccurrence: { startDate: '2024-01-01', endDate: null },
      }),
    );
    fix.detectChanges();

    expect(c.noteLines()).toEqual([
      'Ya hay una clasificación laboral desde el 1 de enero de 2024 en adelante: esto no es un alta, sino una corrección suya.',
    ]);
    const action = fix.nativeElement.querySelector('.period-modal__note-action');
    expect(action.textContent.trim()).toBe(
      'Corregir la clasificación laboral desde el 1 de enero de 2024',
    );

    action.click();
    fix.detectChanges();

    // Nada que reteclear: el modo cambia y lo escrito se queda.
    expect(c.modalMode()).toBe('correct');
    expect(c.editingStartDate()).toBe('2024-01-01');
    expect(c.startDateDraft()).toBe('2024-01-01');
    expect(c.agreementCodeDraft()).toBe('AGR1');
    expect(c.agreementCategoryCodeDraft()).toBe('CAT1');

    store.planState.set(plan({ operation: 'CORRECT' }));
    c.submit();
    expect(store.correctOccurrence).toHaveBeenCalledWith(employeeKey, '2024-01-01', {
      startDate: '2024-01-01',
      endDate: null,
      agreementCode: 'AGR1',
      agreementCategoryCode: 'CAT1',
    });
  });

  it('says what the add would close while the plan accepts it', () => {
    const c = fix.componentInstance as any;
    c.openAdd();
    store.planState.set(
      plan({
        adjustedOccurrence: {
          before: { startDate: '2024-01-01', endDate: null },
          after: { startDate: '2024-01-01', endDate: '2025-05-31' },
        },
      }),
    );
    fix.detectChanges();

    expect(c.noteTone()).toBe('warning');
    expect(c.noteLines()).toEqual([
      'La clasificación laboral en vigor desde el 1 de enero de 2024 se cerrará el 31 de mayo de 2025.',
    ]);
  });

  it('closes modal when store signals success', () => {
    fix.nativeElement.querySelector('.section-heading__add-btn').click();
    fix.detectChanges();
    const c = fix.componentInstance as any;
    expect(c.modalVisible()).toBe(true);
    store.successState.set('created');
    fix.detectChanges();
    expect(c.modalVisible()).toBe(false);
  });

  it('disables category select when agreement code is empty', () => {
    const c = fix.componentInstance as any;
    c.agreementCodeDraft.set('');
    expect(c.categoryDisabled()).toBe(true);
  });

  it('resets category draft when agreement changes', () => {
    const c = fix.componentInstance as any;
    c.agreementCodeDraft.set('AGR1');
    c.agreementCategoryCodeDraft.set('CAT1');
    c.updateAgreementCode('AGR2');
    expect(c.agreementCategoryCodeDraft()).toBe('');
  });

  it('clears category options on catalog load error', () => {
    const c = fix.componentInstance as any;
    catalogGateway.loadAgreementCategories.mockReturnValue(
      new Observable((subscriber: any) => subscriber.error(new Error('network error'))),
    );
    c.agreementCodeDraft.set('AGR1');
    c.categoryOptionsState.set([{ value: 'CAT1', label: 'Categoria 1' }]);
    c['loadCategoryOptions']('AGR2', null);
    expect(c.categoryOptionsState()).toEqual([]);
    expect(c['categoryLoadingState']()).toBe(false);
  });
});
