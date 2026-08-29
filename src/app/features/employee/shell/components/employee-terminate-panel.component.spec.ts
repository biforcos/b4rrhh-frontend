import { of } from 'rxjs';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { EmployeeTerminatePanelComponent } from './employee-terminate-panel.component';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeDetailStore } from '../../data-access/employee-detail.store';
import { EmployeeJourneyStore } from '../../data-access/employee-journey.store';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeCostCenterStore } from '../../data-access/employee-cost-center.store';
import { BASE_PATH } from '../../../../core/api/generated/variables';
import { employeeTexts } from '../../employee.texts';

class MockEmployeeFieldCatalogService {
  loadPresenceExitReasonOptions = vi.fn().mockReturnValue(of([{ value: 'VOL', label: 'Voluntaria' }]));
}

class MockEmployeeDetailStore {
  loadEmployeeDetailByBusinessKey = vi.fn();
}

class MockEmployeeJourneyStore {
  loadJourneyByBusinessKey = vi.fn();
}

class MockEmployeePresenceStore {
  loadPresencesByBusinessKey = vi.fn();
}

class MockEmployeeWorkCenterStore {
  loadWorkCenters = vi.fn();
}

class MockEmployeeCostCenterStore {
  loadCostCenters = vi.fn();
}

describe('EmployeeTerminatePanelComponent', () => {
  let fixture: ComponentFixture<EmployeeTerminatePanelComponent>;
  let component: EmployeeTerminatePanelComponent;
  let httpTestingController: HttpTestingController;

  const employeeKey = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP001',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeTerminatePanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: 'http://localhost:8080' },
        { provide: EmployeeFieldCatalogService, useClass: MockEmployeeFieldCatalogService },
        { provide: EmployeeDetailStore, useClass: MockEmployeeDetailStore },
        { provide: EmployeeJourneyStore, useClass: MockEmployeeJourneyStore },
        { provide: EmployeePresenceStore, useClass: MockEmployeePresenceStore },
        { provide: EmployeeWorkCenterStore, useClass: MockEmployeeWorkCenterStore },
        { provide: EmployeeCostCenterStore, useClass: MockEmployeeCostCenterStore },
      ],
    }).compileComponents();

    httpTestingController = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmployeeTerminatePanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('employeeKey', employeeKey);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('renders summary card when terminationResult exists', () => {
    submitTermination({
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP001',
      terminationDate: '2026-03-31',
      exitReasonCode: 'VOL',
      status: 'TERMINATED',
      closedPresence: {} as never,
      closedContract: {} as never,
      closedLaborClassification: {} as never,
      closedWorkCenter: {} as never,
      closedWorkingTime: null,
    });

    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain(employeeTexts.terminatePanelSummaryTitle);
    expect(root.textContent).toContain('31/03/2026');
    expect(root.textContent).toContain('Voluntaria');
    expect(root.textContent).toContain(employeeTexts.employeeStatusInactiveLabel);
    expect(root.textContent).not.toContain('TERMINATED');
  });

  it('renders working time block when closedWorkingTime exists', () => {
    submitTermination({
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP001',
      terminationDate: '2026-03-31',
      exitReasonCode: 'VOL',
      status: 'TERMINATED',
      closedPresence: {} as never,
      closedContract: {} as never,
      closedLaborClassification: {} as never,
      closedWorkCenter: {} as never,
      closedWorkingTime: {
        workingTimeNumber: 987654,
        workingTimePercentage: 75,
        weeklyHours: 30,
        dailyHours: 6,
        monthlyHours: 130,
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      },
    });

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    expect(root.querySelector('[data-testid="termination-working-time-summary"]')).not.toBeNull();
    expect(text).toContain(employeeTexts.terminatePanelSummaryWorkingTimeTitle);
    expect(text).toContain('75% jornada');
    expect(text).toContain('30h/semana · 6h/día · 130h/mes');
    expect(text).toContain('01/01/2026 → 31/03/2026');
  });

  it('does not render working time block when closedWorkingTime is null', () => {
    submitTermination({
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP001',
      terminationDate: '2026-03-31',
      exitReasonCode: 'VOL',
      status: 'TERMINATED',
      closedPresence: {} as never,
      closedContract: {} as never,
      closedLaborClassification: {} as never,
      closedWorkCenter: {} as never,
      closedWorkingTime: null,
    });

    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="termination-working-time-summary"]')).toBeNull();
    expect(root.textContent).not.toContain(employeeTexts.terminatePanelSummaryWorkingTimeTitle);
  });

  it('does not render technical ids in the summary', () => {
    submitTermination({
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP001',
      terminationDate: '2026-03-31',
      exitReasonCode: 'VOL',
      status: 'TERMINATED',
      closedPresence: {} as never,
      closedContract: {} as never,
      closedLaborClassification: {} as never,
      closedWorkCenter: {} as never,
      closedWorkingTime: {
        workingTimeNumber: 987654,
        workingTimePercentage: 75,
        weeklyHours: 30,
        dailyHours: 6,
        monthlyHours: 130,
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      },
    });

    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).not.toContain('987654');
  });

  function submitTermination(responseBody: Record<string, unknown>): void {
    component.form.setValue({
      terminationDate: '2026-03-31',
      exitReasonCode: 'VOL',
    });

    component.submit();

    const request = httpTestingController.expectOne(
      'http://localhost:8080/employees/ESP/INTERNAL/EMP001/terminate',
    );

    expect(request.request.method).toBe('POST');
    request.flush(responseBody);
    fixture.detectChanges();
  }
});