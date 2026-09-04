import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BASE_PATH } from '../api/generated/variables';
import { DemoCounts } from './auth.models';

/**
 * Las cifras de la portada (frontend#40, backend#45).
 *
 * Se piden sin token: la portada se pinta antes de que exista. Solo responde
 * si el backend corre en modo demo; en desarrollo da 404 y la portada,
 * simplemente, no pinta la fila.
 */
@Injectable({
  providedIn: 'root',
})
export class DemoCountsGateway {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? '';

  counts(): Observable<DemoCounts> {
    return this.http.get<DemoCounts>(`${this.basePath}/demo/counts`);
  }
}
