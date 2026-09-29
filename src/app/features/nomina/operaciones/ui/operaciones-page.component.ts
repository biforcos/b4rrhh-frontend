import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { UiMoreComponent } from '../../../../shared/ui/more/ui-more.component';
import { TargetSelectionMode } from '../models/target-selection.model';
import {
  OperacionesStore,
  monthInputToPeriod,
  periodToMonthInput,
} from '../store/operaciones.store';

/**
 * Lo que se pide: el contexto, los empleados objetivo y los dos actos —invalidar y lanzar.
 *
 * **El resultado del lanzamiento no se mira aqui.** Lanzar lleva a `/nomina/operaciones/:runId`,
 * que es la pantalla de la ejecucion: ahi estan los nueve contadores, la barra y los mensajes por
 * unidad. Este panel tenia una copia de cinco contadores y una barra propia, y las dos cosas
 * dependian de que el lanzamiento esperase a terminar, que es lo que ya no hace (frontend#62).
 */
@Component({
  selector: 'app-operaciones-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButtonComponent, UiMoreComponent],
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

  /**
   * Los dos periodos de la retro se editan con un `<input type="month">`, que habla `yyyy-MM`, y el
   * store los guarda en `yyyyMM`, que es lo que entiende el contrato. La traduccion vive en el store
   * y no aqui para que un spec la pueda probar sin montar la pantalla.
   */
  protected readonly retroLimitValue = computed(() =>
    periodToMonthInput(this.store.retroLimitPeriod()),
  );

  protected readonly retroFloorValue = computed(() =>
    periodToMonthInput(this.store.retroFloorPeriod()),
  );

  /** Un mes a medio escribir —o borrado— es null, y null en el limite deja el lanzamiento parado. */
  protected setRetroLimit(value: string): void {
    this.store.setRetroLimitPeriod(monthInputToPeriod(value));
  }

  protected setRetroFloor(value: string): void {
    this.store.setRetroFloorPeriod(monthInputToPeriod(value));
  }
}
