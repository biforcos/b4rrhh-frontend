import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { OperacionesGateway } from '../gateway/operaciones.gateway';
import {
  CalculationRunMessage,
  messageNeedsAttention,
} from '../models/calculation-run-message.model';
import { CalculationRun, unitsWithoutPayslip } from '../models/calculation-run.model';

export type EjecucionMessageFilter = 'ALL' | 'ATTENTION';

/**
 * El estado de **una** ejecución mirada de cerca: sus contadores y sus mensajes por unidad.
 *
 * Aparte de `OperacionesStore`, que es el de la pantalla de lanzamiento y guarda lo que se está
 * pidiendo. Este se provee en la ruta, así que cada ejecución que se abre empieza limpia.
 */
@Injectable()
export class EjecucionStore {
  private readonly gateway = inject(OperacionesGateway);

  private readonly runState = signal<CalculationRun | null>(null);
  private readonly messagesState = signal<ReadonlyArray<CalculationRunMessage>>([]);
  private readonly loadingState = signal<boolean>(false);
  private readonly errorState = signal<boolean>(false);
  private readonly filterState = signal<EjecucionMessageFilter>('ALL');

  readonly run = this.runState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly filter = this.filterState.asReadonly();

  readonly attentionMessages = computed(() => this.messagesState().filter(messageNeedsAttention));

  readonly messages = computed(() =>
    this.filterState() === 'ATTENTION' ? this.attentionMessages() : this.messagesState(),
  );

  readonly totalMessages = computed(() => this.messagesState().length);

  /**
   * Cuántas unidades no acabaron en recibo, según los contadores.
   *
   * No se lee del `status`: una ejecución COMPLETED puede haber dejado gente sin recibo, y de
   * hecho la de la última resiembra dejó dos.
   */
  readonly unitsWithoutPayslip = computed(() => {
    const run = this.runState();
    return run === null ? 0 : unitsWithoutPayslip(run);
  });

  load(runId: number): void {
    this.loadingState.set(true);
    this.errorState.set(false);
    forkJoin({
      run: this.gateway.getCalculationRun(runId),
      messages: this.gateway.listCalculationRunMessages(runId),
    }).subscribe({
      next: ({ run, messages }) => {
        this.runState.set(run);
        this.messagesState.set(messages);
        this.loadingState.set(false);
      },
      error: () => {
        this.loadingState.set(false);
        this.errorState.set(true);
      },
    });
  }

  /** El id de la ruta no es un entero positivo: no hay nada que pedir y la pantalla lo dice. */
  failWithInvalidRunId(): void {
    this.loadingState.set(false);
    this.errorState.set(true);
  }

  setFilter(filter: EjecucionMessageFilter): void {
    this.filterState.set(filter);
  }
}
