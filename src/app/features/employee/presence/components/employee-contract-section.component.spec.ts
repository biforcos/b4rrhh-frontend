import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EmployeeContractCatalogGateway } from '../../data-access/employee-contract-catalog.gateway';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeContractStore } from '../../data-access/employee-contract.store';
import { EmployeeContractModel } from '../../models/employee-contract.model';
import { EmployeeContractSectionComponent } from './employee-contract-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

class MockContractStore {
  readonly contractsState = signal<ReadonlyArray<EmployeeContractModel>>([]);
  readonly contracts = this.contractsState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly error = signal<string | null>(null).asReadonly();
  readonly success = signal<'replaced' | 'corrected' | 'closed' | null>(null).asReadonly();
  readonly loadContractsByBusinessKey = vi.fn();
  readonly replaceFromDate = vi.fn();
  readonly correctOccurrence = vi.fn();
  readonly closeOccurrence = vi.fn();
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
      loadContractSubtypes: vi
        .fn()
        .mockReturnValue(
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
    store.contractsState.set([
      {
        contractCode: 'PERM',
        contractSubtypeCode: 'PERM-FULL',
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
    const component = fix.componentInstance as any;
    expect(component.modalVisible()).toBe(true);
    expect(component.modalMode()).toBe('create');
  });

  it('calls replaceFromDate on create submit', () => {
    const component = fix.componentInstance as any;
    component.modalMode.set('create');
    component.effectiveDateDraft.set('2025-06-01');
    component.contractCodeDraft.set('PERM');
    component.contractSubtypeCodeDraft.set('PERM-FULL');
    component.submit();
    expect(store.replaceFromDate).toHaveBeenCalledWith(employeeKey, {
      effectiveDate: '2025-06-01',
      contractCode: 'PERM',
      contractSubtypeCode: 'PERM-FULL',
    });
  });

  it('calls correctOccurrence on edit submit', () => {
    store.contractsState.set([
      {
        contractCode: 'PERM',
        contractSubtypeCode: 'PERM-FULL',
        startDate: '2024-01-01',
        endDate: null,
        isActive: true,
      },
    ]);
    fix.detectChanges();
    const component = fix.componentInstance as any;
    component.openEdit(0);
    component.contractCodeDraft.set('TEMP');
    component.contractSubtypeCodeDraft.set('TEMP-EVT');
    component.submit();
    expect(store.correctOccurrence).toHaveBeenCalledWith(employeeKey, '2024-01-01', {
      startDate: '2024-01-01',
      contractCode: 'TEMP',
      contractSubtypeCode: 'TEMP-EVT',
    });
  });

  it('calls closeOccurrence after switchToClose', () => {
    store.contractsState.set([
      {
        contractCode: 'PERM',
        contractSubtypeCode: null,
        startDate: '2024-01-01',
        endDate: null,
        isActive: true,
      },
    ]);
    fix.detectChanges();
    const component = fix.componentInstance as any;
    component.openEdit(0);
    component.switchToClose();
    component.endDateDraft.set('2025-12-31');
    component.submit();
    expect(store.closeOccurrence).toHaveBeenCalledWith(employeeKey, '2024-01-01', {
      endDate: '2025-12-31',
    });
  });

  it('disables subtype select when contract code is empty', () => {
    const component = fix.componentInstance as any;
    component.modalMode.set('create');
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
    // Override gateway to simulate error
    catalogGateway.loadContractSubtypes.mockReturnValue(
      new Observable((subscriber: any) => subscriber.error(new Error('network error'))),
    );
    component.contractCodeDraft.set('PERM');
    component.subtypeOptionsState.set([{ value: 'PERM-FULL', label: 'Full' }]); // pre-set stale options
    component['loadSubtypeOptions']('TEMP', null, null);
    // Options must be cleared even on error
    expect(component.subtypeOptionsState()).toEqual([]);
  });
});
