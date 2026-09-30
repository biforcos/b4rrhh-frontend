import { of } from 'rxjs';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { EmployeeTerminatePanelComponent } from './employee-terminate-panel.component';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { BASE_PATH } from '../../../../core/api/generated/variables';
import { employeeTexts } from '../../employee.texts';

const URL = 'http://localhost:8080/employees/ESP/INTERNAL/EMP001/terminate';

/**
 * El cese es un modal como los demás de la ficha (`b4rrhh/frontend#98`): «la ventana del cese está
 * ahí tirada, sin estilos». Va sobre el molde compartido (`app-period-modal`), con sus verbos, y
 * el motivo con su literal en castellano (`b4rrhh/backend#143`).
 */
describe('EmployeeTerminatePanelComponent', () => {
  let fixture: ComponentFixture<EmployeeTerminatePanelComponent>;
  let component: EmployeeTerminatePanelComponent;
  let http: HttpTestingController;
  let messages: { success: ReturnType<typeof vi.fn> } & Record<string, ReturnType<typeof vi.fn>>;
  let closed: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(async () => {
    messages = {
      success: vi.fn(),
      setSourceMessages: vi.fn(),
      clearSourceMessages: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [EmployeeTerminatePanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: BASE_PATH, useValue: 'http://localhost:8080' },
        {
          provide: EmployeeFieldCatalogService,
          useValue: {
            loadPresenceExitReasonOptions: vi.fn(() =>
              of([
                { value: 'TERMINATION', label: 'Cese · TERMINATION' },
                { value: 'RETIREMENT', label: 'Jubilación · RETIREMENT' },
              ]),
            ),
          },
        },
        { provide: GlobalMessageService, useValue: messages },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmployeeTerminatePanelComponent);
    component = fixture.componentInstance;
    closed = vi.fn<() => void>();
    component.closed.subscribe(() => closed());
    fixture.componentRef.setInput('employeeKey', {
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP001',
    });
    fixture.componentRef.setInput('employeeName', 'Maria Cortes Perez');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const dialog = () =>
    document.body.querySelector('app-period-modal [role="dialog"]') as HTMLElement | null;

  it('se abre en el molde de los modales, con título, a quién y los dos campos', () => {
    expect(dialog()).not.toBeNull();
    expect(dialog()?.textContent).toContain(employeeTexts.terminatePanelTitle);
    expect(dialog()?.textContent).toContain('Maria Cortes Perez');
    expect(dialog()?.textContent).toContain(employeeTexts.terminatePanelTerminationDateLabel);
    expect(dialog()?.textContent).toContain('Cese · TERMINATION');
    expect(document.body.querySelector('.employee-terminate__form')).toBeNull();
  });

  it('no deja dar de baja hasta tener fecha y motivo', () => {
    const submit = () =>
      dialog()?.querySelector('.period-modal__submit-btn') as HTMLButtonElement | null;
    expect(submit()?.disabled).toBe(true);

    component.form.setValue({ terminationDate: '2026-09-30', exitReasonCode: 'TERMINATION' });
    fixture.detectChanges();

    expect(submit()?.disabled).toBe(false);
    expect(submit()?.textContent).toContain(employeeTexts.terminatePanelSubmitAction);
  });

  it('al dar de baja cierra el modal y lo dice; la ficha se relee sola', () => {
    component.form.setValue({ terminationDate: '2026-09-30', exitReasonCode: 'TERMINATION' });
    component.submit();

    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({
      terminationDate: '2026-09-30',
      exitReasonCode: 'TERMINATION',
    });
    req.flush({
      terminationDate: '2026-09-30',
      exitReasonCode: 'TERMINATION',
      status: 'TERMINATED',
    });

    expect(closed).toHaveBeenCalled();
    expect(messages.success).toHaveBeenCalledWith(
      `${employeeTexts.terminatePanelDoneMessage} 30/09/2026.`,
      expect.anything(),
    );
  });

  it('si el servidor dice por qué no, se enseña en el modal y no se cierra', () => {
    component.form.setValue({ terminationDate: '2026-09-30', exitReasonCode: 'TERMINATION' });
    component.submit();

    http
      .expectOne(URL)
      .flush(
        { message: 'La fecha de baja es anterior al alta.' },
        { status: 422, statusText: 'Unprocessable' },
      );
    fixture.detectChanges();

    expect(closed).not.toHaveBeenCalled();
    expect(dialog()?.textContent).toContain('La fecha de baja es anterior al alta.');
  });
});
