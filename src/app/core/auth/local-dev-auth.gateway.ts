import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BASE_PATH } from '../api/generated/variables';
import { DevAuthRequest, DevAuthResponse } from './auth.models';

@Injectable({
  providedIn: 'root',
})
export class LocalDevAuthGateway {
  private readonly http = inject(HttpClient);
  // Misma raiz que el cliente generado: si manana cambia el prefijo, cambia
  // en un sitio y no hay que acordarse de este.
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? '';

  issueToken(request: DevAuthRequest): Observable<DevAuthResponse> {
    return this.http.post<DevAuthResponse>(`${this.basePath}/dev/auth/token`, request);
  }
}
