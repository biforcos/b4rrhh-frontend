import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { BASE_PATH } from '../api/generated/variables';
import { CARRIES_NO_SESSION } from '../auth/auth.interceptor';

interface ReadinessResponse {
  status: string;
}

@Injectable({
  providedIn: 'root',
})
export class BackendHealthClient {
  private readonly http = inject(HttpClient);
  // Misma raiz que el resto de la API: el actuator se movio a /api con todo
  // lo demas al poner el context-path en el backend. Opcional a proposito: en
  // los tests nadie provee BASE_PATH, y un cliente de salud no debe ser el
  // motivo de que no se pueda instanciar la aplicacion.
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? '';

  checkReadiness(): Observable<boolean> {
    // Pregunta por el transporte, no por el usuario: va sin sesion a proposito (frontend#59).
    // Si llevara credencial, un token caducado la haria fallar y la aplicacion diria que el
    // backend no esta cuando lo que pasa es que hay que volver a entrar.
    return this.http
      .get<ReadinessResponse>(`${this.basePath}/actuator/health/readiness`, {
        context: new HttpContext().set(CARRIES_NO_SESSION, true),
      })
      .pipe(
        map((response) => response?.status === 'UP'),
        catchError(() => of(false)),
      );
  }
}
