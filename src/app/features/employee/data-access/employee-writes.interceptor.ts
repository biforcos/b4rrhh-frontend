import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';

/**
 * Avisa de que algo del empleado se ha guardado (`b4rrhh/frontend#87`).
 *
 * Cualquier escritura con fecha —una entrada de nómina, una ausencia, una vertical— puede dejar una
 * marca de retroactividad si toca un mes ya entregado (`b4rrhh/backend#130`). Quien enseña las marcas
 * no puede saber qué guardado la ha creado, así que escucha **todos** los del empleado.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeWritesNotifier {
  private readonly writesSubject = new Subject<EmployeeBusinessKey>();

  readonly writes$: Observable<EmployeeBusinessKey> = this.writesSubject.asObservable();

  notify(key: EmployeeBusinessKey): void {
    this.writesSubject.next(key);
  }
}

const ESCRITURAS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** `/employees/{regla}/{tipo}/{número}/…`: una escritura dentro de un empleado. */
const RUTA_DE_EMPLEADO = /\/employees\/([^/?]+)\/([^/?]+)\/([^/?]+)\//;

/**
 * Un solo sitio para todas las secciones, y no una llamada en cada tienda: una sección nueva que guarde
 * queda cubierta sin que nadie se acuerde de avisar. Sólo cuando el guardado **ha ido bien**: un 4xx no
 * ha creado ninguna marca.
 *
 * Las marcas no se avisan a sí mismas: descartar una ya relee la lista, y su ruta no cuelga del
 * empleado.
 */
export const employeeWritesInterceptor: HttpInterceptorFn = (req, next) => {
  if (!ESCRITURAS.has(req.method)) {
    return next(req);
  }
  const ruta = RUTA_DE_EMPLEADO.exec(req.url);
  if (!ruta) {
    return next(req);
  }
  const notifier = inject(EmployeeWritesNotifier);
  const key: EmployeeBusinessKey = {
    ruleSystemCode: decodeURIComponent(ruta[1]),
    employeeTypeCode: decodeURIComponent(ruta[2]),
    employeeNumber: decodeURIComponent(ruta[3]),
  };
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.ok) {
        notifier.notify(key);
      }
    }),
  );
};
