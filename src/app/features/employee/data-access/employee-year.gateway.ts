import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeYearService } from '../../../core/api/generated/api/employee-year.service';
import { EmployeeYearSummaryResponse } from '../../../core/api/generated/model/employee-year-summary-response';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeYearModel } from '../models/employee-year.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';

@Injectable({ providedIn: 'root' })
export class EmployeeYearGateway {
  private readonly api = inject(EmployeeYearService);

  /** El año del empleado en una llamada (`b4rrhh/backend#151`). */
  getYear(key: EmployeeBusinessKey, year: number): Observable<EmployeeYearModel> {
    const k = toEmployeeBusinessKey(key);
    return this.api
      .getEmployeeYearSummary({
        ruleSystemCode: k.ruleSystemCode,
        employeeTypeCode: k.employeeTypeCode,
        employeeNumber: k.employeeNumber,
        year,
      })
      .pipe(map(toEmployeeYearModel));
  }
}

export function toEmployeeYearModel(response: EmployeeYearSummaryResponse): EmployeeYearModel {
  return {
    year: response.year,
    presences: response.presences.map((p) => ({
      startDate: p.startDate,
      endDate: p.endDate ?? null,
    })),
    months: response.months.map((m) => ({
      period: Number(m.payrollPeriodCode),
      payrollState:
        m.payrollState === 'CLOSED' ? 'CLOSED' : m.payrollState === 'OPEN' ? 'OPEN' : null,
      payrollInputCount: m.payrollInputCount,
      activeRetroMarkCount: m.activeRetroMarkCount,
      consumedRetroMarkCount: m.consumedRetroMarkCount,
    })),
    absences: response.absences.map((a) => ({
      absenceTypeCode: a.absenceTypeCode,
      startDate: a.startDate,
      endDate: a.endDate ?? null,
    })),
  };
}
