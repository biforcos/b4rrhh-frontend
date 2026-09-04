import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EmployeeWorkingTimeStore } from '../../data-access/employee-working-time.store';
import { EmployeeWorkingTimeModel } from '../../models/employee-working-time.model';
import { EmployeeWorkingTimeSectionComponent } from './employee-working-time-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

class MockWorkingTimeStore {
  readonly workingTimesState = signal<ReadonlyArray<EmployeeWorkingTimeModel>>([]);
  readonly workingTimes = this.workingTimesState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly successState = signal<'created' | 'updated' | 'closed' | null>(null);
  readonly success = this.successState.asReadonly();
  readonly loadWorkingTimesByBusinessKey = vi.fn();
  readonly createWorkingTime = vi.fn();
  readonly updateWorkingTime = vi.fn();
  readonly closeWorkingTime = vi.fn();
  readonly clearFeedback = vi.fn();
}

describe('EmployeeWorkingTimeSectionComponent', () => {
  let fix: ComponentFixture<EmployeeWorkingTimeSectionComponent>;
  let store: MockWorkingTimeStore;

  beforeEach(async () => {
    store = new MockWorkingTimeStore();
    await TestBed.configureTestingModule({
      imports: [EmployeeWorkingTimeSectionComponent, NoopAnimationsModule],
      providers: [{ provide: EmployeeWorkingTimeStore, useValue: store }],
    }).compileComponents();
    fix = TestBed.createComponent(EmployeeWorkingTimeSectionComponent);
    fix.componentRef.setInput('employeeBusinessKey', employeeKey);
    fix.detectChanges();
  });

  it('renders period-table with add button', () => {
    expect(fix.nativeElement.querySelector('.temporal-section__add-btn')).toBeTruthy();
  });

  it('shows a row per working time', () => {
    store.workingTimesState.set([
      {
        workingTimeNumber: 1,
        startDate: '2024-01-01',
        endDate: null,
        workingTimePercentage: 100,
        weeklyHours: 40,
        dailyHours: 8,
        monthlyHours: 160,
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

  it('calls createWorkingTime on create submit', () => {
    const c = fix.componentInstance as any;
    c.modalMode.set('create');
    c.startDateDraft.set('2025-06-01');
    c.percentageDraft.set(50);
    c.submit();
    expect(store.createWorkingTime).toHaveBeenCalledWith(employeeKey, {
      startDate: '2025-06-01',
      endDate: null,
      workingTimePercentage: 50,
    });
  });

  it('calls updateWorkingTime on edit submit', () => {
    store.workingTimesState.set([
      {
        workingTimeNumber: 3,
        startDate: '2024-01-01',
        endDate: null,
        workingTimePercentage: 100,
        weeklyHours: 40,
        dailyHours: 8,
        monthlyHours: 160,
        isActive: true,
      },
    ]);
    fix.detectChanges();
    const c = fix.componentInstance as any;
    c.openEdit(0);
    c.percentageDraft.set(80);
    c.submit();
    expect(store.updateWorkingTime).toHaveBeenCalledWith(employeeKey, 3, {
      startDate: '2024-01-01',
      endDate: null,
      workingTimePercentage: 80,
    });
  });

  it('calls closeWorkingTime on close submit', () => {
    store.workingTimesState.set([
      {
        workingTimeNumber: 3,
        startDate: '2024-01-01',
        endDate: null,
        workingTimePercentage: 100,
        weeklyHours: 40,
        dailyHours: 8,
        monthlyHours: 160,
        isActive: true,
      },
    ]);
    fix.detectChanges();
    const c = fix.componentInstance as any;
    c.openEdit(0);
    c.switchToClose();
    c.endDateDraft.set('2025-12-31');
    c.submit();
    expect(store.closeWorkingTime).toHaveBeenCalledWith(employeeKey, 3, { endDate: '2025-12-31' });
  });

  it('shows edit button only for active rows', () => {
    store.workingTimesState.set([
      {
        workingTimeNumber: 2,
        startDate: '2024-06-01',
        endDate: null,
        workingTimePercentage: 100,
        weeklyHours: 40,
        dailyHours: 8,
        monthlyHours: 160,
        isActive: true,
      },
      {
        workingTimeNumber: 1,
        startDate: '2024-01-01',
        endDate: '2024-05-31',
        workingTimePercentage: 80,
        weeklyHours: 32,
        dailyHours: 6.4,
        monthlyHours: 133.33,
        isActive: false,
      },
    ]);
    fix.detectChanges();
    const editBtns = fix.nativeElement.querySelectorAll('.temporal-section__icon-btn');
    expect(editBtns.length).toBe(1);
  });

  it('closes modal when store signals success', async () => {
    fix.nativeElement.querySelector('.temporal-section__add-btn').click();
    fix.detectChanges();
    const c = fix.componentInstance as any;
    expect(c.modalVisible()).toBe(true);

    store.successState.set('created');
    fix.detectChanges();

    expect(c.modalVisible()).toBe(false);
  });
});
