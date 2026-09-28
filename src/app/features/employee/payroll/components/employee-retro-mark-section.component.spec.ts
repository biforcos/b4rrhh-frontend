import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmployeeRetroMarkStore } from '../../data-access/employee-retro-mark.store';
import { EmployeeRetroMarkModel } from '../../models/employee-retro-mark.model';
import { EmployeeRetroMarkSectionComponent } from './employee-retro-mark-section.component';

const employeeKey = { ruleSystemCode: 'ESP', employeeTypeCode: 'INTERNAL', employeeNumber: '0013' };

class MockRetroMarkStore {
  readonly marksState = signal<ReadonlyArray<EmployeeRetroMarkModel>>([]);
  readonly marks = this.marksState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly errorState = signal<string | null>(null);
  readonly error = this.errorState.asReadonly();
  readonly successState = signal<string | null>(null);
  readonly success = this.successState.asReadonly();
  readonly loadMarks = vi.fn();
  readonly discardMark = vi.fn();
  readonly clearFeedback = vi.fn();
}

const mark = (overrides: Partial<EmployeeRetroMarkModel> = {}): EmployeeRetroMarkModel => ({
  id: 1,
  presenceNumber: 1,
  fromPeriodCode: '202608',
  status: 'ACTIVE',
  createdAt: '2026-09-27T02:10:00',
  sourceVerticalCode: 'PAYROLL_INPUT',
  sourceTable: 'employee.employee_payroll_input',
  sourceRowLabel: 'H01/202608',
  discardedAt: null,
  discardedBy: null,
  discardReason: null,
  consumedAt: null,
  consumedPeriodCode: null,
  consumedRunId: null,
  withoutAReceiptToPayIt: false,
  ...overrides,
});

/**
 * Las marcas de retroactividad en la ficha (`b4rrhh/frontend#86`, contrato del `b4rrhh/backend#130`).
 *
 * <p>Lo que estos tests defienden son las tres decisiones, no el dibujo:
 *
 * <ol>
 *   <li>Es de **sólo lectura** salvo un verbo. Las marcas las ponen los escritores por un único
 *       puerto, y una pantalla que dejara crear una a mano sería una segunda puerta a la misma
 *       tabla — justo lo que el candado de arquitectura del `#130` existe para impedir.</li>
 *   <li>**Descartar no borra.** La fila se queda, en su estado, con quién y por qué: el recibo tiene
 *       que poder contar que había una corrección conocida que alguien decidió no pagar.</li>
 *   <li>El motivo es **obligatorio**. Sin motivo el backend contesta 422, y una fila descartada sin
 *       porqué no explica nada seis meses después.</li>
 * </ol>
 */
describe('EmployeeRetroMarkSectionComponent', () => {
  let fix: ComponentFixture<EmployeeRetroMarkSectionComponent>;
  let store: MockRetroMarkStore;
  let c: {
    discardingId: () => number | null;
    discardReason: () => string;
    canDiscard: () => boolean;
    startDiscard: (row: EmployeeRetroMarkModel) => void;
    updateDiscardReason: (value: string) => void;
    confirmDiscard: () => void;
    cancel: () => void;
    describeOrigin: (row: EmployeeRetroMarkModel) => string;
    describeStatus: (row: EmployeeRetroMarkModel) => string;
    verticalLabel: (row: EmployeeRetroMarkModel) => string;
    offersDiscard: (row: EmployeeRetroMarkModel) => boolean;
  };

  beforeEach(async () => {
    store = new MockRetroMarkStore();
    await TestBed.configureTestingModule({
      imports: [EmployeeRetroMarkSectionComponent],
      providers: [{ provide: EmployeeRetroMarkStore, useValue: store }],
    }).compileComponents();
    fix = TestBed.createComponent(EmployeeRetroMarkSectionComponent);
    fix.componentRef.setInput('employeeBusinessKey', employeeKey);
    fix.detectChanges();
    c = fix.componentInstance as unknown as typeof c;
  });

  it('pide las marcas del empleado', () => {
    expect(store.loadMarks).toHaveBeenCalledWith(employeeKey);
  });

  /**
   * El caso de la captura del issue: dos marcas activas de dos verticales distintas. Y lo que se
   * lee de cada una es lo que el `#130` guarda: hasta qué mes, cuándo, qué vertical y qué fila.
   */
  it('una fila por marca, con su mes, su vertical y la fila que la generó', () => {
    store.marksState.set([
      mark(),
      mark({
        id: 2,
        fromPeriodCode: '202607',
        sourceVerticalCode: 'ABSENCE',
        sourceTable: 'employee.employee_absence',
        sourceRowLabel: '4411',
      }),
    ]);
    fix.detectChanges();

    const filas = fix.nativeElement.querySelectorAll('.employee-retro-mark-section__row');
    expect(filas.length).toBe(2);
    expect(c.describeOrigin(mark())).toContain('08/2026');
    expect(c.verticalLabel(mark())).toBe('Entrada de nómina');
    expect(c.verticalLabel(mark({ sourceVerticalCode: 'ABSENCE' }))).toBe('Ausencia');
    expect(fix.nativeElement.textContent).toContain('employee.employee_absence');
  });

  /** Un código de vertical que esta pantalla no conozca sale tal cual: es mejor que un hueco. */
  it('una vertical sin nombre sale con su código', () => {
    expect(c.verticalLabel(mark({ sourceVerticalCode: 'LO_QUE_SEA' }))).toBe('LO_QUE_SEA');
  });

  it('sin marcas lo dice, y no enseña una lista vacía', () => {
    expect(fix.nativeElement.querySelector('.employee-retro-mark-section__empty')).toBeTruthy();
    expect(fix.nativeElement.querySelectorAll('.employee-retro-mark-section__row').length).toBe(0);
  });

  /**
   * Sólo lectura más un verbo: no hay «añadir». La cabecera de una sección que ofreciera crear
   * sería una segunda puerta a una tabla que sólo escriben los verticales por su puerto.
   */
  it('no ofrece crear una marca', () => {
    expect(fix.nativeElement.querySelector('.section-heading__add-btn')).toBeNull();
  });

  it('descartar pide un motivo, y sin él no se manda nada', () => {
    store.marksState.set([mark()]);
    fix.detectChanges();

    c.startDiscard(mark());
    fix.detectChanges();

    expect(c.discardingId()).toBe(1);
    expect(c.canDiscard()).toBe(false);

    c.confirmDiscard();
    expect(store.discardMark).not.toHaveBeenCalled();

    c.updateDiscardReason('   ');
    expect(c.canDiscard()).toBe(false);

    c.updateDiscardReason('Las horas ya se pagaron en mano en agosto');
    expect(c.canDiscard()).toBe(true);

    c.confirmDiscard();
    expect(store.discardMark).toHaveBeenCalledWith(
      employeeKey,
      1,
      'Las horas ya se pagaron en mano en agosto',
    );
  });

  /**
   * Y la descartada **sigue en la lista**. Es la razón de que descartar no borre: sin la fila, el
   * recibo del mes abierto no puede contar que había una corrección que alguien decidió no pagar.
   */
  it('una marca descartada sigue visible, con quién y por qué', () => {
    store.marksState.set([
      // El instante tal y como lo manda el backend: ISO con microsegundos y zona. Con
      // `formatDisplayDate` salía crudo en la pantalla —esa función espera una fecha y devuelve lo
      // que no entiende tal cual—, y este test pasaba igual porque sólo miraba el nombre. Por eso
      // ahora se mira la fecha, y se mira que el ISO NO esté.
      mark({
        status: 'DISCARDED',
        discardedAt: '2026-09-27T07:34:28.024180Z',
        discardedBy: 'bifor',
        discardReason: 'Las horas ya se pagaron en mano en agosto',
      }),
    ]);
    fix.detectChanges();

    const texto = fix.nativeElement.textContent;
    expect(fix.nativeElement.querySelectorAll('.employee-retro-mark-section__row').length).toBe(1);
    expect(texto).toContain('Descartada');
    expect(texto).toContain('bifor');
    expect(texto).toContain('Las horas ya se pagaron en mano en agosto');
    // Europe/Madrid, que es lo que la suite fija (`b4rrhh/frontend#81`): 07:34 Z son las 09:34.
    expect(texto).toContain('27/09/2026 09:34');
    expect(texto).not.toContain('2026-09-27T');
  });

  /** Y ya no se puede volver a descartar: el backend contesta 409 y la pantalla no lo ofrece. */
  it('descartar sólo se ofrece sobre una marca activa', () => {
    expect(c.offersDiscard(mark())).toBe(true);
    expect(c.offersDiscard(mark({ status: 'DISCARDED' }))).toBe(false);
    expect(c.offersDiscard(mark({ status: 'CONSUMED' }))).toBe(false);
  });

  /** Una consumida dice qué recibo la pagó: es lo que cierra su historia. */
  /**
   * Una marca activa de una presencia cesada, con su último recibo ya cerrado, no la paga nadie
   * (`b4rrhh/backend#139`): no se paga en la presencia nueva —sería un finiquito complementario—, y
   * «pendiente de pagar» diría algo que no va a pasar. Se dice por qué lleva meses ahí.
   */
  it('una marca sin recibo que la pague lo dice, y no «pendiente»', () => {
    expect(c.describeStatus(mark({ withoutAReceiptToPayIt: true }))).toBe(
      'Sin recibo que la pague: su presencia cesó y su último mes está cerrado',
    );
    expect(c.describeStatus(mark())).toBe('Pendiente de pagar');
  });

  it('una marca consumida dice el recibo que la pagó', () => {
    store.marksState.set([
      mark({
        status: 'CONSUMED',
        consumedAt: '2026-09-27T02:15:00',
        consumedPeriodCode: '202609',
        consumedRunId: 5,
      }),
    ]);
    fix.detectChanges();

    expect(c.describeStatus(mark({ status: 'CONSUMED', consumedPeriodCode: '202609' }))).toContain(
      '09/2026',
    );
    expect(fix.nativeElement.textContent).toContain('Pagada');
  });

  it('no se edita nada en sitio: la única acción sobre una marca es descartarla', () => {
    store.marksState.set([mark()]);
    fix.detectChanges();

    const acciones = Array.from(
      fix.nativeElement.querySelectorAll('.employee-retro-mark-section__row button'),
    ).map((b) => (b as HTMLElement).textContent?.trim());
    expect(acciones).toEqual(['Descartar']);
  });
});

/**
 * Las correcciones en «lo que pasa cada mes» (`b4rrhh/frontend#90`): con el mes de la página, las
 * que van a ese mes o se pagaron en él. Una pendiente de otro mes no se esconde: se dice dónde está.
 */
describe('EmployeeRetroMarkSectionComponent con el mes de la página', () => {
  let fix: ComponentFixture<EmployeeRetroMarkSectionComponent>;
  let store: MockRetroMarkStore;

  beforeEach(async () => {
    store = new MockRetroMarkStore();
    await TestBed.configureTestingModule({
      imports: [EmployeeRetroMarkSectionComponent],
      providers: [{ provide: EmployeeRetroMarkStore, useValue: store }],
    }).compileComponents();
    fix = TestBed.createComponent(EmployeeRetroMarkSectionComponent);
    fix.componentRef.setInput('employeeBusinessKey', employeeKey);
    store.marksState.set([
      mark({ id: 1, fromPeriodCode: '202608' }),
      mark({
        id: 2,
        fromPeriodCode: '202607',
        status: 'CONSUMED',
        consumedPeriodCode: '202608',
        consumedRunId: 8,
      }),
      mark({ id: 3, fromPeriodCode: '202603' }),
    ]);
  });

  const rows = () => fix.nativeElement.querySelectorAll('.employee-retro-mark-section__row').length;

  it('sin mes, las enseña todas, como antes', () => {
    fix.detectChanges();
    expect(rows()).toBe(3);
  });

  it('con un mes, las que van a él y las que se pagaron en él', () => {
    fix.componentRef.setInput('period', 202608);
    fix.detectChanges();
    expect(rows()).toBe(2);
  });

  it('la pendiente de otro mes se dice, y a un clic', () => {
    const pedidos: number[] = [];
    fix.componentRef.setInput('period', 202608);
    fix.componentRef.instance.periodRequested.subscribe((p: number) => pedidos.push(p));
    fix.detectChanges();
    const botones: HTMLButtonElement[] = Array.from(
      fix.nativeElement.querySelectorAll('.other-months__month'),
    );
    expect(botones.map((b) => b.textContent?.trim())).toEqual(['03/2026']);
    botones[0].click();
    expect(pedidos).toEqual([202603]);
  });
});
