import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeWorkCenterModel } from '../../models/employee-work-center.model';
import { EmployeeWorkCenterPlanModel } from '../../models/employee-work-center-plan.model';
import { EmployeeWorkCenterSectionComponent } from './employee-work-center-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

const wc = (overrides: Partial<EmployeeWorkCenterModel> = {}): EmployeeWorkCenterModel => ({
  workCenterAssignmentNumber: 1,
  workCenterCode: 'WC1',
  workCenterName: 'Centro 1',
  startDate: '2024-01-01',
  endDate: null,
  isActive: true,
  canDelete: false,
  startsAtPresenceStart: false,
  deleteForbiddenReason: null,
  ...overrides,
});

function plan(overrides: Partial<EmployeeWorkCenterPlanModel> = {}): EmployeeWorkCenterPlanModel {
  return {
    operation: 'ADD',
    accepted: true,
    rejection: null,
    occurrence: { workCenterAssignmentNumber: null, startDate: '2025-06-01', endDate: null },
    correctedOccurrence: null,
    adjustedOccurrence: null,
    overlaps: [],
    gaps: [],
    stretchCandidates: [],
    projected: [],
    ...overrides,
  };
}

class MockWorkCenterStore {
  readonly workCentersState = signal<ReadonlyArray<EmployeeWorkCenterModel>>([]);
  readonly workCenters = this.workCentersState.asReadonly();
  readonly planState = signal<EmployeeWorkCenterPlanModel | null>(null);
  readonly plan = this.planState.asReadonly();
  readonly planningState = signal(false);
  readonly planning = this.planningState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly error = signal<string | null>(null).asReadonly();
  readonly errorConflict = signal(null).asReadonly();
  readonly successState = signal<'created' | 'corrected' | 'deleted' | null>(null);
  readonly success = this.successState.asReadonly();
  readonly loadWorkCenters = vi.fn();
  readonly createWorkCenter = vi.fn();
  readonly correctWorkCenter = vi.fn();
  readonly deleteWorkCenter = vi.fn();
  readonly planChange = vi.fn();
  readonly clearPlan = vi.fn();
  readonly clearFeedback = vi.fn();
}

describe('EmployeeWorkCenterSectionComponent', () => {
  let fix: ComponentFixture<EmployeeWorkCenterSectionComponent>;
  let store: MockWorkCenterStore;
  let fieldCatalog: { loadWorkCenterOptions: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = new MockWorkCenterStore();
    fieldCatalog = {
      loadWorkCenterOptions: vi.fn().mockReturnValue(of([{ value: 'WC1', label: 'Centro 1' }])),
    };

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
    expect(fix.nativeElement.querySelector('.section-heading__add-btn')).toBeTruthy();
  });

  it('shows a row per work center', () => {
    store.workCentersState.set([wc()]);
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

    expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
      operation: 'ADD',
      startDate: '2025-06-01',
      endDate: null,
    });
  });

  it('adds an assignment only once the plan accepts it', () => {
    const c = fix.componentInstance as any;
    c.openAdd();
    c.workCenterCodeDraft.set('WC1');
    c.startDateDraft.set('2025-06-01');
    c.endDateDraft.set('');

    store.planState.set(plan({ accepted: false, rejection: 'OVERLAP' }));
    expect(c.isSubmitEnabled()).toBe(false);
    c.submit();
    expect(store.createWorkCenter).not.toHaveBeenCalled();

    store.planState.set(plan());
    expect(c.isSubmitEnabled()).toBe(true);
    c.submit();
    expect(store.createWorkCenter).toHaveBeenCalledWith(employeeKey, {
      workCenterCode: 'WC1',
      startDate: '2025-06-01',
      endDate: '',
    });
  });

  /**
   * Es lo que la jornada arregló en el `frontend#43`: el alta que empieza el mismo día que una
   * existente no la sustituye en silencio, se cuenta como corrección y se ofrece tomar ese
   * camino con lo ya escrito.
   */
  it('offers to correct the assignment an add would collide with', () => {
    store.workCentersState.set([wc()]);
    fix.detectChanges();
    const c = fix.componentInstance as any;
    c.openAdd();
    c.workCenterCodeDraft.set('WC2');
    c.startDateDraft.set('2024-01-01');

    store.planState.set(
      plan({
        accepted: false,
        rejection: 'IS_A_CORRECTION',
        correctedOccurrence: {
          workCenterAssignmentNumber: 1,
          startDate: '2024-01-01',
          endDate: null,
        },
      }),
    );
    fix.detectChanges();

    expect(c.correctionOffer()).toBe('Corregir la asignación desde el 1 de enero de 2024');

    c.switchToCorrection();
    store.planState.set(plan({ operation: 'CORRECT' }));
    c.submit();

    expect(store.correctWorkCenter).toHaveBeenCalledWith(
      employeeKey,
      1,
      expect.objectContaining({ workCenterCode: 'WC2', startDate: '2024-01-01' }),
    );
  });

  it('plans a removal by assignment number and removes only once the plan accepts it', () => {
    store.workCentersState.set([wc()]);
    fix.detectChanges();
    const c = fix.componentInstance as any;
    c.openRemove(0);
    fix.detectChanges();

    expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
      operation: 'REMOVE',
      workCenterAssignmentNumber: 1,
    });

    store.planState.set(
      plan({
        operation: 'REMOVE',
        accepted: false,
        rejection: 'GAP_NOT_ALLOWED',
        gaps: [{ startDate: '2024-01-01', endDate: '2024-06-30' }],
      }),
    );
    fix.detectChanges();

    expect(c.noteTone()).toBe('error');
    expect(c.noteLines()).toEqual(['Quedaría un hueco del 1 de enero al 30 de junio de 2024.']);
    c.submit();
    expect(store.deleteWorkCenter).not.toHaveBeenCalled();

    store.planState.set(plan({ operation: 'REMOVE' }));
    c.submit();
    expect(store.deleteWorkCenter).toHaveBeenCalledWith(employeeKey, 1);
  });

  it('closes modal when store signals success', () => {
    fix.nativeElement.querySelector('.section-heading__add-btn').click();
    fix.detectChanges();
    store.successState.set('created');
    fix.detectChanges();
    expect((fix.componentInstance as any).modalVisible()).toBe(false);
  });
});
