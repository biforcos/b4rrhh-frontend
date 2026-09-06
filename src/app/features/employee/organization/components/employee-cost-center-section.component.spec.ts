import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { EmployeeCostCenterStore } from '../../data-access/employee-cost-center.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeCostCenterPlanModel } from '../../models/employee-cost-center-plan.model';
import { EmployeeCostCenterWindowModel } from '../../models/employee-cost-center.model';
import { EmployeeCostCenterSectionComponent } from './employee-cost-center-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

const closedWindow: EmployeeCostCenterWindowModel = {
  startDate: '2024-01-01',
  endDate: '2024-06-30',
  totalAllocationPercentage: 100,
  items: [{ costCenterCode: 'CC1', costCenterName: 'Centro 1', allocationPercentage: 100 }],
};

const currentWindow: EmployeeCostCenterWindowModel = {
  startDate: '2024-07-01',
  endDate: null,
  totalAllocationPercentage: 100,
  items: [{ costCenterCode: 'CC2', costCenterName: 'Centro 2', allocationPercentage: 100 }],
};

function plan(overrides: Partial<EmployeeCostCenterPlanModel> = {}): EmployeeCostCenterPlanModel {
  return {
    operation: 'ADD',
    accepted: true,
    rejection: null,
    occurrence: { startDate: '2024-01-01', endDate: null },
    correctedOccurrence: null,
    adjustedOccurrence: null,
    overlaps: [],
    gaps: [],
    stretchCandidates: [],
    projected: [],
    ...overrides,
  };
}

class MockCostCenterStore {
  readonly currentDistributionState = signal<EmployeeCostCenterWindowModel | null>(null);
  readonly currentDistribution = this.currentDistributionState.asReadonly();
  readonly historyState = signal<ReadonlyArray<EmployeeCostCenterWindowModel>>([]);
  readonly history = this.historyState.asReadonly();
  readonly planState = signal<EmployeeCostCenterPlanModel | null>(null);
  readonly plan = this.planState.asReadonly();
  readonly planningState = signal(false);
  readonly planning = this.planningState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly error = signal<string | null>(null).asReadonly();
  readonly errorConflict = signal(null).asReadonly();
  readonly successState = signal<'created' | 'corrected' | 'deleted' | null>(null);
  readonly success = this.successState.asReadonly();
  readonly loadCostCenters = vi.fn();
  readonly createDistribution = vi.fn();
  readonly correctDistribution = vi.fn();
  readonly deleteDistribution = vi.fn();
  readonly planChange = vi.fn();
  readonly clearPlan = vi.fn();
  readonly clearFeedback = vi.fn();
}

describe('EmployeeCostCenterSectionComponent', () => {
  let fix: ComponentFixture<EmployeeCostCenterSectionComponent>;
  let store: MockCostCenterStore;

  beforeEach(async () => {
    store = new MockCostCenterStore();

    await TestBed.configureTestingModule({
      imports: [EmployeeCostCenterSectionComponent, NoopAnimationsModule],
      providers: [
        { provide: EmployeeCostCenterStore, useValue: store },
        {
          provide: EmployeeFieldCatalogService,
          useValue: {
            loadCostCenterOptions: vi
              .fn()
              .mockReturnValue(of([{ value: 'CC1', label: 'Centro 1' }])),
          },
        },
      ],
    }).compileComponents();

    fix = TestBed.createComponent(EmployeeCostCenterSectionComponent);
    fix.componentRef.setInput('employeeKey', employeeKey);
    fix.detectChanges();
  });

  it('shows a row per distribution window', () => {
    store.currentDistributionState.set(currentWindow);
    store.historyState.set([currentWindow, closedWindow]);
    fix.detectChanges();
    expect(fix.nativeElement.querySelectorAll('.temporal-section__row').length).toBe(2);
  });

  it('names the window by the day it starts when planning an add', () => {
    const c = fix.componentInstance as any;
    c.openAdd();
    c.startDateDraft.set('2025-01-01');
    c.endDateDraft.set('');
    fix.detectChanges();

    expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
      operation: 'ADD',
      startDate: '2025-01-01',
      endDate: null,
    });
  });

  /**
   * `backend#54`: la de centro de coste es la única serie de cobertura opcional del producto.
   * Borrar una ventana de en medio se acepta y deja el hueco, y el aviso tiene que decir eso y
   * no lo contrario de las verticales obligatorias.
   */
  it('accepts removing a window in the middle and says the gap it leaves is legal', () => {
    store.currentDistributionState.set(currentWindow);
    store.historyState.set([currentWindow, closedWindow]);
    fix.detectChanges();
    const c = fix.componentInstance as any;

    c.openRemove(1);
    fix.detectChanges();

    expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
      operation: 'REMOVE',
      windowStartDate: '2024-01-01',
    });

    store.planState.set(
      plan({
        operation: 'REMOVE',
        gaps: [{ startDate: '2024-01-01', endDate: '2024-06-30' }],
      }),
    );
    fix.detectChanges();

    expect(c.noteTone()).toBe('warning');
    expect(c.noteLines()).toEqual([
      'Quedará un hueco del 1 de enero al 30 de junio de 2024: la cobertura de centro de coste es opcional, así que el hueco es válido y se queda como está.',
    ]);
    expect(c.isSubmitEnabled()).toBe(true);

    c.submit();

    expect(store.deleteDistribution).toHaveBeenCalledWith(employeeKey, '2024-01-01');
  });

  it('corrects the window the whole set of lines belongs to', () => {
    store.currentDistributionState.set(currentWindow);
    store.historyState.set([currentWindow]);
    fix.detectChanges();
    const c = fix.componentInstance as any;

    c.openCorrect(0);
    fix.detectChanges();

    expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
      operation: 'CORRECT',
      windowStartDate: '2024-07-01',
      startDate: '2024-07-01',
      endDate: null,
    });

    store.planState.set(plan({ operation: 'CORRECT' }));
    fix.detectChanges();
    c.submit();

    expect(store.correctDistribution).toHaveBeenCalledWith(
      employeeKey,
      '2024-07-01',
      expect.objectContaining({
        startDate: '2024-07-01',
        endDate: '',
        items: [{ costCenterCode: 'CC2', allocationPercentage: 100 }],
      }),
    );
  });

  it('does not add a window while the plan rejects it', () => {
    const c = fix.componentInstance as any;
    c.openAdd();
    c.startDateDraft.set('2024-07-01');
    fix.detectChanges();

    store.planState.set(plan({ accepted: false, rejection: 'IS_A_CORRECTION' }));
    expect(c.isSubmitEnabled()).toBe(false);
    c.submit();

    expect(store.createDistribution).not.toHaveBeenCalled();
  });
});
