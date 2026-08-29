import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { EmployeeRehireStore, RehireEmployeeErrorCode } from '../../../data-access/employee-rehire.store';
import { EmployeeRehireCatalogService } from '../../../data-access/employee-rehire-catalog.service';
import { EmployeeDetailStore } from '../../../data-access/employee-detail.store';
import { GlobalMessageService } from '../../../data-access/employee-global-message.store';
import { RehireEmployeeResult } from '../../../models/employee-rehire.model';
import { employeeTexts } from '../../../employee.texts';
import { RehireEmployeePageComponent } from './rehire-employee-page.component';

class MockEmployeeRehireStore {
  readonly rehiringState = signal(false);
  readonly errorState = signal<RehireEmployeeErrorCode | null>(null);
  readonly resultState = signal<RehireEmployeeResult | null>(null);

  readonly rehiring = this.rehiringState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly result = this.resultState.asReadonly();

  readonly rehire = vi.fn();
  readonly reset = vi.fn(() => {
    this.rehiringState.set(false);
    this.errorState.set(null);
    this.resultState.set(null);
  });
}

class MockEmployeeRehireCatalogService {
  readonly companies = signal([{ value: 'ES01', label: 'Spain Company 0001 · ES01' }]);
  readonly entryReasons = signal([{ value: 'REHIRE', label: 'Rehire · REHIRE' }]);
  readonly workCenters = signal([{ value: 'MADRID_01', label: 'Madrid 01 · MADRID_01' }]);
  readonly contractTypes = signal([{ value: 'PER', label: 'Permanent · PER' }]);
  readonly contractSubtypes = signal([{ value: 'ORD', label: 'Ordinary · ORD' }]);
  readonly agreements = signal([{ value: 'AGR', label: 'Agreement · AGR' }]);
  readonly agreementCategories = signal([{ value: 'CAT', label: 'Category · CAT' }]);
  readonly costCenterOptions = signal([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly loadForRuleSystem = vi.fn();
  readonly loadWorkCentersByCompany = vi.fn();
  readonly clearWorkCenters = vi.fn();
  readonly loadContractSubtypes = vi.fn();
  readonly clearContractSubtypes = vi.fn();
  readonly loadAgreementCategories = vi.fn();
  readonly clearAgreementCategories = vi.fn();
}

class MockEmployeeDetailStore {
  readonly selectedEmployeeDetail = signal({
    id: 1,
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'EMP',
    employeeNumber: 'E001',
    firstName: 'Ana',
    lastName1: 'Lopez',
    lastName2: null,
    preferredName: null,
    displayName: 'Ana Lopez',
    statusLabel: 'Activo',
    workCenter: 'Madrid 01',
  });

  readonly refreshEmployeeDetailByBusinessKey = vi.fn();
}

class MockGlobalMessageService {
  readonly messages = signal([]);
  readonly summary = signal({ errorCount: 0, warningCount: 0, infoCount: 0, successCount: 0 });
  readonly expanded = signal(false);

  readonly setSourceMessages = vi.fn();
  readonly clearSourceMessages = vi.fn();
  readonly success = vi.fn();
}

describe('RehireEmployeePageComponent', () => {
  let fixture: ComponentFixture<RehireEmployeePageComponent>;
  let component: RehireEmployeePageComponent;
  let rehireStore: MockEmployeeRehireStore;
  let rehireCatalog: MockEmployeeRehireCatalogService;
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    rehireStore = new MockEmployeeRehireStore();
    routerMock = { navigate: vi.fn(() => Promise.resolve(true)) };

    await TestBed.configureTestingModule({
      imports: [RehireEmployeePageComponent],
      providers: [
        { provide: EmployeeRehireStore, useValue: rehireStore },
        { provide: EmployeeRehireCatalogService, useClass: MockEmployeeRehireCatalogService },
        { provide: EmployeeDetailStore, useClass: MockEmployeeDetailStore },
        { provide: GlobalMessageService, useClass: MockGlobalMessageService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                ruleSystemCode: 'ESP',
                employeeTypeCode: 'EMP',
                employeeNumber: 'E001',
              }),
            },
          },
        },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RehireEmployeePageComponent);
    component = fixture.componentInstance;
    rehireCatalog = TestBed.inject(EmployeeRehireCatalogService) as unknown as MockEmployeeRehireCatalogService;
    fixture.detectChanges();
  });

  it('renders the working time block inside the rehire workflow form', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="rehire-working-time-block"]')).not.toBeNull();
    expect(root.textContent).toContain(employeeTexts.rehireEmployeeWorkingTimeTitle);
    expect(root.textContent).toContain(employeeTexts.rehireEmployeeWorkingTimeHint);
  });

  it('blocks submit and shows a local error when working time percentage is missing', () => {
    component.form.patchValue({
      rehireDate: new Date(2026, 3, 15),
      companyCode: 'ES01',
      entryReasonCode: 'REHIRE',
      workCenterCode: 'MADRID_01',
      contractTypeCode: 'PER',
      contractSubtypeCode: 'ORD',
      agreementCode: 'AGR',
      agreementCategoryCode: 'CAT',
      workingTimePercentage: null,
    });

    component.onSubmit();
    fixture.detectChanges();

    expect(rehireStore.rehire).not.toHaveBeenCalled();
    expect(component.form.controls.workingTimePercentage.touched).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(employeeTexts.rehireEmployeeWorkingTimeRequiredMessage);
  });

  it('includes only workingTime.workingTimePercentage in the outgoing draft', () => {
    component.form.patchValue({
      rehireDate: new Date(2026, 3, 15),
      companyCode: 'ES01',
      entryReasonCode: 'REHIRE',
      workCenterCode: 'MADRID_01',
      contractTypeCode: 'PER',
      contractSubtypeCode: 'ORD',
      agreementCode: 'AGR',
      agreementCategoryCode: 'CAT',
      workingTimePercentage: 80,
    });

    component.onSubmit();

    expect(rehireStore.rehire).toHaveBeenCalledWith(
      expect.objectContaining({
        workingTime: {
          workingTimePercentage: 80,
        },
      }),
    );

    const sentDraft = rehireStore.rehire.mock.calls[0][0] as Record<string, unknown>;
    const rawWorkingTime = sentDraft['workingTime'] as Record<string, unknown>;

    expect(rawWorkingTime['weeklyHours']).toBeUndefined();
    expect(rawWorkingTime['dailyHours']).toBeUndefined();
    expect(rawWorkingTime['monthlyHours']).toBeUndefined();
  });

  it('disables submit while the form is invalid and enables it when valid', () => {
    fixture.detectChanges();

    let submitButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => (button.textContent ?? '').includes(employeeTexts.rehireEmployeeAction));

    expect(component.submitDisabled()).toBe(true);
    expect(submitButton?.disabled).toBe(true);

    component.form.patchValue({
      rehireDate: new Date(2026, 3, 15),
      companyCode: 'ES01',
      entryReasonCode: 'REHIRE',
      workCenterCode: 'MADRID_01',
      contractTypeCode: 'PER',
      contractSubtypeCode: 'ORD',
      agreementCode: 'AGR',
      agreementCategoryCode: 'CAT',
      workingTimePercentage: 80,
    });
    fixture.detectChanges();

    submitButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => (button.textContent ?? '').includes(employeeTexts.rehireEmployeeAction));

    expect(component.submitDisabled()).toBe(false);
    expect(submitButton?.disabled).toBe(false);
  });

  it('loads work centers using the selected company binding', () => {
    component.form.controls.companyCode.setValue('ES01');

    expect(rehireCatalog.loadWorkCentersByCompany).toHaveBeenCalledWith('ES01');
  });

  it('renders the newWorkingTime summary without exposing technical ids', () => {
    rehireStore.resultState.set({
      employeeKey: {
        ruleSystemCode: 'ESP',
        employeeTypeCode: 'EMP',
        employeeNumber: 'E001',
      },
      rehireDate: '2026-04-15',
      status: 'ACTIVE',
      newWorkingTime: {
        workingTimeNumber: 12,
        workingTimePercentage: 80,
        weeklyHours: 32,
        dailyHours: 6.4,
        monthlyHours: 133.34,
        startDate: '2026-04-15',
        endDate: null,
      },
    });
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector('[data-testid="rehire-working-time-summary"]') as HTMLElement;

    expect(summary).not.toBeNull();
    expect(summary.textContent).toContain('80% jornada');
    expect(summary.textContent).toContain('32h/semana · 6,4h/día · 133,34h/mes');
    expect(summary.textContent).toContain(employeeTexts.rehireEmployeeSummaryWorkingTimeTitle);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(employeeTexts.employeeStatusActiveLabel);
    expect(summary.textContent).toContain(employeeTexts.rehireEmployeeSummarySincePrefix);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('ACTIVE');
    expect(summary.textContent).not.toContain('12');
  });

  it('navigates back to employee detail after a successful rehire', () => {
    rehireStore.resultState.set({
      employeeKey: {
        ruleSystemCode: 'ESP',
        employeeTypeCode: 'EMP',
        employeeNumber: 'E001',
      },
      rehireDate: '2026-04-15',
      status: 'ACTIVE',
      newWorkingTime: {
        workingTimeNumber: 12,
        workingTimePercentage: 80,
        weeklyHours: 32,
        dailyHours: 6.4,
        monthlyHours: 133.34,
        startDate: '2026-04-15',
        endDate: null,
      },
    });
    fixture.detectChanges();

    expect(routerMock.navigate).toHaveBeenCalledWith(
      ['/personas/empleados', 'ESP', 'EMP', 'E001', 'relacion'],
      {
        queryParams: { refresh: 'rehire' },
      },
    );
  });
});