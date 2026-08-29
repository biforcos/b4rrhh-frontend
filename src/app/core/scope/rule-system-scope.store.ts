import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { RuleSystemGateway } from '../../rulesystem/rule-system/gateway/rule-system.gateway';
import { RuleSystem } from '../../rulesystem/rule-system/models/rule-system.model';

/** Clave de `localStorage` donde se recuerda el ámbito elegido entre sesiones. */
export const RULE_SYSTEM_SCOPE_STORAGE_KEY = 'b4rrhh.rule-system-scope';

/**
 * El ámbito de la aplicación: el sistema de reglas activo (ADR-003, ADR-049).
 *
 * No es una entidad más del menú sino el contexto regulatorio en el que viven catálogos,
 * convenios, la ficha y la nómina — el equivalente al ejercicio en un programa de
 * contabilidad. Vive en el cromo, siempre visible, y con un solo sistema activo se muestra
 * igualmente, apagado.
 *
 * Este store solo guarda cuál es el ámbito; que las pantallas lo consuman es trabajo de la
 * fase 5 del rediseño (frontend#13). Hasta entonces, los stores de cada sección siguen con su
 * propio `selectedRuleSystemCode`.
 */
@Injectable({ providedIn: 'root' })
export class RuleSystemScopeStore {
  private readonly gateway = inject(RuleSystemGateway);

  private readonly itemsState = signal<ReadonlyArray<RuleSystem>>([]);
  private readonly activeCodeState = signal<string | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal(false);
  private loadRequestId = 0;

  /** Los sistemas de reglas activos, ordenados por código. */
  readonly items = this.itemsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly activeCode = this.activeCodeState.asReadonly();
  readonly active = computed(
    () => this.itemsState().find((item) => item.code === this.activeCodeState()) ?? null,
  );
  /**
   * Mientras ninguna pantalla consuma el ámbito, cambiarlo no cambiaría nada: la aplicación
   * seguiría mostrando los datos del sistema anterior bajo el rótulo del nuevo. Un control que
   * miente es peor que no tener control, así que hasta la fase 5 (frontend#13) el ámbito se
   * muestra pero no se elige. Al conectarlo, esta constante pasa a `true` y nada más cambia.
   */
  private static readonly SWITCHING_ENABLED = false;

  /**
   * Con un solo sistema no hay nada que elegir, y hasta la fase 5 tampoco con varios: el ámbito
   * se muestra apagado, sin desplegable.
   */
  readonly selectable = computed(
    () => RuleSystemScopeStore.SWITCHING_ENABLED && this.itemsState().length > 1,
  );

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(false);
    const requestId = ++this.loadRequestId;

    this.gateway
      .loadRuleSystems()
      .pipe(take(1))
      .subscribe({
        next: (all) => {
          if (requestId !== this.loadRequestId) {
            return;
          }
          // Por código, no en el orden del backend: sin un «sistema por defecto» declarado
          // en ningún sitio, el primero alfabético es al menos estable y predecible.
          const items = [...all]
            .filter((item) => item.active)
            .sort((a, b) => a.code.localeCompare(b.code));
          this.itemsState.set(items);
          this.activeCodeState.set(this.resolveInitialCode(items));
          this.loadingState.set(false);
        },
        error: () => {
          if (requestId !== this.loadRequestId) {
            return;
          }
          this.loadingState.set(false);
          this.errorState.set(true);
        },
      });
  }

  /** Cambia el ámbito y lo recuerda. No navega: el contexto se recarga donde se consuma. */
  select(code: string): void {
    const normalized = code.trim();
    if (!this.itemsState().some((item) => item.code === normalized)) {
      return;
    }
    this.activeCodeState.set(normalized);
    this.getStorage()?.setItem(RULE_SYSTEM_SCOPE_STORAGE_KEY, normalized);
  }

  private resolveInitialCode(items: ReadonlyArray<RuleSystem>): string | null {
    const remembered = this.getStorage()?.getItem(RULE_SYSTEM_SCOPE_STORAGE_KEY) ?? null;
    if (remembered && items.some((item) => item.code === remembered)) {
      return remembered;
    }
    return items[0]?.code ?? null;
  }

  private getStorage(): Storage | null {
    return typeof localStorage === 'undefined' ? null : localStorage;
  }
}
