import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';

import { EmployeeAbsencesService } from '../../../core/api/generated/api/employee-absences.service';
import { EmployeePayrollInputService } from '../../../core/api/generated/api/employee-payroll-input.service';
import { EmployeeRetroMarksService } from '../../../core/api/generated/api/employee-retro-marks.service';
import { PayrollEngineService } from '../../../core/api/generated/api/payroll-engine.service';
import { EmployeeAbsenceGateway } from './employee-absence.gateway';
import { EmployeePayrollInputGateway } from './employee-payroll-input.gateway';
import { EmployeeRetroMarkGateway } from './employee-retro-mark.gateway';

const KEY = { ruleSystemCode: 'ESP', employeeTypeCode: 'INTERNAL', employeeNumber: 'NOEXISTE' };
const NOT_FOUND = new HttpErrorResponse({
  status: 404,
  error: { message: 'No existe el empleado ESP/INTERNAL/NOEXISTE.' },
});

/**
 * Un empleado que no existe no es un empleado sin ausencias, sin entradas ni sin correcciones
 * (`b4rrhh/backend#144`).
 *
 * <p>Estos tres gateways convertían el 404 en una lista vacía, porque el servidor lo contestaba
 * así también para «no tiene». Desde el `b4rrhh/backend#144` el servidor da 200 vacío a quien no
 * tiene y 404 a quien no existe, y convertirlo aquí era decir «no tiene» de alguien que no existe.
 */
describe('Los gateways de la ficha dejan pasar el 404 de un empleado que no existe', () => {
  beforeEach(() => {
    const fails = () => throwError(() => NOT_FOUND);
    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeAbsencesService, useValue: { listEmployeeAbsences: vi.fn(fails) } },
        {
          provide: EmployeePayrollInputService,
          useValue: { listEmployeePayrollInputsByBusinessKey: vi.fn(fails) },
        },
        { provide: EmployeeRetroMarksService, useValue: { listEmployeeRetroMarks: vi.fn(fails) } },
        { provide: PayrollEngineService, useValue: {} },
      ],
    });
  });

  it('ausencias', async () => {
    await expect(
      firstValueFrom(TestBed.inject(EmployeeAbsenceGateway).listAbsences(KEY)),
    ).rejects.toBe(NOT_FOUND);
  });

  it('entradas de nómina', async () => {
    await expect(
      firstValueFrom(TestBed.inject(EmployeePayrollInputGateway).listInputs(KEY, 202609)),
    ).rejects.toBe(NOT_FOUND);
  });

  it('correcciones a meses entregados', async () => {
    await expect(
      firstValueFrom(TestBed.inject(EmployeeRetroMarkGateway).listRetroMarks(KEY)),
    ).rejects.toBe(NOT_FOUND);
  });
});
