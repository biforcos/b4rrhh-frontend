import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeRetroMarksService } from '../../../core/api/generated/api/employee-retro-marks.service';
import { RetroMarkResponse } from '../../../core/api/generated/model/retro-mark-response';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { toEmployeeBusinessKey } from '../routing/employee-route-key.util';

@Injectable({ providedIn: 'root' })
export class EmployeeRetroMarkGateway {
  private readonly api = inject(EmployeeRetroMarksService);

  /**
   * Las marcas del empleado, **todas y en su estado**.
   *
   * <p>Sin empleado, 404; sin marcas, 200 con la lista vacía (`b4rrhh/backend#144`). El 404 ya no se
   * convierte aquí en «no tiene correcciones»: era decir eso de un empleado que no existe.
   */
  listRetroMarks(key: EmployeeBusinessKey): Observable<ReadonlyArray<RetroMarkResponse>> {
    const k = toEmployeeBusinessKey(key);
    return this.api.listEmployeeRetroMarks({
      ruleSystemCode: k.ruleSystemCode,
      employeeTypeCode: k.employeeTypeCode,
      employeeNumber: k.employeeNumber,
    });
  }

  /**
   * Decide que esa corrección no se paga. **No es un borrado**: la fila queda en `DISCARDED` con
   * quién y con por qué.
   *
   * <p>La marca se identifica por su `id` y no por la clave de negocio del empleado, y eso es del
   * contrato: un empleado puede tener varias marcas del mismo mes y de la misma vertical —dos
   * escrituras distintas a agosto son dos filas— así que nada que no sea el id las distingue.
   */
  discardRetroMark(id: number, discardReason: string): Observable<void> {
    return this.api
      .discardRetroMark({ id, discardRetroMarkRequest: { discardReason } })
      .pipe(map(() => undefined));
  }
}
