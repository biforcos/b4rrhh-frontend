import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { EmployeeAbsencesService } from '../../../core/api/generated/api/employee-absences.service';
import { AbsenceResponse } from '../../../core/api/generated/model/absence-response';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';

/**
 * Lo que se manda al crear o corregir una ausencia (`b4rrhh/frontend#84`).
 *
 * <p>`benefitEntitled` sólo viaja cuando el tipo lo admite; para los demás va nulo, que es «deja el
 * que corresponda». Que el backend trate el nulo como «con derecho» no es cosa de esta pantalla:
 * aquí lo que se decide es no inventar un valor para un campo que en ese tipo no significa nada.
 */
export interface AbsenceUpsertDraft {
  absenceTypeCode: string;
  startDate: string;
  endDate: string | null;
  benefitEntitled: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class EmployeeAbsenceGateway {
  private readonly api = inject(EmployeeAbsencesService);

  /**
   * Las ausencias del empleado, las que sean.
   *
   * <p>Un 404 se contesta con la lista vacía: «este empleado no tiene ausencias» no es un error de
   * la pantalla, es el caso normal de casi todo el mundo. Es lo mismo que hace el gateway de
   * entradas de nómina.
   */
  listAbsences(key: EmployeeBusinessKey): Observable<ReadonlyArray<AbsenceResponse>> {
    const k = toEmployeeBusinessKey(key);
    return this.api
      .listEmployeeAbsences({
        ruleSystemCode: k.ruleSystemCode,
        employeeTypeCode: k.employeeTypeCode,
        employeeNumber: k.employeeNumber,
      })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) return of([] as AbsenceResponse[]);
          throw err;
        }),
      );
  }

  /**
   * Crea o corrige una ausencia de día completo.
   *
   * <p>Sólo el modo de día: la ficha declara ausencias por días, que es lo que la nómina cuenta
   * (`b4rrhh/backend#127`). El modo de hora existe en el API y esta pantalla no lo usa — cuando haga
   * falta media jornada de permiso será otra conversación, y el sitio donde ponerla es éste.
   */
  upsertAbsence(key: EmployeeBusinessKey, draft: AbsenceUpsertDraft): Observable<void> {
    const k = toEmployeeBusinessKey(key);
    return this.api
      .upsertAbsenceDayMode({
        ruleSystemCode: k.ruleSystemCode,
        employeeTypeCode: k.employeeTypeCode,
        employeeNumber: k.employeeNumber,
        absenceTypeCode: draft.absenceTypeCode,
        startDate: draft.startDate,
        upsertAbsenceRequest: {
          endDate: draft.endDate,
          endTime: null,
          benefitEntitled: draft.benefitEntitled,
        },
      })
      .pipe(map(() => undefined));
  }

  deleteAbsence(
    key: EmployeeBusinessKey,
    absenceTypeCode: string,
    startDate: string,
  ): Observable<void> {
    const k = toEmployeeBusinessKey(key);
    return this.api
      .deleteAbsenceDayMode({
        ruleSystemCode: k.ruleSystemCode,
        employeeTypeCode: k.employeeTypeCode,
        employeeNumber: k.employeeNumber,
        absenceTypeCode,
        startDate,
      })
      .pipe(map(() => undefined));
  }
}
