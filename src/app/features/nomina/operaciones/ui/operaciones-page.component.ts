import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { TargetSelectionMode } from '../models/target-selection.model';
import { OperacionesStore } from '../store/operaciones.store';

/**
 * Lo que se pide: el contexto, los empleados objetivo y los dos actos —invalidar y lanzar.
 *
 * **El resultado del lanzamiento no se mira aqui.** Lanzar lleva a `/nomina/operaciones/:runId`,
 * que es la pantalla de la ejecucion: ahi estan los ocho contadores, la barra y los mensajes por
 * unidad. Este panel tenia una copia de cinco contadores y una barra propia, y las dos cosas
 * dependian de que el lanzamiento esperase a terminar, que es lo que ya no hace (frontend#62).
 */
@Component({
  selector: 'app-operaciones-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButtonComponent],
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
}
