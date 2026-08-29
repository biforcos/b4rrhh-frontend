import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

import { UiTagComponent } from '../../../../shared/ui/tag/ui-tag.component';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { EmployeeDirectoryStore } from '../../data-access/employee-directory.store';
import { EmployeeRecentsService } from '../../data-access/employee-recents.service';
import { employeeTexts } from '../../employee.texts';
import { EmployeeListItemModel } from '../../models/employee-list-item.model';
import { hasRehireRefreshMarker } from '../../routing/employee-refresh-marker.util';
import { buildEmployeeDetailRouteCommands } from '../../routing/employee-route-builder.util';
import { toEmployeeBusinessKey } from '../../routing/employee-route-key.util';
import { B4IconComponent } from '../../../../shared/ui/icon/b4-icon.component';

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
    B4IconComponent,
  ],
  templateUrl: './employee-shell-page.component.html',
  styleUrl: './employee-shell-page.component.scss',
})
export class EmployeeShellPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly directoryStore = inject(EmployeeDirectoryStore);
  private readonly recentsService = inject(EmployeeRecentsService);

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
  protected readonly searchValue = signal('');
  protected readonly loading = this.directoryStore.loading;
  protected readonly error = this.directoryStore.error;

  protected readonly tableData = computed(() => [...this.directoryStore.filteredEmployees()]);

  protected updateSearch(value: string): void {
    this.searchValue.set(value);
    this.directoryStore.setQuery(value);
  }

  protected openEmployee(employee: EmployeeListItemModel): void {
    this.recentsService.add(employee);
    void this.router.navigate(
      buildEmployeeDetailRouteCommands(toEmployeeBusinessKey(employee), 'contact'),
    );
  }

  protected onHireClick(): void {
    void this.router.navigate(['hire'], { relativeTo: this.route });
  }

  protected resolveStatusLabel(statusLabel: string): string {
    const n = statusLabel.trim().toLowerCase();
    if (n.includes('active') || n.includes('alta')) return this.texts.employeeStatusActiveLabel;
    if (n.includes('pending') || n.includes('draft')) return this.texts.employeeStatusPendingLabel;
    return this.texts.employeeStatusInactiveLabel;
  }

  protected resolveStatusSeverity(statusLabel: string): 'success' | 'secondary' | 'warn' {
    const n = statusLabel.trim().toLowerCase();
    if (n.includes('active') || n.includes('alta')) return 'success';
    if (n.includes('pending') || n.includes('draft')) return 'warn';
    return 'secondary';
  }
}
