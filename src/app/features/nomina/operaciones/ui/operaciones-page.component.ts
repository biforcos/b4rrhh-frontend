import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';

import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { TargetSelectionMode } from '../models/target-selection.model';
import { OperacionesStore } from '../store/operaciones.store';

@Component({
  selector: 'app-operaciones-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButtonComponent, NgClass],
  templateUrl: './operaciones-page.component.html',
  styleUrl: './operaciones-page.component.scss',
})
export class OperacionesPageComponent {
  protected readonly store = inject(OperacionesStore);

  protected readonly targetModes: ReadonlyArray<{ value: TargetSelectionMode; label: string }> = [
    { value: 'ALL', label: 'Todos del período' },
    { value: 'LIST', label: 'Lista' },
    { value: 'SINGLE', label: 'Empleado único' },
  ];

  protected readonly runStatusLabels: Record<string, string | undefined> = {
    REQUESTED: 'Solicitado',
    RUNNING: 'En curso…',
    COMPLETED: 'Completado',
    COMPLETED_WITH_ERRORS: 'Completado con errores',
    FAILED: 'Fallido',
  };

  protected readonly runStatusSeverity: Record<string, string> = {
    REQUESTED: 'ops-badge--grey',
    RUNNING: 'ops-badge--yellow',
    COMPLETED: 'ops-badge--green',
    COMPLETED_WITH_ERRORS: 'ops-badge--orange',
    FAILED: 'ops-badge--red',
  };
}
