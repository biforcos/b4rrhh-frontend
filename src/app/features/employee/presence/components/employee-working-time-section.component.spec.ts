import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EmployeeWorkingTimeStore } from '../../data-access/employee-working-time.store';
import { EmployeeWorkingTimeModel } from '../../models/employee-working-time.model';
import { EmployeeWorkingTimePlanModel } from '../../models/employee-working-time-plan.model';
import { currentLocalDate } from '../../../../shared/utils/local-date.util';
import { EmployeeWorkingTimeSectionComponent } from './employee-working-time-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

type WorkingTimeSuccess = 'created' | 'updated' | 'deleted' | null;

class MockWorkingTimeStore {
  readonly workingTimesState = signal<ReadonlyArray<EmployeeWorkingTimeModel>>([]);
  readonly workingTimes = this.workingTimesState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly successState = signal<WorkingTimeSuccess>(null);
  readonly success = this.successState.asReadonly();
  readonly planState = signal<EmployeeWorkingTimePlanModel | null>(null);
  readonly plan = this.planState.asReadonly();
  readonly planningState = signal(false);
  readonly planning = this.planningState.asReadonly();
  readonly loadWorkingTimesByBusinessKey = vi.fn();
  readonly createWorkingTime = vi.fn();
  readonly updateWorkingTime = vi.fn();
  readonly deleteWorkingTime = vi.fn();
  readonly planChange = vi.fn();
  readonly clearPlan = vi.fn();
  readonly clearFeedback = vi.fn();
}

const workingTime = (
  overrides: Partial<EmployeeWorkingTimeModel> = {},
): EmployeeWorkingTimeModel => ({
  workingTimeNumber: 1,
  startDate: '2026-03-01',
  endDate: null,
  workingTimePercentage: 100,
  weeklyHours: 40,
  dailyHours: 8,
  monthlyHours: 160,
  isActive: true,
  ...overrides,
});

const acceptedPlan = (
  overrides: Partial<EmployeeWorkingTimePlanModel> = {},
): EmployeeWorkingTimePlanModel => ({
  operation: 'ADD',
  accepted: true,
  rejection: null,
  occurrence: { workingTimeNumber: null, startDate: '2026-03-16', endDate: null },
  adjustedOccurrence: null,
  overlaps: [],
  gaps: [],
  stretchCandidates: [],
  projected: [],
  ...overrides,
});

/**
 * La pantalla de jornada sobre ADR-057 (frontend#43): una sola forma de escribir —añadir con
 * inicio y fin—, borrar, y antes de confirmar cualquiera de las dos el plan del backend.
 */
describe('EmployeeWorkingTimeSectionComponent', () => {
  let fix: ComponentFixture<EmployeeWorkingTimeSectionComponent>;
  let store: MockWorkingTimeStore;
  // La superficie protegida del componente, para leer sus señales sin pasar por el DOM del diálogo.
  let c: {
    modalVisible: () => boolean;
    modalMode: () => 'add' | 'correct' | 'remove';
    startDateDraft: { set: (value: string) => void };
    endDateDraft: { set: (value: string) => void };
    percentageDraft: { set: (value: number) => void };
    noteLines: () => ReadonlyArray<string>;
    noteTone: () => string;
    isSubmitEnabled: () => boolean;
    submitLabel: () => string;
    modalTitle: () => string;
    openAdd: () => void;
    openCorrect: (index: number) => void;
    openRemove: (index: number) => void;
    submit: () => void;
  };

  beforeEach(async () => {
    store = new MockWorkingTimeStore();
    await TestBed.configureTestingModule({
      imports: [EmployeeWorkingTimeSectionComponent, NoopAnimationsModule],
      providers: [{ provide: EmployeeWorkingTimeStore, useValue: store }],
    }).compileComponents();
    fix = TestBed.createComponent(EmployeeWorkingTimeSectionComponent);
    fix.componentRef.setInput('employeeBusinessKey', employeeKey);
    fix.detectChanges();
    c = fix.componentInstance as unknown as typeof c;
  });

  it('renders the table with the add action named after what it does', () => {
    const addButton = fix.nativeElement.querySelector('.temporal-section__add-btn');
    expect(addButton).toBeTruthy();
    expect(addButton.textContent.trim()).toBe('Añadir jornada');
  });

  it('shows a row per working time, each with correct and remove', () => {
    store.workingTimesState.set([
      workingTime({ workingTimeNumber: 2, startDate: '2026-03-16' }),
      workingTime({ workingTimeNumber: 1, endDate: '2026-03-15', isActive: false }),
    ]);
    fix.detectChanges();

    expect(fix.nativeElement.querySelectorAll('.temporal-section__row').length).toBe(2);
    expect(fix.nativeElement.querySelectorAll('[aria-label^="Editar"]').length).toBe(2);
    expect(fix.nativeElement.querySelectorAll('[aria-label^="Eliminar"]').length).toBe(2);
  });

  describe('adding a working time', () => {
    it('opens the add modal and asks for the plan of a working time from today, open', () => {
      fix.nativeElement.querySelector('.temporal-section__add-btn').click();
      fix.detectChanges();

      expect(c.modalVisible()).toBe(true);
      expect(c.modalMode()).toBe('add');
      expect(c.modalTitle()).toBe('Añadir jornada');
      expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
        operation: 'ADD',
        startDate: currentLocalDate(),
        endDate: null,
      });
    });

    it('asks for a new plan every time the dates change', () => {
      c.openAdd();
      fix.detectChanges();
      store.planChange.mockClear();

      c.startDateDraft.set('2026-03-16');
      fix.detectChanges();
      c.endDateDraft.set('2026-03-31');
      fix.detectChanges();

      expect(store.planChange.mock.calls.map((call) => call[1])).toEqual([
        { operation: 'ADD', startDate: '2026-03-16', endDate: null },
        { operation: 'ADD', startDate: '2026-03-16', endDate: '2026-03-31' },
      ]);
    });

    it('shows, before confirming, that the working time in force will close the day before', () => {
      store.workingTimesState.set([workingTime()]);
      c.openAdd();
      c.startDateDraft.set('2026-03-16');
      fix.detectChanges();

      store.planState.set(
        acceptedPlan({
          adjustedOccurrence: {
            workingTimeNumber: 1,
            before: { startDate: '2026-03-01', endDate: null },
            after: { startDate: '2026-03-01', endDate: '2026-03-15' },
          },
        }),
      );
      fix.detectChanges();

      expect(c.noteLines()).toEqual([
        'La jornada en vigor desde el 1 de marzo de 2026 se cerrará el 15 de marzo de 2026.',
      ]);
      expect(c.noteTone()).toBe('warning');
      expect(c.isSubmitEnabled()).toBe(true);

      c.submit();

      expect(store.createWorkingTime).toHaveBeenCalledWith(employeeKey, {
        startDate: '2026-03-16',
        endDate: null,
        workingTimePercentage: 100,
      });
    });

    it('sends the end date when the new working time is already closed', () => {
      c.openAdd();
      c.startDateDraft.set('2026-03-16');
      c.endDateDraft.set('2026-03-31');
      c.percentageDraft.set(50);
      fix.detectChanges();
      store.planState.set(acceptedPlan());
      fix.detectChanges();

      c.submit();

      expect(store.createWorkingTime).toHaveBeenCalledWith(employeeKey, {
        startDate: '2026-03-16',
        endDate: '2026-03-31',
        workingTimePercentage: 50,
      });
    });

    it('explains a gap in Spanish, with dates, and does not let it be confirmed', () => {
      c.openAdd();
      c.startDateDraft.set('2026-03-08');
      fix.detectChanges();
      store.planState.set(
        acceptedPlan({
          accepted: false,
          rejection: 'GAP_NOT_ALLOWED',
          gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
          stretchCandidates: [
            { workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
          ],
        }),
      );
      fix.detectChanges();

      expect(c.noteLines()).toEqual([
        'Quedaría un hueco del 3 al 7 de marzo de 2026.',
        'Antes se puede alargar la jornada del 1 al 2 de marzo de 2026.',
      ]);
      expect(c.noteTone()).toBe('error');
      expect(c.isSubmitEnabled()).toBe(false);

      c.submit();

      expect(store.createWorkingTime).not.toHaveBeenCalled();
    });

    it('cannot be confirmed while the plan is still being calculated', () => {
      c.openAdd();
      fix.detectChanges();
      store.planningState.set(true);
      fix.detectChanges();

      expect(c.noteLines()).toEqual(['Calculando qué cambiaría…']);
      expect(c.isSubmitEnabled()).toBe(false);
    });
  });

  describe('removing a working time', () => {
    beforeEach(() => {
      store.workingTimesState.set([
        workingTime({ workingTimeNumber: 2, startDate: '2026-03-16' }),
        workingTime({ workingTimeNumber: 1, endDate: '2026-03-15', isActive: false }),
      ]);
      fix.detectChanges();
    });

    it('opens the remove modal from the row and asks for its plan', () => {
      fix.nativeElement.querySelector('[aria-label^="Eliminar"]').click();
      fix.detectChanges();

      expect(c.modalVisible()).toBe(true);
      expect(c.modalMode()).toBe('remove');
      expect(c.submitLabel()).toBe('Eliminar jornada');
      expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
        operation: 'REMOVE',
        workingTimeNumber: 2,
      });
    });

    it('warns that removing the last one reopens the previous one, then deletes', () => {
      c.openRemove(0);
      fix.detectChanges();
      store.planState.set(
        acceptedPlan({
          operation: 'REMOVE',
          occurrence: { workingTimeNumber: 2, startDate: '2026-03-16', endDate: null },
          adjustedOccurrence: {
            workingTimeNumber: 1,
            before: { startDate: '2026-03-01', endDate: '2026-03-15' },
            after: { startDate: '2026-03-01', endDate: null },
          },
        }),
      );
      fix.detectChanges();

      expect(c.noteLines()).toEqual([
        'La jornada anterior, desde el 1 de marzo de 2026, se reabrirá y quedará en vigor.',
      ]);
      expect(c.isSubmitEnabled()).toBe(true);

      c.submit();

      expect(store.deleteWorkingTime).toHaveBeenCalledWith(employeeKey, 2);
    });
  });

  describe('correcting a working time', () => {
    it('plans the correction with the row dates and saves them with the end date', () => {
      store.workingTimesState.set([
        workingTime({ workingTimeNumber: 1, endDate: '2026-03-15', isActive: false }),
      ]);
      fix.detectChanges();

      c.openCorrect(0);
      fix.detectChanges();

      expect(c.modalMode()).toBe('correct');
      expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
        operation: 'CORRECT',
        workingTimeNumber: 1,
        startDate: '2026-03-01',
        endDate: '2026-03-15',
      });

      c.endDateDraft.set('2026-03-20');
      c.percentageDraft.set(80);
      fix.detectChanges();
      store.planState.set(acceptedPlan({ operation: 'CORRECT' }));
      fix.detectChanges();

      expect(c.noteLines()).toEqual(['No cambia ninguna otra jornada.']);

      c.submit();

      expect(store.updateWorkingTime).toHaveBeenCalledWith(employeeKey, 1, {
        startDate: '2026-03-01',
        endDate: '2026-03-20',
        workingTimePercentage: 80,
      });
    });
  });

  it('closes the modal and drops the plan when the store signals success', () => {
    c.openAdd();
    fix.detectChanges();
    expect(c.modalVisible()).toBe(true);

    store.successState.set('created');
    fix.detectChanges();

    expect(c.modalVisible()).toBe(false);
    expect(store.clearPlan).toHaveBeenCalled();
  });
});
