import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

import { UiTagComponent } from '../../../../shared/ui/tag/ui-tag.component';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { EmployeeDirectoryStore } from '../../data-access/employee-directory.store';
import { EmployeeRecentsService } from '../../data-access/employee-recents.service';
import { EmployeeWorkQueueStore } from '../../data-access/employee-work-queue.store';
import { describeCriteria } from '../../identity/employee-work-queue-panel.component';
import { employeeTexts } from '../../employee.texts';
import { EmployeeListItemModel } from '../../models/employee-list-item.model';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { hasRehireRefreshMarker } from '../../routing/employee-refresh-marker.util';
import { buildEmployeeDetailRouteCommands } from '../../routing/employee-route-builder.util';
import { toEmployeeBusinessKey } from '../../routing/employee-route-key.util';
import { B4IconComponent } from '../../../../shared/ui/icon/b4-icon.component';
import { PageSkeletonComponent } from '../../../../shared/ui/page-skeleton/page-skeleton.component';

/** `ui-select` reserva `''` para su placeholder: «Todos» necesita un valor propio. */
const ALL_STATUSES = 'ALL';

@Component({
  selector: 'app-employee-shell-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TableModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    UiTagComponent,
    UiButtonComponent,
    UiSelectComponent,
    B4IconComponent,
    PageSkeletonComponent,
  ],
  templateUrl: './employee-shell-page.component.html',
  styleUrl: './employee-shell-page.component.scss',
})
export class EmployeeShellPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly directoryStore = inject(EmployeeDirectoryStore);
  private readonly recentsService = inject(EmployeeRecentsService);
  private readonly workQueueStore = inject(EmployeeWorkQueueStore);

  /**
   * Una recontratacion cambia el estado del empleado, y el estado se ve y se
   * filtra en este listado. El listado se entera solo: no depende de que el
   * detalle se acuerde de avisarle.
   *
   * El detalle borra el marcador despues de usarlo, pero esa navegacion es
   * asincrona y la entrega del evento es sincrona, asi que aqui todavia esta.
   */
  private readonly rehireRefreshSubscription = this.router.events
    .pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    )
    .subscribe(() => {
      if (hasRehireRefreshMarker(this.route.snapshot)) {
        this.directoryStore.refreshDirectory();
      }
    });

  protected readonly texts = employeeTexts;
  /** Lo que hay escrito; al volver de una ficha, lo que había (el store lo recuerda). */
  protected readonly searchValue = signal(this.directoryStore.query());
  /** La cola viva, si la hay (frontend#20): volver a la lista no la pierde; aquí se puede continuar. */
  protected readonly workQueue = this.workQueueStore.queue;
  protected readonly workQueueLabel = computed(() => {
    const queue = this.workQueue();
    return queue
      ? `${queue.index + 1} ${this.texts.workQueuePositionOf} ${queue.total} · ${describeCriteria(queue.criteria, this.texts)}`
      : null;
  });
  protected readonly startingQueue = signal(false);

  constructor() {
    // Volver a la lista no pierde la selección, ni tras recargar: si hay cola y el directorio
    // arranca sin pregunta propia, la pregunta vuelve a ser la de la cola.
    const queue = this.workQueueStore.queue();
    const fresh =
      this.directoryStore.query().trim().length === 0 && this.directoryStore.status() === null;
    if (queue && fresh) {
      this.directoryStore.setStatus(queue.criteria.status);
      this.directoryStore.setQuery(queue.criteria.q);
      this.searchValue.set(queue.criteria.q);
    }
  }
  protected readonly statusValue = computed(() => this.directoryStore.status() ?? ALL_STATUSES);
  protected readonly loading = this.directoryStore.loading;
  protected readonly error = this.directoryStore.error;
  protected readonly total = this.directoryStore.total;
  protected readonly pageSize = this.directoryStore.size;
  /** Índice de la primera fila de la página, que es como cuenta el paginador de PrimeNG. */
  protected readonly first = computed(
    () => this.directoryStore.page() * this.directoryStore.size(),
  );
  protected readonly hasFilter = computed(
    () => this.directoryStore.query().trim().length > 0 || this.directoryStore.status() !== null,
  );

  protected readonly tableData = computed(() => [...this.directoryStore.employees()]);

  protected readonly statusOptions: ReadonlyArray<SlotKeyOption<string>> = [
    { value: ALL_STATUSES, label: employeeTexts.directoryStatusAllLabel },
    { value: 'ACTIVE', label: employeeTexts.directoryStatusActiveLabel },
    { value: 'TERMINATED', label: employeeTexts.directoryStatusTerminatedLabel },
  ];

  /** El recuento dice la verdad o no dice nada: el total del servidor, o ninguno hasta tenerlo. */
  protected readonly countLabel = computed(() => {
    const total = this.directoryStore.total();
    if (total === null) {
      return null;
    }
    const t = this.texts;
    if (this.hasFilter()) {
      return total === 1 ? t.directoryCountOneMatch : `${total} ${t.directoryCountMatchesSuffix}`;
    }
    return total === 1
      ? t.directoryCountOneEmployee
      : `${total} ${t.directoryCountEmployeesSuffix}`;
  });

  protected updateSearch(value: string): void {
    this.searchValue.set(value);
    this.directoryStore.setQuery(value);
  }

  /**
   * Recorrer lo que cumple la pregunta de arriba (frontend#20, opción B del #27): la cola es el
   * filtro. Se entra por el primero, y el raíl se encarga del resto.
   */
  protected async traverse(): Promise<void> {
    if (this.startingQueue()) return;
    this.startingQueue.set(true);
    try {
      const first = await this.workQueueStore.start({
        q: this.directoryStore.query(),
        status: this.directoryStore.status(),
      });
      if (first) {
        await this.router.navigate(buildEmployeeDetailRouteCommands(first, 'relacion'));
      }
    } finally {
      this.startingQueue.set(false);
    }
  }

  /** Seguir la cola donde se dejó. */
  protected continueQueue(): void {
    const queue = this.workQueue();
    if (!queue) return;
    void this.router.navigate(buildEmployeeDetailRouteCommands(queue.currentKey, 'relacion'));
  }

  protected leaveQueue(): void {
    this.workQueueStore.leave();
  }

  protected updateStatus(value: string): void {
    this.directoryStore.setStatus(value === ALL_STATUSES ? null : value);
  }

  /** El paginador pide una página; la carga la hace el store, que ya sabe la pregunta. */
  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.directoryStore.size();
    const first = event.first ?? 0;
    this.directoryStore.setPage(rows > 0 ? Math.floor(first / rows) : 0);
  }

  /** Abrir una fila es llegar a uno solo: sin cola (dos contenidos según cómo llegues, #20). */
  protected openEmployee(employee: EmployeeListItemModel): void {
    this.workQueueStore.leave();
    this.recentsService.add(employee);
    void this.router.navigate(
      buildEmployeeDetailRouteCommands(toEmployeeBusinessKey(employee), 'contact'),
    );
  }

  protected onHireClick(): void {
    void this.router.navigate(['hire'], { relativeTo: this.route });
  }

  /** Activo es lo normal en un directorio: no se marca (ADR-050 §5). */
  protected isNormalStatus(status: string): boolean {
    return status.trim().toUpperCase() === 'ACTIVE';
  }

  protected resolveStatusLabel(status: string): string {
    const n = status.trim().toLowerCase();
    if (n.includes('active') || n.includes('alta')) return this.texts.employeeStatusActiveLabel;
    if (n.includes('pending') || n.includes('draft')) return this.texts.employeeStatusPendingLabel;
    return this.texts.employeeStatusInactiveLabel;
  }
}
