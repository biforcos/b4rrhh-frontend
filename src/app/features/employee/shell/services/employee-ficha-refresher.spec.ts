import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';

import { employeeWritesInterceptor } from '../../data-access/employee-writes.interceptor';
import { EmployeeDetailStore } from '../../data-access/employee-detail.store';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { EmployeeJourneyStore } from '../../data-access/employee-journey.store';
import { EmployeeContractStore } from '../../data-access/employee-contract.store';
import { EmployeeWorkingTimeStore } from '../../data-access/employee-working-time.store';
import { EmployeeLaborClassificationStore } from '../../data-access/employee-labor-classification.store';
import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeCostCenterStore } from '../../data-access/employee-cost-center.store';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeFichaRefresher } from './employee-ficha-refresher';

const KEY: EmployeeBusinessKey = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000027',
};

/**
 * Cesar a un empleado refresca la ficha sin F5 (`b4rrhh/frontend#99`).
 *
 * El revisor de la demo: «si cesas al empleado, los datos necesitan un refresh con F5 (si no sigue
 * sin verse cerrado)». La cadena se prueba entera desde la petición: el POST del cese pasa por el
 * interceptor del `b4rrhh/frontend#87`, que avisa, y la ficha vuelve a pedir lo que pinta.
 */
describe('EmployeeFichaRefresher', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let stores: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
  const activeKey = signal<EmployeeBusinessKey | null>(KEY);

  beforeEach(() => {
    vi.useRealTimers();
    stores = {
      detail: { refreshEmployeeDetailByBusinessKey: vi.fn() },
      presence: { refreshPresencesByBusinessKey: vi.fn() },
      journey: { refreshJourneyByBusinessKey: vi.fn() },
      contract: { refreshContractsByBusinessKey: vi.fn() },
      workingTime: { refreshWorkingTimesByBusinessKey: vi.fn() },
      labor: { refreshLaborClassificationsByBusinessKey: vi.fn() },
      workCenter: { refreshWorkCenters: vi.fn() },
      costCenter: { refreshCostCenters: vi.fn() },
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([employeeWritesInterceptor])),
        provideHttpClientTesting(),
        EmployeeFichaRefresher,
        { provide: EmployeeDetailStore, useValue: stores['detail'] },
        { provide: EmployeePresenceStore, useValue: stores['presence'] },
        { provide: EmployeeJourneyStore, useValue: stores['journey'] },
        { provide: EmployeeContractStore, useValue: stores['contract'] },
        { provide: EmployeeWorkingTimeStore, useValue: stores['workingTime'] },
        { provide: EmployeeLaborClassificationStore, useValue: stores['labor'] },
        { provide: EmployeeWorkCenterStore, useValue: stores['workCenter'] },
        { provide: EmployeeCostCenterStore, useValue: stores['costCenter'] },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(EmployeeFichaRefresher).follow(activeKey);
    activeKey.set(KEY);
  });

  afterEach(() => httpMock.verify());

  async function post(url: string, status = 200): Promise<void> {
    http.post(url, {}).subscribe({ error: () => undefined });
    const req = httpMock.expectOne(url);
    if (status === 200) req.flush({});
    else req.flush({ message: 'no' }, { status, statusText: 'Error' });
    // El aviso se agrupa un instante: varias escrituras seguidas son una sola relectura.
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  it('cesar vuelve a pedir la cabecera, la presencia y todo lo que pinta la línea de vida', async () => {
    await post('/api/employees/ESP/INTERNAL/EMP000027/terminate');

    expect(stores['detail']['refreshEmployeeDetailByBusinessKey']).toHaveBeenCalledWith(KEY);
    expect(stores['presence']['refreshPresencesByBusinessKey']).toHaveBeenCalledWith(KEY);
    expect(stores['journey']['refreshJourneyByBusinessKey']).toHaveBeenCalledWith(KEY);
    for (const [store, method] of [
      ['contract', 'refreshContractsByBusinessKey'],
      ['workingTime', 'refreshWorkingTimesByBusinessKey'],
      ['labor', 'refreshLaborClassificationsByBusinessKey'],
      ['workCenter', 'refreshWorkCenters'],
      ['costCenter', 'refreshCostCenters'],
    ]) {
      expect(stores[store][method]).toHaveBeenCalledWith(KEY);
    }
  });

  it('cualquier acción que toque al empleado refresca, no sólo el cese', async () => {
    await post('/api/employees/ESP/INTERNAL/EMP000027/contacts');

    expect(stores['detail']['refreshEmployeeDetailByBusinessKey']).toHaveBeenCalledTimes(1);
  });

  it('un cese que falla no refresca nada', async () => {
    await post('/api/employees/ESP/INTERNAL/EMP000027/terminate', 422);

    expect(stores['detail']['refreshEmployeeDetailByBusinessKey']).not.toHaveBeenCalled();
  });

  it('lo de otro empleado no toca esta ficha', async () => {
    await post('/api/employees/ESP/INTERNAL/EMP000999/terminate');

    expect(stores['presence']['refreshPresencesByBusinessKey']).not.toHaveBeenCalled();
  });

  // Preguntar al servidor qué pasaría (`…/plan`) no es escribir: releer la ficha a cada tecla del
  // modal sería ruido.
  it('preguntar qué pasaría no refresca', async () => {
    await post('/api/employees/ESP/INTERNAL/EMP000027/working-times/plan');

    expect(stores['detail']['refreshEmployeeDetailByBusinessKey']).not.toHaveBeenCalled();
  });
});
