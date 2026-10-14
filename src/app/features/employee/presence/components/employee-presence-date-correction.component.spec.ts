import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { BASE_PATH } from '../../../../core/api/generated/variables';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import {
  EmployeeWritesNotifier,
  employeeWritesInterceptor,
} from '../../data-access/employee-writes.interceptor';
import { employeeTexts } from '../../employee.texts';
import { EmployeePresenceDateCorrectionComponent } from './employee-presence-date-correction.component';

const URL = 'http://localhost:8080/employees/ESP/INTERNAL/EMP000901/presences/1/rectify-start-date';

const PLAN = {
  presenceNumber: 1,
  field: 'START_DATE',
  oldDate: '2026-10-01',
  newDate: '2026-09-29',
  dryRun: true,
  moves: [
    {
      vertical: 'presence',
      label: 'La presencia 1',
      startDate: '2026-10-01',
      endDate: null,
      newStartDate: '2026-09-29',
      newEndDate: null,
    },
    {
      vertical: 'contract',
      label: 'El contrato 100',
      startDate: '2026-10-01',
      endDate: null,
      newStartDate: '2026-09-29',
      newEndDate: null,
    },
    {
      vertical: 'working_time',
      label: 'La jornada del 100 %',
      startDate: '2026-10-01',
      endDate: null,
      newStartDate: '2026-09-29',
      newEndDate: null,
    },
  ],
};

/**
 * Corregir la fecha de alta (`b4rrhh/frontend#135`): la tarea 1 de `workspace#18` acababa en «jaque
 * mate». Antes de confirmar se enseña lo que va a mover, nombrado; si el servidor se niega, su porqué
 * con sus palabras; y el ensayo no relee la ficha, la corrección sí.
 */
describe('EmployeePresenceDateCorrectionComponent', () => {
  let fixture: ComponentFixture<EmployeePresenceDateCorrectionComponent>;
  let http: HttpTestingController;
  let messages: Record<string, ReturnType<typeof vi.fn>>;
  let writes: string[];
  let closed: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(async () => {
    messages = { success: vi.fn(), setSourceMessages: vi.fn(), clearSourceMessages: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [EmployeePresenceDateCorrectionComponent],
      providers: [
        provideHttpClient(withInterceptors([employeeWritesInterceptor])),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: BASE_PATH, useValue: 'http://localhost:8080' },
        { provide: GlobalMessageService, useValue: messages },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    writes = [];
    TestBed.inject(EmployeeWritesNotifier).writes$.subscribe((key) =>
      writes.push(key.employeeNumber),
    );
    fixture = TestBed.createComponent(EmployeePresenceDateCorrectionComponent);
    closed = vi.fn<() => void>();
    fixture.componentInstance.closed.subscribe(() => closed());
    fixture.componentRef.setInput('employeeKey', {
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP000901',
    });
    fixture.componentRef.setInput('presenceNumber', 1);
    fixture.componentRef.setInput('field', 'START_DATE');
    fixture.componentRef.setInput('currentDate', '2026-10-01');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const dialog = () =>
    document.body.querySelector('app-period-modal [role="dialog"]') as HTMLElement | null;
  const submit = () =>
    dialog()?.querySelector('.period-modal__submit-btn') as HTMLButtonElement | null;
  const text = () => dialog()?.textContent?.replace(/\s+/g, ' ') ?? '';

  function type(date: string): void {
    fixture.debugElement
      .query(By.directive(UiDateInputComponent))
      .componentInstance.valueChanged.emit(date);
    fixture.detectChanges();
  }

  /** El ensayo que sale al escribir la fecha. */
  function trial(): TestRequest {
    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({ newDate: '2026-09-29', dryRun: true });
    return req;
  }

  it('dice qué presencia y qué alta corrige, y no deja confirmar sin fecha', () => {
    expect(text()).toContain(employeeTexts.presenceCorrectStartTitle);
    expect(text()).toContain('Presencia 1: alta del 01/10/2026');
    expect(submit()?.disabled).toBe(true);
  });

  it('con la fecha escrita, ensaya y enseña lo que también cambia, nombrado', () => {
    type('2026-09-29');
    trial().flush(PLAN);
    fixture.detectChanges();

    expect(text()).toContain('Pasa del 01/10/2026 al 29/09/2026.');
    expect(text()).toContain(employeeTexts.presenceCorrectAlsoMovesLabel);
    expect(text()).toContain('El contrato 100: desde el 01/10/2026 → desde el 29/09/2026');
    expect(text()).toContain('La jornada del 100 %');
    expect(submit()?.disabled).toBe(false);
    // El ensayo no es una escritura: la ficha no se relee a cada fecha.
    expect(writes).toEqual([]);
  });

  it('si el servidor se niega, enseña su porqué con sus palabras y no deja confirmar', () => {
    type('2026-09-29');
    trial().flush(
      {
        code: 'PRESENCE_RECTIFICATION_PAID',
        message:
          'La presencia 1 tiene recibos definitivos (202609): su alta ya se pagó y no se rectifica por debajo.',
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(text()).toContain('tiene recibos definitivos (202609)');
    expect(submit()?.disabled).toBe(true);
  });

  it('al confirmar corrige de verdad, avisa, cierra, y la ficha se relee', () => {
    type('2026-09-29');
    trial().flush(PLAN);
    fixture.detectChanges();

    submit()?.click();
    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({ newDate: '2026-09-29', dryRun: false });
    req.flush({ ...PLAN, dryRun: false });

    expect(messages['success']).toHaveBeenCalledWith(
      `${employeeTexts.presenceCorrectDoneMessage}: 01/10/2026 → 29/09/2026.`,
      expect.objectContaining({ id: 'employee-presence-date-corrected' }),
    );
    expect(closed).toHaveBeenCalled();
    expect(writes).toEqual(['EMP000901']);
  });
});
