import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { RuleSystemScopeStore } from '../../../core/scope/rule-system-scope.store';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeWorkQueue, EmployeeWorkQueueCriteria } from '../models/employee-work-queue.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { EmployeeDirectoryReadGateway } from './employee-directory-read.gateway';

/** Clave de `localStorage`: la cola sobrevive a recargar la página. */
export const EMPLOYEE_WORK_QUEUE_STORAGE_KEY = 'b4rrhh.employee-work-queue';

export type EmployeeWorkQueueNotice = 'moved' | 'empty' | 'first' | 'last' | 'request-failed';

/**
 * La cola de trabajo del raíl (frontend#20): **un cursor sobre la consulta del directorio**, no
 * una lista en memoria (opción B del #27). Por eso escala igual a 12 que a 25.000: cada paso es
 * pedirle al servidor la posición siguiente por el mismo orden estable que ya tiene.
 *
 * Cada paso pide dos filas —la posición actual y la siguiente— y así, de paso, se sabe si la
 * cola se ha movido bajo los pies: si quien está en la posición actual ya no es quien debía,
 * alguien ha cambiado datos mientras se recorría. No se salta en silencio: se avisa y se
 * recoloca sobre lo que hay.
 *
 * Dura: sobrevive a recargar (localStorage) y muere al cambiar de ámbito, porque la pregunta
 * se hizo dentro de un sistema de reglas.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeWorkQueueStore {
  private readonly gateway = inject(EmployeeDirectoryReadGateway);
  private readonly scopeStore = inject(RuleSystemScopeStore);

  private readonly rawQueue = signal<EmployeeWorkQueue | null>(this.readStorage());
  private readonly loadingState = signal(false);
  private readonly noticeState = signal<EmployeeWorkQueueNotice | null>(null);

  /** La cola vigente, o `null` si no la hay o se abrió en otro ámbito. */
  readonly queue = computed<EmployeeWorkQueue | null>(() => {
    const queue = this.rawQueue();
    if (!queue) return null;
    const scope = this.scopeStore.activeCode();
    // Sin ámbito resuelto todavía, se le da el beneficio de la duda; con otro ámbito, no.
    return scope === null || queue.scope === null || queue.scope === scope ? queue : null;
  });
  readonly active = computed(() => this.queue() !== null);
  /** «7 de 103»: posición 1-based y total que cumple el criterio. */
  readonly position = computed(() => (this.queue()?.index ?? 0) + 1);
  readonly total = computed(() => this.queue()?.total ?? 0);
  readonly hasPrevious = computed(() => (this.queue()?.index ?? 0) > 0);
  readonly hasNext = computed(() => {
    const queue = this.queue();
    return queue !== null && queue.index < queue.total - 1;
  });
  readonly loading = this.loadingState.asReadonly();
  readonly notice = this.noticeState.asReadonly();

  /**
   * Abre la cola con este criterio, en la primera posición. Devuelve la clave del primero, o
   * `null` si no hay nadie que lo cumpla (entonces no hay cola).
   */
  async start(criteria: EmployeeWorkQueueCriteria): Promise<EmployeeBusinessKey | null> {
    const normalized: EmployeeWorkQueueCriteria = {
      q: criteria.q.trim(),
      status: criteria.status,
    };
    this.noticeState.set(null);
    const page = await this.fetch(normalized, 0);
    if (!page) return null;
    const first = page.items[0];
    if (!first || page.total === 0) {
      this.noticeState.set('empty');
      return null;
    }
    this.commit({
      criteria: normalized,
      scope: this.scopeStore.activeCode(),
      index: 0,
      total: page.total,
      currentKey: toEmployeeBusinessKey(first),
    });
    return toEmployeeBusinessKey(first);
  }

  next(): Promise<EmployeeBusinessKey | null> {
    return this.move(1);
  }

  previous(): Promise<EmployeeBusinessKey | null> {
    return this.move(-1);
  }

  /** Sale de la cola: se olvida del todo. Volver a la lista no la borra; esto sí. */
  leave(): void {
    this.rawQueue.set(null);
    this.noticeState.set(null);
    this.writeStorage(null);
  }

  clearNotice(): void {
    this.noticeState.set(null);
  }

  /**
   * Un paso. Pide dos filas empezando por la posición de origen (hacia delante) o la de
   * destino (hacia atrás), de modo que una de las dos debe ser quien ya estaba: si no lo es, la
   * cola se ha movido y se avisa.
   */
  private async move(delta: 1 | -1): Promise<EmployeeBusinessKey | null> {
    const queue = this.queue();
    if (!queue) return null;
    this.noticeState.set(null);

    if (delta > 0 && queue.index >= queue.total - 1) {
      this.noticeState.set('last');
      return null;
    }
    if (delta < 0 && queue.index === 0) {
      this.noticeState.set('first');
      return null;
    }

    const targetIndex = queue.index + delta;
    const windowStart = delta > 0 ? queue.index : targetIndex;
    const page = await this.fetch(queue.criteria, windowStart);
    if (!page) return null;

    const expectedAt = delta > 0 ? 0 : 1;
    const targetAt = delta > 0 ? 1 : 0;
    const expected = page.items[expectedAt];
    const target = page.items[targetAt];

    // Alguien cambió datos mientras se recorría: se dice, y se sigue sobre lo que hay. Con dos
    // filas no se puede saber si quien estaba se movió o dejó de cumplir el criterio, y no se
    // finge: un solo aviso.
    const drift: EmployeeWorkQueueNotice | null =
      expected && areEmployeeBusinessKeysEqual(expected, queue.currentKey) ? null : 'moved';

    if (page.total === 0 || !target) {
      // La cola ya no llega hasta ahí: se cierra sobre lo último que existe, o se queda vacía.
      const last = page.items[page.items.length - 1];
      if (!last) {
        this.noticeState.set('empty');
        this.commit({ ...queue, total: page.total, index: 0 });
        return null;
      }
      this.noticeState.set(drift ?? 'moved');
      this.commit({
        ...queue,
        total: page.total,
        index: windowStart + page.items.length - 1,
        currentKey: toEmployeeBusinessKey(last),
      });
      return toEmployeeBusinessKey(last);
    }

    if (drift) {
      this.noticeState.set(drift);
    }

    this.commit({
      ...queue,
      total: page.total,
      index: targetIndex,
      currentKey: toEmployeeBusinessKey(target),
    });
    return toEmployeeBusinessKey(target);
  }

  private async fetch(criteria: EmployeeWorkQueueCriteria, index: number) {
    this.loadingState.set(true);
    try {
      // Con `size=2` la página `index` empieza en la fila `2·index`, no en `index`: la cola
      // pide de una en una y lee dos, así que se pide la página `index` de tamaño 1 dos veces.
      const [current, following] = await Promise.all([
        firstValueFrom(this.gateway.readDirectory({ ...criteria, page: index, size: 1 })),
        firstValueFrom(this.gateway.readDirectory({ ...criteria, page: index + 1, size: 1 })),
      ]);
      return { items: [...current.items, ...following.items], total: current.total };
    } catch {
      this.noticeState.set('request-failed');
      return null;
    } finally {
      this.loadingState.set(false);
    }
  }

  private commit(queue: EmployeeWorkQueue): void {
    this.rawQueue.set(queue);
    this.writeStorage(queue);
  }

  private readStorage(): EmployeeWorkQueue | null {
    try {
      const raw = localStorage.getItem(EMPLOYEE_WORK_QUEUE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<EmployeeWorkQueue>;
      if (
        !parsed ||
        typeof parsed.index !== 'number' ||
        typeof parsed.total !== 'number' ||
        !parsed.criteria ||
        !parsed.currentKey
      ) {
        return null;
      }
      return parsed as EmployeeWorkQueue;
    } catch {
      return null;
    }
  }

  private writeStorage(queue: EmployeeWorkQueue | null): void {
    try {
      if (queue) {
        localStorage.setItem(EMPLOYEE_WORK_QUEUE_STORAGE_KEY, JSON.stringify(queue));
      } else {
        localStorage.removeItem(EMPLOYEE_WORK_QUEUE_STORAGE_KEY);
      }
    } catch {
      // Sin almacenamiento la cola vive lo que la sesión.
    }
  }
}
