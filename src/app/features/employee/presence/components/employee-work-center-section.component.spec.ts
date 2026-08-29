import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeWorkCenterModel } from '../../models/employee-work-center.model';
import { EmployeeWorkCenterSectionComponent } from './employee-work-center-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

const wc = (overrides: Partial<EmployeeWorkCenterModel> = {}): EmployeeWorkCenterModel => ({
  workCenterAssignmentNumber: 1, workCenterCode: 'WC1', workCenterName: 'Centro 1',
  startDate: '2024-01-01', endDate: null, isActive: true, canDelete: false,
  startsAtPresenceStart: false, deleteForbiddenReason: null, ...overrides,
});

class MockWorkCenterStore {
  readonly workCentersState = signal<ReadonlyArray<EmployeeWorkCenterModel>>([]);
  readonly workCenters = this.workCentersState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly successState = signal<'created' | 'corrected' | 'closed' | 'deleted' | null>(null);
  readonly success = this.successState.asReadonly();
  readonly loadWorkCenters = vi.fn();
  readonly createWorkCenter = vi.fn();
  readonly correctWorkCenter = vi.fn();
  readonly closeWorkCenter = vi.fn();
  readonly deleteWorkCenter = vi.fn();
  readonly clearFeedback = vi.fn();
}

describe('EmployeeWorkCenterSectionComponent', () => {
  let fix: ComponentFixture<EmployeeWorkCenterSectionComponent>;
  let store: MockWorkCenterStore;
  let fieldCatalog: { loadWorkCenterOptions: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = new MockWorkCenterStore();
    fieldCatalog = { loadWorkCenterOptions: vi.fn().mockReturnValue(of([{ value: 'WC1', label: 'Centro 1' }])) };

    await TestBed.configureTestingModule({
      imports: [EmployeeWorkCenterSectionComponent, NoopAnimationsModule],
      providers: [
        { provide: EmployeeWorkCenterStore, useValue: store },
        { provide: EmployeeFieldCatalogService, useValue: fieldCatalog },
      ],
    }).compileComponents();
    fix = TestBed.createComponent(EmployeeWorkCenterSectionComponent);
    fix.componentRef.setInput('employeeKey', employeeKey);
    fix.detectChanges();
  });

  it('renders period-table with add button', () => {
    expect(fix.nativeElement.querySelector('.temporal-section__add-btn')).toBeTruthy();
  });

  it('shows a row per work center', () => {
    store.workCentersState.set([wc()]);
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

  it('calls createWorkCenter on create submit', () => {
    const c = fix.componentInstance as any;
    c.modalMode.set('create');
    c.workCenterCodeDraft.set('WC1');
    c.startDateDraft.set('2025-06-01');
    c.endDateDraft.set('');
    c.submit();
    expect(store.createWorkCenter).toHaveBeenCalledWith(employeeKey, {
      workCenterCode: 'WC1', startDate: '2025-06-01', endDate: '',
    });
  });

  it('calls correctWorkCenter on edit submit', () => {
    store.workCentersState.set([wc()]);
    fix.detectChanges();
    const c = fix.componentInstance as any;
    c.openEdit(0);
    c.workCenterCodeDraft.set('WC2');
    c.submit();
    expect(store.correctWorkCenter).toHaveBeenCalledWith(employeeKey, 1, expect.objectContaining({ workCenterCode: 'WC2' }));
  });

  it('calls closeWorkCenter after switchToClose', () => {
    store.workCentersState.set([wc({ isActive: true })]);
    fix.detectChanges();
    const c = fix.componentInstance as any;
    c.openEdit(0);
    c.switchToClose();
    c.endDateDraft.set('2025-12-31');
    c.submit();
    expect(store.closeWorkCenter).toHaveBeenCalledWith(employeeKey, 1, '2025-12-31');
  });

  it('closes modal when store signals success', () => {
    fix.nativeElement.querySelector('.temporal-section__add-btn').click();
    fix.detectChanges();
    store.successState.set('created');
    fix.detectChanges();
    expect((fix.componentInstance as any).modalVisible()).toBe(false);
  });
});
