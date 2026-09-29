import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { BASE_PATH } from '../../../../core/api/generated/variables';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeeAbsenceSectionComponent } from '../../presence/components/employee-absence-section.component';
import { EmployeePayrollInputSectionComponent } from '../components/employee-payroll-input-section.component';
import { EmployeeRetroMarkSectionComponent } from '../components/employee-retro-mark-section.component';
import { EmployeeMonthPageComponent } from './employee-month-page.component';

/**
 * Lo que pasa cada mes (`b4rrhh/frontend#90`): ausencias, entradas de nómina y correcciones a meses
 * entregados, con **un solo navegador de período** para las tres. Antes sólo lo tenían las
 * entradas, y las otras dos enseñaban todo lo del empleado sin decir de qué mes.
 */
describe('EmployeeMonthPageComponent', () => {
  function montar() {
    const paramMap = convertToParamMap({
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP000025',
    });
    TestBed.configureTestingModule({
      imports: [EmployeeMonthPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: '/api' },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(paramMap), fragment: of(null), snapshot: { paramMap } },
        },
      ],
    });
    const fixture = TestBed.createComponent(EmployeeMonthPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  function periodosDeLasTres(fixture: ReturnType<typeof montar>): number[] {
    return [
      EmployeeAbsenceSectionComponent,
      EmployeePayrollInputSectionComponent,
      EmployeeRetroMarkSectionComponent,
    ].map((tipo) => fixture.debugElement.query(By.directive(tipo)).componentInstance.period());
  }

  it('las tres secciones, en el orden en que se leen', () => {
    const fixture = montar();
    const ids = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[id^="employee-section-"]'),
    ).map((e) => e.id);
    expect(ids).toEqual([
      'employee-section-absence',
      'employee-section-payroll-inputs',
      'employee-section-retro-marks',
    ]);
  });

  it('las tres hablan del mismo mes', () => {
    const fixture = montar();
    const [a, b, c] = periodosDeLasTres(fixture);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('un navegador para las tres: moverlo mueve las tres', () => {
    const fixture = montar();
    const antes = periodosDeLasTres(fixture)[0];
    const botones: HTMLButtonElement[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.month-navigator__btn'),
    );
    expect(botones.length).toBe(2);
    botones[0].click();
    fixture.detectChanges();
    const despues = periodosDeLasTres(fixture);
    expect(despues[0]).not.toBe(antes);
    expect(new Set(despues).size).toBe(1);
  });

  it('las entradas ya no llevan su propio navegador', () => {
    const fixture = montar();
    const entradas = fixture.debugElement.query(By.directive(EmployeePayrollInputSectionComponent));
    expect(
      (entradas.nativeElement as HTMLElement).querySelector(
        '.employee-payroll-input-section__period-nav',
      ),
    ).toBeNull();
  });

  it('una sección que pide otro mes mueve la página entera', () => {
    const fixture = montar();
    const ausencias = fixture.debugElement.query(By.directive(EmployeeAbsenceSectionComponent));
    ausencias.componentInstance.periodRequested.emit(202603);
    fixture.detectChanges();
    expect(periodosDeLasTres(fixture)).toEqual([202603, 202603, 202603]);
  });

  // b4rrhh/backend#144: la sección calculaba su mensaje de error y nadie lo enseñaba, así que la
  // ficha de un empleado que no existe decía «no hay entradas». Ahora lo cuenta la página, como los
  // de las otras dos secciones.
  it('un fallo al cargar las entradas se cuenta, con lo que dijo el servidor', () => {
    const fixture = montar();
    const http = TestBed.inject(HttpTestingController);
    http
      .match((req) => req.url.includes('/payroll-inputs'))
      .forEach((req) =>
        req.flush(
          {
            code: 'PAYROLL_INPUT_EMPLOYEE_NOT_FOUND',
            message: 'No existe el empleado ESP/INTERNAL/EMP000025.',
          },
          { status: 404, statusText: 'Not Found' },
        ),
      );
    fixture.detectChanges();

    const textos = TestBed.inject(GlobalMessageService)
      .messages()
      .map((m) => m.text);
    expect(textos.some((t) => t.includes('No existe el empleado ESP/INTERNAL/EMP000025.'))).toBe(
      true,
    );
  });
});
