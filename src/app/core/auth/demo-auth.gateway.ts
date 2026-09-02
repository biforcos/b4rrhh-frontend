import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BASE_PATH } from '../api/generated/variables';
import { DemoAuthInfo, DemoAuthResponse } from './auth.models';

@Injectable({
  providedIn: 'root',
})
export class DemoAuthGateway {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? '';

  /** Perfiles y contrasena de la demo. Solo responde si el backend corre en modo demo. */
  info(): Observable<DemoAuthInfo> {
    return this.http.get<DemoAuthInfo>(`${this.basePath}/demo/auth/info`);
  }

  login(subject: string, password: string): Observable<DemoAuthResponse> {
    return this.http.post<DemoAuthResponse>(`${this.basePath}/demo/auth/login`, {
      subject,
      password,
    });
  }
}
