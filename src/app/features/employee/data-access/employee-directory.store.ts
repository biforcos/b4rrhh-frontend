import { computed, Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeDirectoryQuery, EmployeeListItemModel } from '../models/employee-list-item.model';
import { areEmployeeBusinessKeysEqual } from '../routing/employee-route-key.util';
import { EmployeeDirectoryReadGateway } from './employee-directory-read.gateway';

export type EmployeeDirectoryErrorCode = 'request-failed';

/** Lo que pide el backend por defecto (`ListEmployeesService.DEFAULT_SIZE`); el máximo son 200. */
export const EMPLOYEE_DIRECTORY_PAGE_SIZE = 50;

/** Lo que se espera tras la última tecla antes de preguntar al servidor. */
export const EMPLOYEE_DIRECTORY_SEARCH_DEBOUNCE_MS = 250;

/**
 * El directorio (frontend#27): filtra y pagina el **servidor**. Aquí no se filtra nada en
 * cliente —el buscador buscaba en una página de 50 y decía «no existe» de quien estaba en la
 * fila 180—; el store guarda la pregunta (`q`, `status`, `page`) y lo que el servidor contestó a
 * esa pregunta, incluido el total que la cumple. Es un singleton: al volver de una ficha, la
 * pregunta y la página siguen siendo las mismas.
 */
@Injectable({
  providedIn: 'root',
})
export class EmployeeDirectoryStore {
  private readonly employeeDirectoryReadGateway = inject(EmployeeDirectoryReadGateway);
  private readonly employeesState = signal<ReadonlyArray<EmployeeListItemModel>>([]);
  private readonly totalState = signal<number | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<EmployeeDirectoryErrorCode | null>(null);
  private readonly queryState = signal<EmployeeDirectoryQuery>({
    q: '',
    status: null,
    page: 0,
    size: EMPLOYEE_DIRECTORY_PAGE_SIZE,
  });

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Subscription | null = null;

  /** La pregunta vigente, tal como se le hace al servidor. */
  readonly directoryQuery = this.queryState.asReadonly();
  readonly query = computed(() => this.queryState().q);
  readonly status = computed(() => this.queryState().status);
  readonly page = computed(() => this.queryState().page);
  readonly size = computed(() => this.queryState().size);
  /** La página que el servidor contestó. */
  readonly employees = this.employeesState.asReadonly();
  /** Cuántos cumplen la pregunta en total; `null` hasta que el servidor lo diga. */
  readonly total = this.totalState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor() {
    this.loadDirectory();
  }

  /** Cambia el texto y vuelve a la primera página; pregunta al servidor tras una pausa. */
  setQuery(value: string): void {
    if (value === this.queryState().q) {
      return;
    }
    this.queryState.update((query) => ({ ...query, q: value, page: 0 }));
    this.scheduleLoad();
  }

  setStatus(status: string | null): void {
    const normalized = status && status.trim().length > 0 ? status : null;
    if (normalized === this.queryState().status) {
      return;
    }
    this.queryState.update((query) => ({ ...query, status: normalized, page: 0 }));
    this.loadDirectory();
  }

  setPage(page: number): void {
    if (page === this.queryState().page) {
      return;
    }
    this.queryState.update((query) => ({ ...query, page }));
    this.loadDirectory();
  }

  refreshDirectory(): void {
    this.loadDirectory();
  }

  /** Busca solo entre lo cargado: sirve para lo que está en pantalla, no para saber si existe. */
  findEmployeeByBusinessKey(key: EmployeeBusinessKey | null): EmployeeListItemModel | null {
    if (!key) {
      return null;
    }

    return (
      this.employeesState().find((employee) => areEmployeeBusinessKeysEqual(employee, key)) ?? null
    );
  }

  private scheduleLoad(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.loadDirectory();
    }, EMPLOYEE_DIRECTORY_SEARCH_DEBOUNCE_MS);
  }

  private loadDirectory(): void {
    // Una respuesta a una pregunta anterior no pisa la actual.
    this.inFlight?.unsubscribe();
    this.loadingState.set(true);
    this.errorState.set(null);

    this.inFlight = this.employeeDirectoryReadGateway.readDirectory(this.queryState()).subscribe({
      next: (page) => {
        this.employeesState.set(page.items);
        this.totalState.set(page.total);
        this.loadingState.set(false);
      },
      error: () => {
        this.loadingState.set(false);
        this.errorState.set('request-failed');
      },
    });
  }
}
