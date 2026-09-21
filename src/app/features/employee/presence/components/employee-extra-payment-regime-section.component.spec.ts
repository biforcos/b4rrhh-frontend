import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EmployeeExtraPaymentRegimeStore } from '../../data-access/employee-extra-payment-regime.store';
import { EmployeeExtraPaymentRegimeModel } from '../../models/employee-extra-payment-regime.model';
import { EmployeeExtraPaymentRegimePlanModel } from '../../models/employee-extra-payment-regime-plan.model';
import { currentLocalDate } from '../../../../shared/utils/local-date.util';
import { EmployeeExtraPaymentRegimeSectionComponent } from './employee-extra-payment-regime-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

type ExtraPaymentRegimeSuccess = 'created' | 'updated' | 'deleted' | null;

class MockExtraPaymentRegimeStore {
  readonly extraPaymentRegimesState = signal<ReadonlyArray<EmployeeExtraPaymentRegimeModel>>([]);
  readonly extraPaymentRegimes = this.extraPaymentRegimesState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly successState = signal<ExtraPaymentRegimeSuccess>(null);
  readonly success = this.successState.asReadonly();
  readonly planState = signal<EmployeeExtraPaymentRegimePlanModel | null>(null);
  readonly plan = this.planState.asReadonly();
  readonly planningState = signal(false);
  readonly planning = this.planningState.asReadonly();
  readonly loadExtraPaymentRegimesByBusinessKey = vi.fn();
  readonly createExtraPaymentRegime = vi.fn();
  readonly updateExtraPaymentRegime = vi.fn();
  readonly deleteExtraPaymentRegime = vi.fn();
  readonly planChange = vi.fn();
  readonly clearPlan = vi.fn();
  readonly clearFeedback = vi.fn();
}

const extraPaymentRegime = (
  overrides: Partial<EmployeeExtraPaymentRegimeModel> = {},
): EmployeeExtraPaymentRegimeModel => ({
  extraPaymentRegimeNumber: 1,
  startDate: '2026-03-01',
  endDate: null,
  prorated: false,
  isActive: true,
  ...overrides,
});

const acceptedPlan = (
  overrides: Partial<EmployeeExtraPaymentRegimePlanModel> = {},
): EmployeeExtraPaymentRegimePlanModel => ({
  operation: 'ADD',
  accepted: true,
  rejection: null,
  occurrence: { extraPaymentRegimeNumber: null, startDate: '2026-03-16', endDate: null },
  correctedOccurrence: null,
  adjustedOccurrence: null,
  overlaps: [],
  gaps: [],
  stretchCandidates: [],
  projected: [],
  ...overrides,
});

/**
 * La pantalla de régimen de pagas extras sobre ADR-057 (b4rrhh/backend#118): es el molde de
 * inicio y fin—, borrar, y antes de confirmar cualquiera de las dos el plan del backend.
 */
describe('EmployeeExtraPaymentRegimeSectionComponent', () => {
  let fix: ComponentFixture<EmployeeExtraPaymentRegimeSectionComponent>;
  let store: MockExtraPaymentRegimeStore;
  // La superficie protegida del componente, para leer sus señales sin pasar por el DOM del diálogo.
  let c: {
    modalVisible: () => boolean;
    modalMode: () => 'add' | 'correct' | 'remove';
    startDateDraft: { (): string; set: (value: string) => void };
    endDateDraft: { (): string; set: (value: string) => void };
    proratedDraft: { (): boolean; set: (value: boolean) => void };
    noteLines: () => ReadonlyArray<string>;
    noteTone: () => string;
    correctionOffer: () => string | null;
    isSubmitEnabled: () => boolean;
    submitLabel: () => string;
    modalTitle: () => string;
    openAdd: () => void;
    openCorrect: (index: number) => void;
    openRemove: (index: number) => void;
    switchToCorrection: () => void;
    submit: () => void;
  };

  beforeEach(async () => {
    store = new MockExtraPaymentRegimeStore();
    await TestBed.configureTestingModule({
      imports: [EmployeeExtraPaymentRegimeSectionComponent, NoopAnimationsModule],
      providers: [{ provide: EmployeeExtraPaymentRegimeStore, useValue: store }],
    }).compileComponents();
    fix = TestBed.createComponent(EmployeeExtraPaymentRegimeSectionComponent);
    fix.componentRef.setInput('employeeBusinessKey', employeeKey);
    fix.detectChanges();
    c = fix.componentInstance as unknown as typeof c;
  });

  it('renders the table with the add action named after what it does', () => {
    const addButton = fix.nativeElement.querySelector('.section-heading__add-btn');
    expect(addButton).toBeTruthy();
    expect(addButton.textContent.trim()).toBe('Añadir régimen de pagas extras');
  });

  it('shows a row per working time, each with correct and remove', () => {
    store.extraPaymentRegimesState.set([
      extraPaymentRegime({ extraPaymentRegimeNumber: 2, startDate: '2026-03-16' }),
      extraPaymentRegime({ extraPaymentRegimeNumber: 1, endDate: '2026-03-15', isActive: false }),
    ]);
    fix.detectChanges();

    expect(fix.nativeElement.querySelectorAll('.temporal-section__row').length).toBe(2);
    expect(fix.nativeElement.querySelectorAll('[aria-label^="Editar"]').length).toBe(2);
    expect(fix.nativeElement.querySelectorAll('[aria-label^="Eliminar"]').length).toBe(2);
  });

  describe('adding a working time', () => {
    it('opens the add modal and asks for the plan of a working time from today, open', () => {
      fix.nativeElement.querySelector('.section-heading__add-btn').click();
      fix.detectChanges();

      expect(c.modalVisible()).toBe(true);
      expect(c.modalMode()).toBe('add');
      expect(c.modalTitle()).toBe('Añadir régimen de pagas extras');
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
      store.extraPaymentRegimesState.set([extraPaymentRegime()]);
      c.openAdd();
      c.startDateDraft.set('2026-03-16');
      fix.detectChanges();

      store.planState.set(
        acceptedPlan({
          adjustedOccurrence: {
            extraPaymentRegimeNumber: 1,
            before: { startDate: '2026-03-01', endDate: null },
            after: { startDate: '2026-03-01', endDate: '2026-03-15' },
          },
        }),
      );
      fix.detectChanges();

      expect(c.noteLines()).toEqual([
        'El régimen en vigor desde el 1 de marzo de 2026 se cerrará el 15 de marzo de 2026.',
      ]);
      expect(c.noteTone()).toBe('warning');
      expect(c.isSubmitEnabled()).toBe(true);

      c.submit();

      expect(store.createExtraPaymentRegime).toHaveBeenCalledWith(employeeKey, {
        startDate: '2026-03-16',
        endDate: null,
        prorated: false,
      });
    });

    it('sends the end date when the new working time is already closed', () => {
      c.openAdd();
      c.startDateDraft.set('2026-03-16');
      c.endDateDraft.set('2026-03-31');
      c.proratedDraft.set(true);
      fix.detectChanges();
      store.planState.set(acceptedPlan());
      fix.detectChanges();

      c.submit();

      expect(store.createExtraPaymentRegime).toHaveBeenCalledWith(employeeKey, {
        startDate: '2026-03-16',
        endDate: '2026-03-31',
        prorated: true,
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
            { extraPaymentRegimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
          ],
        }),
      );
      fix.detectChanges();

      expect(c.noteLines()).toEqual([
        'Quedaría un hueco del 3 al 7 de marzo de 2026.',
        'Antes se puede alargar el régimen del 1 al 2 de marzo de 2026.',
      ]);
      expect(c.noteTone()).toBe('error');
      expect(c.isSubmitEnabled()).toBe(false);

      c.submit();

      expect(store.createExtraPaymentRegime).not.toHaveBeenCalled();
    });

    /**
     * El alta que empieza el mismo día que otro régimen no es un alta (backend#58): el backend
     * la rechaza nombrando la que corregiría. La pantalla lo cuenta y ofrece el camino; la
     * regla no se replica aquí, solo se relata.
     */
    describe('un alta que en realidad es una corrección (frontend#46)', () => {
      const planIsACorrection = () =>
        acceptedPlan({
          accepted: false,
          rejection: 'IS_A_CORRECTION',
          correctedOccurrence: {
            extraPaymentRegimeNumber: 7,
            startDate: '2026-03-01',
            endDate: '2026-03-15',
          },
        });

      it('explains that it corrects the working time it names, and does not let it be confirmed', () => {
        c.openAdd();
        c.startDateDraft.set('2026-03-01');
        fix.detectChanges();
        store.planState.set(planIsACorrection());
        fix.detectChanges();

        expect(c.noteLines()).toEqual([
          'Ya hay un régimen del 1 al 15 de marzo de 2026: esto no es un alta, sino una corrección suya.',
        ]);
        expect(c.noteTone()).toBe('error');
        expect(c.isSubmitEnabled()).toBe(false);
        expect(c.correctionOffer()).toBe('Corregir el régimen desde el 1 de marzo de 2026');
      });

      it('switches to correcting that one without retyping the dates', () => {
        c.openAdd();
        c.startDateDraft.set('2026-03-01');
        c.endDateDraft.set('2026-03-20');
        c.proratedDraft.set(true);
        fix.detectChanges();
        store.planState.set(planIsACorrection());
        fix.detectChanges();

        c.switchToCorrection();
        fix.detectChanges();

        expect(c.modalMode()).toBe('correct');
        // Lo tecleado se queda: el gesto es seguir, no volver a empezar.
        expect(c.startDateDraft()).toBe('2026-03-01');
        expect(c.endDateDraft()).toBe('2026-03-20');
        expect(c.proratedDraft()).toBe(true);

        store.planState.set(acceptedPlan({ operation: 'CORRECT' }));
        fix.detectChanges();
        c.submit();

        // Y va al régimen que el backend nombró, por su número: no se ha convertido sola,
        // la ha confirmado el usuario.
        expect(store.updateExtraPaymentRegime).toHaveBeenCalledWith(employeeKey, 7, {
          startDate: '2026-03-01',
          endDate: '2026-03-20',
          prorated: true,
        });
        expect(store.createExtraPaymentRegime).not.toHaveBeenCalled();
      });
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
      store.extraPaymentRegimesState.set([
        extraPaymentRegime({ extraPaymentRegimeNumber: 2, startDate: '2026-03-16' }),
        extraPaymentRegime({ extraPaymentRegimeNumber: 1, endDate: '2026-03-15', isActive: false }),
      ]);
      fix.detectChanges();
    });

    it('opens the remove modal from the row and asks for its plan', () => {
      fix.nativeElement.querySelector('[aria-label^="Eliminar"]').click();
      fix.detectChanges();

      expect(c.modalVisible()).toBe(true);
      expect(c.modalMode()).toBe('remove');
      expect(c.submitLabel()).toBe('Eliminar régimen');
      expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
        operation: 'REMOVE',
        extraPaymentRegimeNumber: 2,
      });
    });

    it('warns that removing the last one reopens the previous one, then deletes', () => {
      c.openRemove(0);
      fix.detectChanges();
      store.planState.set(
        acceptedPlan({
          operation: 'REMOVE',
          occurrence: { extraPaymentRegimeNumber: 2, startDate: '2026-03-16', endDate: null },
          adjustedOccurrence: {
            extraPaymentRegimeNumber: 1,
            before: { startDate: '2026-03-01', endDate: '2026-03-15' },
            after: { startDate: '2026-03-01', endDate: null },
          },
        }),
      );
      fix.detectChanges();

      expect(c.noteLines()).toEqual([
        'El régimen anterior, desde el 1 de marzo de 2026, se reabrirá y quedará en vigor.',
      ]);
      expect(c.isSubmitEnabled()).toBe(true);

      c.submit();

      expect(store.deleteExtraPaymentRegime).toHaveBeenCalledWith(employeeKey, 2);
    });
  });

  describe('correcting a working time', () => {
    it('plans the correction with the row dates and saves them with the end date', () => {
      store.extraPaymentRegimesState.set([
        extraPaymentRegime({ extraPaymentRegimeNumber: 1, endDate: '2026-03-15', isActive: false }),
      ]);
      fix.detectChanges();

      c.openCorrect(0);
      fix.detectChanges();

      expect(c.modalMode()).toBe('correct');
      expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
        operation: 'CORRECT',
        extraPaymentRegimeNumber: 1,
        startDate: '2026-03-01',
        endDate: '2026-03-15',
      });

      c.endDateDraft.set('2026-03-20');
      c.proratedDraft.set(true);
      fix.detectChanges();
      store.planState.set(acceptedPlan({ operation: 'CORRECT' }));
      fix.detectChanges();

      expect(c.noteLines()).toEqual(['No cambia ningún otro régimen.']);

      c.submit();

      expect(store.updateExtraPaymentRegime).toHaveBeenCalledWith(employeeKey, 1, {
        startDate: '2026-03-01',
        endDate: '2026-03-20',
        prorated: true,
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
