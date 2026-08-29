import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EmployeeLaborClassificationCatalogGateway } from '../../data-access/employee-labor-classification-catalog.gateway';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeLaborClassificationStore } from '../../data-access/employee-labor-classification.store';
import { EmployeeLaborClassificationModel } from '../../models/employee-labor-classification.model';
import { EmployeeLaborClassificationSectionComponent } from './employee-labor-classification-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

class MockClassificationStore {
  readonly classificationsState = signal<ReadonlyArray<EmployeeLaborClassificationModel>>([]);
  readonly laborClassifications = this.classificationsState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly successState = signal<'replaced' | 'corrected' | 'closed' | null>(null);
  readonly success = this.successState.asReadonly();
  readonly loadLaborClassificationsByBusinessKey = vi.fn();
  readonly replaceFromDate = vi.fn();
  readonly correctOccurrence = vi.fn();
  readonly closeOccurrence = vi.fn();
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
    expect(fix.nativeElement.querySelector('.temporal-section__add-btn')).toBeTruthy();
  });

  it('shows a row per classification', () => {
    store.classificationsState.set([
      {
        agreementCode: 'AGR1',
        agreementName: null,
        agreementCategoryCode: 'CAT1',
        agreementCategoryName: null,
        startDate: '2024-01-01',
        endDate: null,
        isActive: true,
      },
    ]);
    fix.detectChanges();
    expect(fix.nativeElement.querySelectorAll('.temporal-section__row').length).toBe(1);
  });

  it('opens create modal on add click', () => {
    fix.nativeElement.querySelector('.temporal-section__add-btn').click();
    fix.detectChanges();
    const c = fix.componentInstance as any;
    expect(c.modalVisible()).toBe(true);
    expect(c.modalMode()).toBe('create');
  });

  it('calls replaceFromDate on create submit', () => {
    const c = fix.componentInstance as any;
    c.modalMode.set('create');
    c.effectiveDateDraft.set('2025-06-01');
    c.agreementCodeDraft.set('AGR1');
    c.agreementCategoryCodeDraft.set('CAT1');
    c.submit();
    expect(store.replaceFromDate).toHaveBeenCalledWith(employeeKey, {
      effectiveDate: '2025-06-01',
      agreementCode: 'AGR1',
      agreementCategoryCode: 'CAT1',
    });
  });

  it('calls correctOccurrence on edit submit', () => {
    store.classificationsState.set([
      {
        agreementCode: 'AGR1',
        agreementName: null,
        agreementCategoryCode: 'CAT1',
        agreementCategoryName: null,
        startDate: '2024-01-01',
        endDate: null,
        isActive: true,
      },
    ]);
    fix.detectChanges();
    const c = fix.componentInstance as any;
    c.openEdit(0);
    c.agreementCodeDraft.set('AGR2');
    c.agreementCategoryCodeDraft.set('CAT2');
    c.submit();
    expect(store.correctOccurrence).toHaveBeenCalledWith(employeeKey, '2024-01-01', {
      startDate: '2024-01-01',
      agreementCode: 'AGR2',
      agreementCategoryCode: 'CAT2',
    });
  });

  it('calls closeOccurrence after switchToClose', () => {
    store.classificationsState.set([
      {
        agreementCode: 'AGR1',
        agreementName: null,
        agreementCategoryCode: 'CAT1',
        agreementCategoryName: null,
        startDate: '2024-01-01',
        endDate: null,
        isActive: true,
      },
    ]);
    fix.detectChanges();
    const c = fix.componentInstance as any;
    c.openEdit(0);
    c.switchToClose();
    c.endDateDraft.set('2025-12-31');
    c.submit();
    expect(store.closeOccurrence).toHaveBeenCalledWith(employeeKey, '2024-01-01', {
      endDate: '2025-12-31',
    });
  });

  it('closes modal when store signals success', async () => {
    fix.nativeElement.querySelector('.temporal-section__add-btn').click();
    fix.detectChanges();
    const c = fix.componentInstance as any;
    expect(c.modalVisible()).toBe(true);
    store.successState.set('replaced');
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
    c['loadCategoryOptions']('AGR2', null, null);
    expect(c.categoryOptionsState()).toEqual([]);
    expect(c['categoryLoadingState']()).toBe(false);
  });
});
