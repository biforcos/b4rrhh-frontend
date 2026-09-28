import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { BASE_PATH } from '../../../../core/api/generated/variables';
import { EmployeeRelationPageComponent } from './employee-relation-page.component';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';

describe('EmployeeRelationPageComponent', () => {
  let fixture: ComponentFixture<EmployeeRelationPageComponent>;
  let http: HttpTestingController;

  const paramMap = convertToParamMap({
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'EMP',
    employeeNumber: 'E001',
  });
  const routeMock = {
    paramMap: of(paramMap),
    fragment: of(null),
    snapshot: { paramMap },
  };
  const routerMock = {
    navigate: vi.fn(() => Promise.resolve(true)),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeRelationPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: '/api' },
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: Router, useValue: routerMock },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(EmployeeRelationPageComponent, {
        set: { template: '', imports: [] },
      })
      .compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmployeeRelationPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  function pendingRequests() {
    return http.match(() => true);
  }

  function failWithExpiredToken(requests: ReturnType<typeof pendingRequests>): void {
    for (const request of requests) {
      request.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    }
  }

  // frontend#44: con los stores reales, un error persistente que se lea dentro del efecto
  // vuelve a dispararlo y encadena rondas sin fin. La dependencia legitima es la clave del
  // empleado; lo que el store escribe al cargar no puede serlo.
  it('con las cuatro cargas devolviendo 401, hace una ronda de peticiones y para', () => {
    const firstRound = pendingRequests();
    expect(firstRound.map((request) => request.request.url).sort()).toEqual([
      '/api/employees/ESP/EMP/E001/contracts',
      '/api/employees/ESP/EMP/E001/cost-centers',
      '/api/employees/ESP/EMP/E001/labor-classifications',
      '/api/employees/ESP/EMP/E001/working-times',
    ]);
    failWithExpiredToken(firstRound);
    fixture.detectChanges();

    const laterRounds: string[] = [];
    for (let round = 0; round < 3; round += 1) {
      const requests = pendingRequests();
      laterRounds.push(...requests.map((request) => request.request.url));
      failWithExpiredToken(requests);
      fixture.detectChanges();
    }

    expect(laterRounds).toEqual([]);
  });

  /**
   * El molde del mensaje global (`b4rrhh/frontend#92`): un fallo de una sección de la relación que
   * el servidor explica llega explicado al raíl de mensajes, y no como «No se pudo procesar la
   * operación de contrato. Reintenta.».
   */
  it('lo que dice el servidor al fallar llega al mensaje de la sección', () => {
    const requests = pendingRequests();
    const contracts = requests.find((r) => r.request.url.endsWith('/contracts'))!;
    contracts.flush(
      { message: 'El catálogo de tipos de contrato de ESP no responde' },
      { status: 500, statusText: 'Server Error' },
    );
    for (const other of requests.filter((r) => r !== contracts)) other.flush([]);
    fixture.detectChanges();

    const texts = TestBed.inject(GlobalMessageService)
      .messages()
      .map((m) => m.text);
    expect(texts).toContain(
      'No se pudo procesar la operación de contrato: El catálogo de tipos de contrato de ESP no responde.',
    );
  });
});
