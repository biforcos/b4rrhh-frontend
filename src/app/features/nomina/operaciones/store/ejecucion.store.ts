import { InjectionToken, Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, forkJoin, interval, switchMap, takeWhile } from 'rxjs';

import { OperacionesGateway } from '../gateway/operaciones.gateway';
import {
  CalculationRunMessage,
  messageNeedsAttention,
} from '../models/calculation-run-message.model';
import {
  CalculationRun,
  isRunFinished,
  runProgressPercent,
  unitsWithoutPayslip,
} from '../models/calculation-run.model';

/**
 * Cada cuanto se vuelve a preguntar por la ejecucion mientras corre. Tres segundos es lo que usaba
 * la barra del panel de lanzamiento, y una corrida de la plantilla dura unos cinco minutos: son
 * unas cien lecturas de una fila.
 */
const POLL_INTERVAL_MS = 3000;

/**
 * El pulso del sondeo: cada valor que emite es una vuelta de «pregunta como va».
 *
 * Es un token y no un `interval()` escrito dentro del store para que un test pueda darle el pulso
 * a mano. Falsear el reloj global con `vi.useFakeTimers()` tambien serviria, y **no vale**: estos
 * specs comparten entorno, y el reloj falso de uno se lleva por delante al siguiente —comprobado,
 * tumbaba el de `employee-cost-center-section` por tiempo agotado (frontend#62).
 */
export const EJECUCION_POLL_TICK = new InjectionToken<Observable<unknown>>('EJECUCION_POLL_TICK', {
  factory: () => interval(POLL_INTERVAL_MS),
});

export type EjecucionMessageFilter = 'ALL' | 'ATTENTION';

/**
 * El estado de **una** ejecución mirada de cerca: sus contadores y sus mensajes por unidad.
 *
 * Aparte de `OperacionesStore`, que es el de la pantalla de lanzamiento y guarda lo que se está
 * pidiendo. Este se provee en la ruta, así que cada ejecución que se abre empieza limpia.
 */
@Injectable()
export class EjecucionStore implements OnDestroy {
  private readonly gateway = inject(OperacionesGateway);
  private readonly pollTick = inject(EJECUCION_POLL_TICK);

  private readonly runState = signal<CalculationRun | null>(null);
  private readonly messagesState = signal<ReadonlyArray<CalculationRunMessage>>([]);
  private readonly loadingState = signal<boolean>(false);
  private readonly errorState = signal<boolean>(false);
  private readonly filterState = signal<EjecucionMessageFilter>('ALL');
  private pollSubscription: Subscription | null = null;

  readonly run = this.runState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly filter = this.filterState.asReadonly();

  readonly attentionMessages = computed(() => this.messagesState().filter(messageNeedsAttention));

  readonly messages = computed(() =>
    this.filterState() === 'ATTENTION' ? this.attentionMessages() : this.messagesState(),
  );

  readonly totalMessages = computed(() => this.messagesState().length);

  /** Si la ejecucion sigue viva, y por tanto lo que se esta viendo cambia solo. */
  readonly live = computed(() => {
    const run = this.runState();
    return run !== null && !isRunFinished(run);
  });

  /** Por donde va, en tanto por ciento; null mientras no se sepa cuantas unidades son. */
  readonly progressPercent = computed(() => {
    const run = this.runState();
    return run === null ? null : runProgressPercent(run);
  });

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
    this.stopPolling();
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
        this.followWhileUnfinished(run);
      },
      error: () => {
        this.loadingState.set(false);
        this.errorState.set(true);
      },
    });
  }

  /**
   * Sigue la ejecucion hasta que acabe, y entonces para.
   *
   * **Se relee la ejecucion, no sus mensajes.** La ejecucion es una fila con sus contadores; los
   * mensajes de una corrida de la plantilla son casi novecientos —uno por unidad—, y traerlos cada
   * tres segundos seria mover el padron entero para ver subir un numero. La lista se recarga una
   * vez, cuando la ejecucion termina, que es cuando hay algo que hacer con ella.
   *
   * El `takeWhile` con el `true` del final deja pasar el estado final antes de cerrar, asi que el
   * ultimo valor que se pinta es el definitivo y no el penultimo.
   */
  private followWhileUnfinished(run: CalculationRun): void {
    if (isRunFinished(run)) return;
    this.pollSubscription = this.pollTick
      .pipe(
        switchMap(() => this.gateway.getCalculationRun(run.runId)),
        takeWhile((polled) => !isRunFinished(polled), true),
      )
      .subscribe({
        next: (polled) => {
          this.runState.set(polled);
          if (isRunFinished(polled)) {
            this.reloadMessages(polled.runId);
          }
        },
        // Un sondeo que falla no borra lo que ya se esta viendo: la ejecucion sigue su curso en el
        // backend y la pantalla lo dice para que se pueda recargar.
        error: () => this.errorState.set(true),
      });
  }

  private reloadMessages(runId: number): void {
    this.gateway.listCalculationRunMessages(runId).subscribe({
      next: (messages) => this.messagesState.set(messages),
      error: () => this.errorState.set(true),
    });
  }

  /** El id de la ruta no es un entero positivo: no hay nada que pedir y la pantalla lo dice. */
  failWithInvalidRunId(): void {
    this.loadingState.set(false);
    this.errorState.set(true);
  }

  /**
   * Este store se provee en el componente de la ruta, asi que salir de la pantalla lo destruye. Sin
   * esto el temporizador del sondeo seguiria preguntando por una ejecucion que ya nadie mira.
   */
  ngOnDestroy(): void {
    this.stopPolling();
  }

  private stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
  }

  setFilter(filter: EjecucionMessageFilter): void {
    this.filterState.set(filter);
  }
}
