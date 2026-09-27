import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { appHttpInterceptors } from '../../../app.config';
import { BASE_PATH } from '../../../core/api/generated/variables';
import { EmployeePayrollInputStore } from './employee-payroll-input.store';
import { EmployeeRetroMarkStore } from './employee-retro-mark.store';

/**
 * La sección de marcas se vuelve a pedir **al guardar** (`b4rrhh/frontend#87`).
 *
 * Visto en la demo del 27/09: corregir unas horas de un mes cerrado crea la marca
 * (`b4rrhh/backend#130`), pero la sección seguía vacía hasta recargar la página. Cualquier guardado en
 * una sección con fecha puede crear una marca, así que al terminar un guardado del empleado que se está
 * mirando, las marcas se releen. Sin sondeo: al guardar.
 *
 * Se monta con **los interceptores de la aplicación** y no con uno puesto a mano: lo que se prueba es que
 * la aplicación lo hace, no que el mecanismo funcionaría si alguien lo registrara.
 */
describe('La sección de marcas de retro se refresca al guardar', () => {
  const KEY = { ruleSystemCode: 'ESP', employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP000001' };
  const MARCAS = '/api/employees/ESP/INTERNAL/EMP000001/retro-marks';

  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors(appHttpInterceptors)),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: '/api' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('guardar una entrada de nómina de un mes cerrado vuelve a pedir las marcas y pinta la fila', () => {
    const marcas = TestBed.inject(EmployeeRetroMarkStore);
    const entradas = TestBed.inject(EmployeePayrollInputStore);

    marcas.loadMarks(KEY);
    http.expectOne((r) => r.method === 'GET' && r.url === MARCAS).flush([]);
    expect(marcas.marks()).toEqual([]);

    entradas.createInput(KEY, { conceptCode: 'H01', period: 202608, quantity: 10 });
    http
      .expectOne(
        (r) =>
          r.method === 'POST' && r.url.endsWith('/employees/ESP/INTERNAL/EMP000001/payroll-inputs'),
      )
      .flush(null, { status: 201, statusText: 'Created' });

    // La tienda de entradas relee las suyas; eso no es lo que se mira aquí.
    http
      .match((r) => r.method === 'GET' && r.url.includes('/payroll-inputs'))
      .forEach((req) => req.flush([]));

    http
      .expectOne((r) => r.method === 'GET' && r.url === MARCAS)
      .flush([
        {
          id: 1,
          presenceNumber: 1,
          fromPeriodCode: '202608',
          status: 'ACTIVE',
          createdAt: '2026-09-27T10:00:00Z',
          sourceVerticalCode: 'PAYROLL_INPUT',
          sourceTable: 'employee.employee_payroll_input',
          sourceRowKey: 'H01@202608',
        },
      ]);
    expect(marcas.marks().map((m) => m.fromPeriodCode)).toEqual(['202608']);
  });

  it('un guardado de otro empleado no toca las marcas del que se está mirando', () => {
    const marcas = TestBed.inject(EmployeeRetroMarkStore);
    const entradas = TestBed.inject(EmployeePayrollInputStore);

    marcas.loadMarks(KEY);
    http.expectOne((r) => r.method === 'GET' && r.url === MARCAS).flush([]);

    entradas.createInput(
      { ...KEY, employeeNumber: 'EMP000002' },
      { conceptCode: 'H01', period: 202608, quantity: 10 },
    );
    http
      .expectOne((r) => r.method === 'POST' && r.url.includes('/EMP000002/payroll-inputs'))
      .flush(null, { status: 201, statusText: 'Created' });
    http
      .match((r) => r.method === 'GET' && r.url.includes('/payroll-inputs'))
      .forEach((req) => req.flush([]));

    http.expectNone((r) => r.method === 'GET' && r.url === MARCAS);
  });
});
