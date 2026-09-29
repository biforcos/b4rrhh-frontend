import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeAbsenceStore } from '../../data-access/employee-absence.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeeAbsenceModel } from '../../models/employee-absence.model';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { currentLocalDate } from '../../../../shared/utils/local-date.util';
import { HttpFailure } from '../../../../shared/utils/http-failure.util';
import { EmployeeAbsenceSectionComponent } from './employee-absence-section.component';

const employeeKey = { ruleSystemCode: 'ESP', employeeTypeCode: 'INTERNAL', employeeNumber: '0001' };

type AbsenceSuccess = 'saved' | 'deleted' | null;

class MockAbsenceStore {
  readonly absencesState = signal<ReadonlyArray<EmployeeAbsenceModel>>([]);
  readonly absences = this.absencesState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly errorState = signal<string | null>(null);
  readonly error = this.errorState.asReadonly();
  readonly successState = signal<AbsenceSuccess>(null);
  readonly success = this.successState.asReadonly();
  readonly failureState = signal<HttpFailure | null>(null);
  readonly failure = this.failureState.asReadonly();
  readonly loadAbsences = vi.fn();
  readonly saveAbsence = vi.fn();
  readonly deleteAbsence = vi.fn();
  readonly setTypeLabels = vi.fn();
  readonly clearFeedback = vi.fn();
}

class MockCatalog {
  readonly loadAbsenceTypeOptions = vi.fn(() =>
    of([
      { value: 'VACATION', label: 'Vacaciones' },
      { value: 'IT_COMMON', label: 'IT Contingencia Común' },
      { value: 'UNPAID_LEAVE', label: 'Excedencia' },
    ] as ReadonlyArray<SlotKeyOption<string>>),
  );
}

const absence = (overrides: Partial<EmployeeAbsenceModel> = {}): EmployeeAbsenceModel => ({
  absenceTypeCode: 'VACATION',
  absenceTypeLabel: 'Vacaciones',
  startDate: '2026-05-14',
  endDate: '2026-05-18',
  benefitEntitled: true,
  isOpen: false,
  ...overrides,
});

/**
 * La sección de ausencias (`b4rrhh/frontend#84`).
 *
 * <p>Lo que estos tests defienden no es el dibujo, son las tres decisiones de la sección: que el
 * testigo de derecho sólo exista donde significa algo, que el inicio no se pueda corregir porque es
 * la clave, y que las acciones se llamen por lo que hacen y no «Editar» (ADR-010, ADR-016).
 */
describe('EmployeeAbsenceSectionComponent', () => {
  let fix: ComponentFixture<EmployeeAbsenceSectionComponent>;
  let store: MockAbsenceStore;
  let catalog: MockCatalog;
  /** La superficie protegida del componente, para no pasar por el DOM en lo que es estado. */
  let c: {
    declaring: () => boolean;
    editingKey: () => string | null;
    deletingKey: () => string | null;
    draft: () => {
      absenceTypeCode: string;
      startDate: string;
      endDate: string;
      benefitEntitled: boolean;
    };
    draftHasEntitlement: () => boolean;
    canSave: () => boolean;
    startDeclare: () => void;
    startEdit: (row: EmployeeAbsenceModel) => void;
    requestDelete: (row: EmployeeAbsenceModel) => void;
    cancel: () => void;
    submit: () => void;
    confirmDelete: (row: EmployeeAbsenceModel) => void;
    updateDraftType: (value: string) => void;
    updateDraftEndDate: (value: string) => void;
    updateDraftEntitlement: (value: boolean) => void;
    editLabel: (row: EmployeeAbsenceModel) => string;
    describePeriod: (row: EmployeeAbsenceModel) => string;
  };

  beforeEach(async () => {
    store = new MockAbsenceStore();
    catalog = new MockCatalog();
    await TestBed.configureTestingModule({
      imports: [EmployeeAbsenceSectionComponent],
      providers: [
        { provide: EmployeeAbsenceStore, useValue: store },
        { provide: EmployeeFieldCatalogService, useValue: catalog },
      ],
    }).compileComponents();
    fix = TestBed.createComponent(EmployeeAbsenceSectionComponent);
    fix.componentRef.setInput('employeeBusinessKey', employeeKey);
    fix.detectChanges();
    c = fix.componentInstance as unknown as typeof c;
  });

  it('carga las ausencias del empleado y los tipos de su sistema de reglas', () => {
    expect(store.loadAbsences).toHaveBeenCalledWith(employeeKey);
    expect(catalog.loadAbsenceTypeOptions).toHaveBeenCalledWith('ESP', currentLocalDate());
  });

  it('la accion de anadir se llama «Declarar ausencia»', () => {
    const boton = fix.nativeElement.querySelector('.section-heading__add-btn');
    expect(boton).toBeTruthy();
    expect(boton.textContent.trim()).toBe('Declarar ausencia');
  });

  it('sin ausencias lo dice, y no ensena una tabla vacia', () => {
    expect(fix.nativeElement.querySelector('.employee-absence-section__empty')).toBeTruthy();
    expect(fix.nativeElement.querySelectorAll('.employee-absence-section__row').length).toBe(0);
  });

  it('una fila por ausencia, con su periodo escrito', () => {
    store.absencesState.set([
      absence(),
      absence({
        absenceTypeCode: 'IT_COMMON',
        startDate: '2026-04-01',
        endDate: null,
        isOpen: true,
      }),
    ]);
    fix.detectChanges();

    expect(fix.nativeElement.querySelectorAll('.employee-absence-section__row').length).toBe(2);
    expect(c.describePeriod(absence())).toBe('Del 14/05/2026 al 18/05/2026');
    expect(c.describePeriod(absence({ endDate: null, isOpen: true }))).toBe(
      'Desde el 14/05/2026, sin cerrar',
    );
  });

  /**
   * La mitad que hace que el resto diga algo: en una vacación el testigo no se enseña. Sin este
   * caso, una implementación que lo enseñara siempre pasaría todos los demás tests.
   */
  it('el testigo de derecho solo se ensena en la baja por enfermedad comun', () => {
    store.absencesState.set([
      absence({ absenceTypeCode: 'IT_COMMON', benefitEntitled: false }),
      absence({ absenceTypeCode: 'VACATION' }),
    ]);
    fix.detectChanges();

    const testigos = fix.nativeElement.querySelectorAll(
      '.employee-absence-section__row-entitlement',
    );
    expect(testigos.length).toBe(1);
    expect(testigos[0].textContent.trim()).toBe('Sin derecho a prestación');
  });

  it('y con derecho lo dice tambien, que es lo normal', () => {
    store.absencesState.set([absence({ absenceTypeCode: 'IT_COMMON', benefitEntitled: true })]);
    fix.detectChanges();

    expect(
      fix.nativeElement
        .querySelector('.employee-absence-section__row-entitlement')
        .textContent.trim(),
    ).toBe('Con derecho a prestación');
  });

  describe('declarar una ausencia', () => {
    it('arranca vacia, de hoy, abierta y con derecho', () => {
      c.startDeclare();
      fix.detectChanges();

      expect(c.declaring()).toBe(true);
      expect(c.draft()).toEqual({
        absenceTypeCode: '',
        startDate: currentLocalDate(),
        endDate: '',
        benefitEntitled: true,
      });
      expect(c.canSave()).toBe(false);
    });

    it('la casilla del testigo aparece al elegir la baja y desaparece al elegir otra cosa', () => {
      c.startDeclare();
      c.updateDraftType('IT_COMMON');
      fix.detectChanges();
      expect(c.draftHasEntitlement()).toBe(true);
      expect(
        fix.nativeElement.querySelector('.employee-absence-section__field--check'),
      ).toBeTruthy();

      c.updateDraftType('VACATION');
      fix.detectChanges();
      expect(c.draftHasEntitlement()).toBe(false);
      expect(fix.nativeElement.querySelector('.employee-absence-section__field--check')).toBeNull();
    });

    it('un fin anterior al inicio no se puede mandar', () => {
      c.startDeclare();
      c.updateDraftType('VACATION');
      c.updateDraftEndDate('1999-01-01');
      fix.detectChanges();

      expect(c.canSave()).toBe(false);
      c.submit();
      expect(store.saveAbsence).not.toHaveBeenCalled();
    });

    it('manda el testigo en una baja y NO lo manda en una vacacion', () => {
      c.startDeclare();
      c.updateDraftType('IT_COMMON');
      c.updateDraftEntitlement(false);
      c.submit();

      expect(store.saveAbsence).toHaveBeenLastCalledWith(employeeKey, {
        absenceTypeCode: 'IT_COMMON',
        startDate: currentLocalDate(),
        endDate: null,
        benefitEntitled: false,
      });

      c.startDeclare();
      c.updateDraftType('VACATION');
      c.submit();

      expect(store.saveAbsence).toHaveBeenLastCalledWith(employeeKey, {
        absenceTypeCode: 'VACATION',
        startDate: currentLocalDate(),
        endDate: null,
        // Nulo y no `true`: en una vacación el derecho a prestación no significa nada, y la
        // pantalla no inventa un valor para un campo que no aplica.
        benefitEntitled: null,
      });
    });
  });

  describe('corregir una ausencia', () => {
    it('la accion se llama «Cerrar» si esta abierta y «Corregir el fin» si ya tiene uno', () => {
      expect(c.editLabel(absence({ endDate: null, isOpen: true }))).toBe('Cerrar');
      expect(c.editLabel(absence())).toBe('Corregir el fin');
    });

    it('trae el fin y el testigo de la fila, y deja cambiar solo esos dos', () => {
      const fila = absence({ absenceTypeCode: 'IT_COMMON', benefitEntitled: false });
      store.absencesState.set([fila]);
      fix.detectChanges();

      c.startEdit(fila);
      fix.detectChanges();

      expect(c.editingKey()).toBe('IT_COMMON|2026-05-14');
      expect(c.draft().endDate).toBe('2026-05-18');
      expect(c.draft().benefitEntitled).toBe(false);
      // El tipo y el inicio se llevan al borrador para poder mandarlos, y no hay control para
      // cambiarlos: son la clave de negocio de la ausencia.
      expect(c.draft().absenceTypeCode).toBe('IT_COMMON');
      expect(c.draft().startDate).toBe('2026-05-14');
      expect(fix.nativeElement.querySelector('app-ui-select')).toBeNull();
    });

    it('quitarle el derecho a una baja lo manda tal cual', () => {
      const fila = absence({ absenceTypeCode: 'IT_COMMON', benefitEntitled: true });
      store.absencesState.set([fila]);
      fix.detectChanges();

      c.startEdit(fila);
      c.updateDraftEntitlement(false);
      c.submit();

      expect(store.saveAbsence).toHaveBeenLastCalledWith(employeeKey, {
        absenceTypeCode: 'IT_COMMON',
        startDate: '2026-05-14',
        endDate: '2026-05-18',
        benefitEntitled: false,
      });
    });
  });

  describe('borrar una ausencia', () => {
    it('pide confirmacion y dice que borrar es como se arregla un inicio mal puesto', () => {
      const fila = absence();
      store.absencesState.set([fila]);
      fix.detectChanges();

      c.requestDelete(fila);
      fix.detectChanges();

      expect(c.deletingKey()).toBe('VACATION|2026-05-14');
      const aviso = fix.nativeElement.querySelector('.employee-absence-section__confirm-text');
      expect(aviso.textContent).toContain('vuelve a declararla');
      expect(store.deleteAbsence).not.toHaveBeenCalled();
    });

    it('al confirmar borra por su clave de negocio', () => {
      const fila = absence();
      store.absencesState.set([fila]);
      fix.detectChanges();

      c.requestDelete(fila);
      c.confirmDelete(fila);

      expect(store.deleteAbsence).toHaveBeenCalledWith(employeeKey, 'VACATION', '2026-05-14');
    });

    it('cancelar no borra nada', () => {
      const fila = absence();
      store.absencesState.set([fila]);
      fix.detectChanges();

      c.requestDelete(fila);
      c.cancel();
      fix.detectChanges();

      expect(c.deletingKey()).toBeNull();
      expect(store.deleteAbsence).not.toHaveBeenCalled();
    });
  });

  /**
   * Un catálogo que falla deja la sección utilizable para lo que ya hay.
   *
   * <p>Es la diferencia entre no poder declarar una ausencia nueva y no poder ver las que tiene. Lo
   * segundo sería dejar la pantalla en blanco por no poder rellenar un desplegable.
   */
  it('si el catalogo de tipos falla, las filas que ya hay se siguen viendo', async () => {
    catalog.loadAbsenceTypeOptions.mockReturnValue(
      throwError(() => new Error('catalogo caido')) as never,
    );
    const otra = TestBed.createComponent(EmployeeAbsenceSectionComponent);
    otra.componentRef.setInput('employeeBusinessKey', employeeKey);
    store.absencesState.set([absence()]);
    otra.detectChanges();

    expect(otra.nativeElement.querySelectorAll('.employee-absence-section__row').length).toBe(1);
  });
});

/**
 * Las ausencias en «lo que pasa cada mes» (`b4rrhh/frontend#90`): con el navegador de período de la
 * página, la sección enseña las que tocan ese mes. Las de otros meses no desaparecen en silencio:
 * se dicen, y a un clic.
 */
describe('EmployeeAbsenceSectionComponent con el mes de la página', () => {
  let fix: ComponentFixture<EmployeeAbsenceSectionComponent>;
  let store: MockAbsenceStore;

  beforeEach(async () => {
    store = new MockAbsenceStore();
    await TestBed.configureTestingModule({
      imports: [EmployeeAbsenceSectionComponent],
      providers: [
        { provide: EmployeeAbsenceStore, useValue: store },
        { provide: EmployeeFieldCatalogService, useValue: new MockCatalog() },
      ],
    }).compileComponents();
    fix = TestBed.createComponent(EmployeeAbsenceSectionComponent);
    fix.componentRef.setInput('employeeBusinessKey', employeeKey);
    store.absencesState.set([
      absence({ startDate: '2026-05-14', endDate: '2026-05-18' }),
      absence({ absenceTypeCode: 'IT_COMMON', startDate: '2026-03-01', endDate: '2026-03-05' }),
      absence({
        absenceTypeCode: 'UNPAID_LEAVE',
        startDate: '2026-04-20',
        endDate: null,
        isOpen: true,
      }),
      absence({ startDate: '2026-04-28', endDate: '2026-05-02' }),
    ]);
  });

  const rowsText = () =>
    Array.from(fix.nativeElement.querySelectorAll('.employee-absence-section__row')).map(
      (row) => (row as HTMLElement).textContent ?? '',
    );

  it('sin mes, las enseña todas, como antes', () => {
    fix.detectChanges();
    expect(rowsText().length).toBe(4);
  });

  it('con un mes, sólo las que lo tocan: las que caen dentro, las que lo cruzan y las abiertas', () => {
    fix.componentRef.setInput('period', 202605);
    fix.detectChanges();
    const rows = rowsText();
    expect(rows.length).toBe(3);
    expect(rows.some((r) => r.includes('01/03/2026'))).toBe(false);
  });

  it('dice en qué otros meses hay, y llevarle a uno es pedírselo a la página', () => {
    const pedidos: number[] = [];
    fix.componentRef.setInput('period', 202605);
    fix.componentRef.instance.periodRequested.subscribe((p: number) => pedidos.push(p));
    fix.detectChanges();
    const botones: HTMLButtonElement[] = Array.from(
      fix.nativeElement.querySelectorAll('.other-months__month'),
    );
    expect(botones.map((b) => b.textContent?.trim())).toEqual(['03/2026']);
    botones[0].click();
    expect(pedidos).toEqual([202603]);
  });

  it('un mes sin ninguna dice que en ese mes no hay, no que no haya ninguna', () => {
    fix.componentRef.setInput('period', 202601);
    fix.detectChanges();
    expect(rowsText().length).toBe(0);
    const vacio = fix.nativeElement.querySelector('.employee-absence-section__empty');
    expect(vacio.textContent).toContain('este mes');
  });

  // El servidor dice en qué presencia empieza y cuándo acaba (`b4rrhh/backend#147`): eso es lo que
  // hay que corregir, y una frase fija lo taparía.
  describe('fuera de la presencia', () => {
    const sectionError = () =>
      (
        fix.componentInstance as unknown as { sectionState: () => { errorMessage: string | null } }
      ).sectionState().errorMessage;

    it('enseña lo que dice el servidor', () => {
      store.errorState.set('outside-presence');
      store.failureState.set({
        status: 422,
        serverMessage: 'La ausencia empieza en la presencia 1 (del 14/11/2025 al 13/05/2026)',
      } as HttpFailure);
      expect(sectionError()).toBe(
        'La ausencia empieza en la presencia 1 (del 14/11/2025 al 13/05/2026)',
      );
    });

    it('y si el servidor no dice nada, la frase de siempre', () => {
      store.errorState.set('outside-presence');
      expect(sectionError()).toBe(
        'Esas fechas caen fuera del período en que el empleado estuvo en la empresa.',
      );
    });
  });
});
