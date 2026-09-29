import { DestroyRef, Injectable, Signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { buffer, debounceTime } from 'rxjs';

import { EmployeeContractStore } from '../../data-access/employee-contract.store';
import { EmployeeCostCenterStore } from '../../data-access/employee-cost-center.store';
import { EmployeeDetailStore } from '../../data-access/employee-detail.store';
import { EmployeeJourneyStore } from '../../data-access/employee-journey.store';
import { EmployeeLaborClassificationStore } from '../../data-access/employee-labor-classification.store';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeWorkingTimeStore } from '../../data-access/employee-working-time.store';
import { EmployeeWritesNotifier } from '../../data-access/employee-writes.interceptor';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../../routing/employee-route-key.util';

/** Cuánto se espera a juntar escrituras seguidas antes de releer: un cese son varias. */
const GROUPING_MS = 50;

/**
 * La ficha se relee sola tras cualquier acción que toque al empleado (`b4rrhh/frontend#99`).
 *
 * <p>El revisor de la demo cesó a un empleado y la ficha lo siguió enseñando de alta hasta el F5. El
 * panel del cese pedía releer, pero con los `load…` que no hacen nada si la clave es la misma, y
 * nadie más se enteraba. Es la misma familia que el `b4rrhh/frontend#87`: una acción cambia al
 * empleado y la pantalla no lo sabe. Así que se generaliza desde el mismo sitio: el interceptor
 * avisa de cada escritura que sale bien, y aquí se relee **la cabecera, la presencia, el historial y
 * todo lo que pinta la línea de vida**.
 *
 * <p>Lo que relee cada acción, para que la próxima no se olvide: todas releen esto mismo, porque
 * no se puede saber desde aquí qué toca cada una —un cese cierra seis verticales; un cambio de
 * centro abre una y cierra otra; una readmisión crea presencia y todo lo demás—. Las secciones
 * siguen releyendo lo suyo al guardar; esto es lo que está fuera de la sección y depende de ella.
 */
@Injectable()
export class EmployeeFichaRefresher {
  private readonly notifier = inject(EmployeeWritesNotifier);
  private readonly destroyRef = inject(DestroyRef);
  private readonly detailStore = inject(EmployeeDetailStore);
  private readonly presenceStore = inject(EmployeePresenceStore);
  private readonly journeyStore = inject(EmployeeJourneyStore);
  private readonly contractStore = inject(EmployeeContractStore);
  private readonly workingTimeStore = inject(EmployeeWorkingTimeStore);
  private readonly laborClassificationStore = inject(EmployeeLaborClassificationStore);
  private readonly workCenterStore = inject(EmployeeWorkCenterStore);
  private readonly costCenterStore = inject(EmployeeCostCenterStore);

  follow(activeKey: Signal<EmployeeBusinessKey | null>): void {
    const writes$ = this.notifier.writes$;
    writes$
      .pipe(buffer(writes$.pipe(debounceTime(GROUPING_MS))), takeUntilDestroyed(this.destroyRef))
      .subscribe((keys) => {
        const active = activeKey();
        if (!active) return;
        if (!keys.some((key) => areEmployeeBusinessKeysEqual(active, toEmployeeBusinessKey(key)))) {
          return;
        }
        this.refresh(active);
      });
  }

  private refresh(key: EmployeeBusinessKey): void {
    this.detailStore.refreshEmployeeDetailByBusinessKey(key);
    this.presenceStore.refreshPresencesByBusinessKey(key);
    this.journeyStore.refreshJourneyByBusinessKey(key);
    this.contractStore.refreshContractsByBusinessKey(key);
    this.workingTimeStore.refreshWorkingTimesByBusinessKey(key);
    this.laborClassificationStore.refreshLaborClassificationsByBusinessKey(key);
    this.workCenterStore.refreshWorkCenters(key);
    this.costCenterStore.refreshCostCenters(key);
  }
}
