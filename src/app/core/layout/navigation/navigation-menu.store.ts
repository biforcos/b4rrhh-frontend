import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { RuleEntityTypesService } from '../../api/generated/api/rule-entity-types.service';
import { buildMenuGroups } from './navigation-menu.mapper';
import { MenuGroup } from './navigation-menu.model';

/**
 * El menú derivado del metamodelo (frontend#33). Se carga una vez al entrar en el
 * shell, como el ámbito (ADR-049); lo que ya se pide al arrancar trae ahora también
 * la pertenencia, el grupo y el orden del menú (ADR-053 §7, ADR-054 §8).
 *
 * En error se queda la derivación vacía — solo las colas fijas de cada grupo—, y el
 * guard de disponibilidad del backend ya cubre el caso del backend caído.
 */
@Injectable({ providedIn: 'root' })
export class NavigationMenuStore {
  private readonly api = inject(RuleEntityTypesService);

  private readonly groupsState = signal<ReadonlyArray<MenuGroup>>(buildMenuGroups([]));
  private readonly errorState = signal(false);
  private loadRequestId = 0;

  readonly groups = this.groupsState.asReadonly();
  readonly error = this.errorState.asReadonly();

  load(): void {
    const requestId = ++this.loadRequestId;
    this.errorState.set(false);

    this.api
      .listRuleEntityTypes()
      .pipe(take(1))
      .subscribe({
        next: (types) => {
          if (requestId !== this.loadRequestId) {
            return;
          }
          this.groupsState.set(buildMenuGroups(types));
        },
        error: () => {
          if (requestId !== this.loadRequestId) {
            return;
          }
          this.errorState.set(true);
        },
      });
  }
}
