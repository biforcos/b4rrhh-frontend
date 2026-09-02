import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { Router } from '@angular/router';

import { DefaultService } from '../../../../../core/api/generated/api/default.service';
import { EmployeeFieldCatalogService } from '../../../data-access/employee-field-catalog.service';
import { GlobalMessageService } from '../../../data-access/employee-global-message.store';
import {
  EmployeeHiringStore,
  HireEmployeeErrorCode,
} from '../../../data-access/employee-hiring.store';
import { HireEmployeeResult } from '../../../models/employee-hiring.model';
import { employeeTexts } from '../../../employee.texts';
import { HireEmployeePageComponent } from './hire-employee-page.component';

class MockEmployeeHiringStore {
  readonly hiringState = signal(false);
  readonly errorState = signal<HireEmployeeErrorCode | null>(null);
  readonly resultState = signal<HireEmployeeResult | null>(null);

  readonly hiring = this.hiringState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly result = this.resultState.asReadonly();

  readonly hire = vi.fn();
  readonly reset = vi.fn(() => {
    this.hiringState.set(false);
    this.errorState.set(null);
    this.resultState.set(null);
  });
}

class MockGlobalMessageService {
  readonly messages = signal([]);
  readonly summary = signal({ errorCount: 0, warningCount: 0, infoCount: 0, successCount: 0 });
  readonly expanded = signal(false);

  readonly reset = vi.fn();
  readonly setSourceMessages = vi.fn();
  readonly clearSourceMessages = vi.fn();
  readonly success = vi.fn();
  readonly toggleExpanded = vi.fn();
  readonly collapse = vi.fn();
  readonly dismissTransientMessages = vi.fn();
}

describe('HireEmployeePageComponent', () => {
  let fixture: ComponentFixture<HireEmployeePageComponent>;
  let component: HireEmployeePageComponent;
  let hiringStore: MockEmployeeHiringStore;
  let fieldCatalogServiceMock: {
    loadWorkCenterOptions: ReturnType<typeof vi.fn>;
    loadWorkCenterOptionsByCompany: ReturnType<typeof vi.fn>;
    loadPresenceCompanyOptions: ReturnType<typeof vi.fn>;
    loadPresenceEntryReasonOptions: ReturnType<typeof vi.fn>;
    loadContractTypeOptions: ReturnType<typeof vi.fn>;
    loadLaborClassificationAgreementOptions: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    hiringStore = new MockEmployeeHiringStore();
    fieldCatalogServiceMock = {
      loadWorkCenterOptions: vi.fn(() => of([])),
      loadWorkCenterOptionsByCompany: vi.fn(() => of([])),
      loadPresenceCompanyOptions: vi.fn(() => of([])),
      loadPresenceEntryReasonOptions: vi.fn(() => of([])),
      loadContractTypeOptions: vi.fn(() => of([])),
      loadLaborClassificationAgreementOptions: vi.fn(() => of([])),
    };

    await TestBed.configureTestingModule({
      imports: [HireEmployeePageComponent],
      providers: [
        { provide: EmployeeHiringStore, useValue: hiringStore },
        { provide: EmployeeFieldCatalogService, useValue: fieldCatalogServiceMock },
        {
          provide: DefaultService,
          useValue: {
            listRuleSystems: vi.fn(() => of([{ code: 'ESP', name: 'España' }])),
            listContractCatalogSubtypes: vi.fn(() => of([])),
            listLaborClassificationAgreementCategories: vi.fn(() => of([])),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: GlobalMessageService, useClass: MockGlobalMessageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HireEmployeePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the working time block inside the hire workflow form', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="hire-working-time-block"]')).not.toBeNull();
    expect(root.textContent).toContain(employeeTexts.hireEmployeeWorkingTimeTitle);
    expect(root.textContent).toContain(employeeTexts.hireEmployeeWorkingTimeHint);
  });

  it('blocks submit and shows a local error when working time percentage is missing', () => {
    component.form.patchValue({
      ruleSystemCode: 'ESP',
      firstName: 'Ana',
      lastName1: 'Lopez',
      hireDate: new Date(2026, 2, 23),
      companyCode: 'COMP',
      entryReasonCode: 'HIRE',
      workCenterCode: 'WC1',
      contractTypeCode: 'CON',
      contractSubtypeCode: 'SUB',
      agreementCode: 'AGR',
      agreementCategoryCode: 'CAT',
      workingTimePercentage: null,
    });

    component.onSubmit();
    fixture.detectChanges();

    expect(hiringStore.hire).not.toHaveBeenCalled();
    expect(component.form.controls.workingTimePercentage.touched).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      employeeTexts.hireEmployeeWorkingTimeRequiredMessage,
    );
  });

  it('submits the working time percentage inside the local hire draft', () => {
    component.form.patchValue({
      ruleSystemCode: 'ESP',
      firstName: 'Ana',
      lastName1: 'Lopez',
      hireDate: new Date(2026, 2, 23),
      companyCode: 'COMP',
      entryReasonCode: 'HIRE',
      workCenterCode: 'WC1',
      contractTypeCode: 'CON',
      contractSubtypeCode: 'SUB',
      agreementCode: 'AGR',
      agreementCategoryCode: 'CAT',
      workingTimePercentage: 75,
    });

    component.onSubmit();

    expect(hiringStore.hire).toHaveBeenCalledWith(
      expect.objectContaining({
        workingTime: {
          workingTimePercentage: 75,
        },
      }),
    );
  });

  it('enables the submit button when the hire form is valid', () => {
    component.form.patchValue({
      ruleSystemCode: 'ESP',
      firstName: 'Ana',
      lastName1: 'Lopez',
      hireDate: new Date(2026, 2, 23),
      companyCode: 'ES01',
      entryReasonCode: 'HIRE',
      workCenterCode: 'BRANCH_EAST',
      contractTypeCode: 'IND',
      contractSubtypeCode: 'FT1',
      agreementCode: 'AGR_OFFICE',
      agreementCategoryCode: 'CAT_ADMIN',
      workingTimePercentage: 100,
    });
    fixture.detectChanges();

    const submitButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => (button.textContent ?? '').includes(employeeTexts.hireEmployeeAction));

    expect(component.submitDisabled()).toBe(false);
    expect(submitButton?.disabled).toBe(false);
  });

  it('loads work centers using rule system and company binding', () => {
    component.form.patchValue({
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
    });

    expect(fieldCatalogServiceMock.loadWorkCenterOptionsByCompany).toHaveBeenCalledWith(
      'ESP',
      'ES01',
    );
  });

  it('renders the working time result summary without exposing technical ids', () => {
    hiringStore.resultState.set({
      employeeKey: {
        ruleSystemCode: 'ESP',
        employeeTypeCode: 'EMP',
        employeeNumber: 'E001',
      },
      displayName: 'Ana Lopez',
      hireDate: '2026-03-23',
      status: 'ACTIVE',
      workingTime: {
        workingTimeNumber: 987654,
        workingTimePercentage: 75,
        weeklyHours: 30,
        dailyHours: 6,
        monthlyHours: 125,
        startDate: '2026-03-23',
        endDate: null,
      },
    });
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector(
      '[data-testid="hire-working-time-summary"]',
    ) as HTMLElement;

    expect(summary).not.toBeNull();
    expect(summary.textContent).toContain('75% jornada');
    expect(summary.textContent).toContain('30h/semana · 6h/día · 125h/mes');
    expect(summary.textContent).toContain(employeeTexts.hireEmployeeSummarySincePrefix);
    expect(summary.textContent).not.toContain('987654');
  });

  it('keeps the hire success summary visible when the backend does not return working time detail', () => {
    hiringStore.resultState.set({
      employeeKey: {
        ruleSystemCode: 'ESP',
        employeeTypeCode: 'EMP',
        employeeNumber: 'E001',
      },
      displayName: 'Ana Lopez',
      hireDate: '2026-03-23',
      status: 'ACTIVE',
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="hire-result-summary"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="hire-working-time-summary"]')).toBeNull();
    expect(root.textContent).toContain('Ana Lopez');
    expect(root.textContent).toContain('ACTIVE');
  });
});
