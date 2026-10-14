import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EmployeePresenceService } from '../generated/api/employee-presence.service';
import { RectifyPresenceDateResponse } from '../generated/model/rectify-presence-date-response';

export interface EmployeePresenceRectificationKey {
  ruleSystemCode: string;
  employeeTypeCode: string;
  employeeNumber: string;
}

/** Qué fecha de la presencia se rectifica. */
export type PresenceRectificationField = 'START_DATE' | 'END_DATE';

/**
 * La rectificación de la fecha de alta o de cese de una presencia (`b4rrhh/backend#172`). Con
 * `dryRun` sólo pregunta qué movería: el interceptor de escrituras no lo cuenta como escritura.
 */
@Injectable({ providedIn: 'root' })
export class EmployeePresenceRectificationClient {
  private readonly api = inject(EmployeePresenceService);

  rectify(
    key: EmployeePresenceRectificationKey,
    presenceNumber: number,
    field: PresenceRectificationField,
    newDate: string,
    dryRun: boolean,
  ): Observable<RectifyPresenceDateResponse> {
    const params = {
      ruleSystemCode: key.ruleSystemCode.trim(),
      employeeTypeCode: key.employeeTypeCode.trim(),
      employeeNumber: key.employeeNumber.trim(),
      presenceNumber,
      rectifyPresenceDateRequest: { newDate, dryRun },
    };
    return field === 'START_DATE'
      ? this.api.rectifyPresenceStartDate(params)
      : this.api.rectifyPresenceEndDate(params);
  }
}
