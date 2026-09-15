import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  InjectionToken,
  Input,
  OnDestroy,
  Output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, Subscription, timer } from 'rxjs';

import { postFocusConcept, readNodeClickedMessage } from '../embed/designer-embed';

/** Lo que el marco puede estar haciendo, y son cuatro cosas distintas, no dos. */
export type DesignerFrameState = 'loading' | 'ready' | 'unresponsive' | 'error';

/** El plazo tras el que se deja de esperar al diseñador y se dice que no responde. */
export const DESIGNER_FRAME_DEADLINE_MS = 12_000;

/**
 * El plazo, inyectado.
 *
 * Es un `Observable` frío y no un número porque así el test lo dispara cuando quiere, con un
 * `Subject`, sin tocar el reloj. `vi.useFakeTimers()` aquí no es una opción: los specs comparten
 * entorno bajo `@angular/build:unit-test` y un reloj falso se lleva por delante al **siguiente**
 * spec, que se cae por «Test timed out» sin que nadie lo relacione con éste (`frontend#62`).
 */
export const DESIGNER_FRAME_DEADLINE = new InjectionToken<Observable<unknown>>(
  'designer-frame-deadline',
  { factory: () => timer(DESIGNER_FRAME_DEADLINE_MS) },
);

/**
 * El marco que embebe el diseñador para enseñar el grafo de un recibo (`b4rrhh/frontend#66`).
 *
 * **Aquí no se dibuja nada.** El grafo lo pinta el diseñador, y eso es la decisión del
 * `frontend#42`, no una comodidad: dos dibujos del mismo grafo divergen, y aquí divergir significa
 * que la explicación de un número deja de parecerse al grafo que lo produce. Lo único que este
 * componente pone en pantalla es **lo que le pasa al marco**, que el diseñador no puede contar
 * porque cuando falla no hay nadie dentro que hable.
 *
 * Y son cuatro estados que se distinguen entre sí:
 *
 * - `loading` — el marco está cargando. Se dice, porque la primera vez se descarga un bundle con
 *   React, `@xyflow/react` y dagre, y un rato en blanco sin explicación es el peor momento de la
 *   demo para una espera: es justo cuando alguien ha preguntado «de dónde sale esto».
 * - `ready` — el `load` ha llegado. Desde aquí **calla**: lo que se ve dentro lo dice el diseñador,
 *   que tiene sus propios cuatro silencios con motivo (recibo sin pasos, 404, error del grafo,
 *   error de los pasos).
 * - `unresponsive` — el plazo se agotó sin `load`. Es lo que pasa cuando nadie contesta en
 *   `/designer/`, y sin este estado se vería un marco en blanco indistinguible de un grafo vacío.
 * - `error` — el `iframe` disparó `error`, **o cargó algo que no es el diseñador**. Lo segundo no es
 *   rebuscado: con el diseñador apagado el proxy contesta un 500 de cuerpo vacío, el `load` llega
 *   igual y sin mirar dentro el marco se quedaría en blanco. Se vio en el navegador.
 *
 * **Un marco en blanco nunca se queda mudo**: mientras el estado no es `ready` hay un cartel encima.
 */
@Component({
  selector: 'app-recibos-valorizacion-grafo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grafo-wrap">
      <iframe
        #frame
        class="grafo-frame"
        [src]="frameSrc()"
        title="Grafo del recibo"
        (load)="onFrameLoad()"
        (error)="onFrameError()"
      ></iframe>

      @if (state() !== 'ready') {
        <div class="frame-notice" role="status">
          @if (state() === 'loading') {
            <p class="notice-title">Cargando el grafo del recibo…</p>
            <p class="notice-body">
              La primera vez se descarga el diseñador entero. Las siguientes ya está en el
              navegador.
            </p>
          } @else if (state() === 'unresponsive') {
            <p class="notice-title">El diseñador no responde.</p>
            <p class="notice-body">
              El marco no ha acabado de cargar en {{ deadlineSeconds }} segundos. El grafo se sirve
              en <code>/designer/</code> de este mismo origen: si nadie lo está sirviendo ahí, es
              aquí donde se ve.
            </p>
            <p class="notice-note">
              Esto no dice que el recibo no tenga grafo. Dice que no se ha podido preguntar.
            </p>
            <button class="notice-retry" type="button" (click)="retry()">Reintentar</button>
          } @else {
            <p class="notice-title">El marco ha cargado, pero dentro no está el diseñador.</p>
            <p class="notice-body">
              Suele ser que nadie sirve <code>/designer/</code> —un 500 o un 502 del proxy llegan
              como una página vacía—, o que el navegador se ha negado a pintar el marco. Si el
              backoffice va detrás de un nginx, mira la cabecera <code>X-Frame-Options</code>: con
              <code>DENY</code> no se enmarca ni el mismo origen.
            </p>
            <p class="notice-note">
              Esto no dice que el recibo no tenga grafo. Dice que no se ha podido preguntar.
            </p>
            <button class="notice-retry" type="button" (click)="retry()">Reintentar</button>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './recibos-valorizacion-grafo.component.scss',
})
export class RecibosValorizacionGrafoComponent implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly deadline = inject(DESIGNER_FRAME_DEADLINE);
  private readonly destroyRef = inject(DestroyRef);

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  private deadlineSub: Subscription | null = null;

  /** Lo pinchado antes de que el marco cargara. Se manda en el `load`; se guarda el último. */
  private pendingConceptCode: string | null = null;
  private lastFocusSeq = 0;
  private attempt = 0;
  private openedAt = performance.now();

  readonly state = signal<DesignerFrameState>('loading');

  /**
   * Lo que tardó el marco en cargar, en milisegundos, o `null` si aún no ha cargado.
   *
   * Se mide porque el issue pide el número medido y no una impresión. **Mide hasta el `load` del
   * `iframe`**, que es lo último que este lado puede observar: el diseñador todavía tiene que pedir
   * los conceptos y los pasos antes de dibujar, y saber cuándo acaba eso exigiría un tercer mensaje
   * que la decisión del `designer#8` deja fuera a propósito.
   */
  readonly loadMillis = signal<number | null>(null);

  readonly deadlineSeconds = Math.round(DESIGNER_FRAME_DEADLINE_MS / 1000);

  readonly frameSrc = signal<SafeResourceUrl | null>(null);

  private readonly _url = signal('');

  /** La dirección del recibo en el diseñador, relativa y del mismo origen. */
  @Input({ required: true }) set url(value: string) {
    if (value === this._url()) return;
    this._url.set(value);
    this.restartFrame();
  }

  /**
   * El concepto en el que centrarse, con un número de orden.
   *
   * Lleva `seq` porque pinchar **dos veces el mismo paso** es pedir que se centre dos veces, y sin
   * él la segunda no cambiaría el valor de la entrada y no pasaría nada.
   */
  @Input() set focusRequest(value: { conceptCode: string; seq: number } | null) {
    if (!value || value.seq === this.lastFocusSeq) return;
    this.lastFocusSeq = value.seq;
    this.focusConcept(value.conceptCode);
  }

  /** Han pinchado un nodo del grafo. */
  @Output() nodeClicked = new EventEmitter<string>();

  constructor() {
    const onMessage = (event: MessageEvent): void => {
      const conceptCode = readNodeClickedMessage(event, window.location.origin);
      if (conceptCode === null) return;
      this.nodeClicked.emit(conceptCode);
    };

    window.addEventListener('message', onMessage);
    this.destroyRef.onDestroy(() => window.removeEventListener('message', onMessage));
  }

  ngOnDestroy(): void {
    this.deadlineSub?.unsubscribe();
  }

  /**
   * Pide centrarse en un concepto, ahora o cuando se pueda.
   *
   * **No se manda antes del `load`**, y eso no es una precaución de más: el diseñador guarda el
   * mensaje que llega antes de que el lienzo esté listo, pero para guardarlo tiene que haber oído,
   * y su oyente lo instala un módulo del documento del marco. Antes del `load` ese documento
   * todavía no ha ejecutado nada, así que un `postMessage` de ahí no lo recibe nadie y no queda
   * rastro. Ésta es la mitad de la espera que le toca a este lado.
   */
  focusConcept(conceptCode: string): void {
    if (this.state() === 'ready') {
      postFocusConcept(conceptCode, this.frameWindow(), window.location.origin);
      return;
    }
    this.pendingConceptCode = conceptCode;
  }

  onFrameLoad(): void {
    this.deadlineSub?.unsubscribe();
    this.deadlineSub = null;

    if (this.loadMillis() === null) {
      this.loadMillis.set(Math.round(performance.now() - this.openedAt));
    }

    // Que haya cargado algo no quiere decir que haya cargado el diseñador. Se comprobó en el
    // navegador: con el diseñador apagado, el proxy contesta un 500 de cuerpo vacío, el `load`
    // llega igual y el marco se queda EN BLANCO — que es exactamente lo que este issue viene a
    // quitar. Lo mismo hace un 502 del nginx, o un marco que el navegador se niega a pintar.
    if (!this.frameHasDesigner()) {
      this.state.set('error');
      return;
    }

    this.state.set('ready');

    if (this.pendingConceptCode !== null) {
      const conceptCode = this.pendingConceptCode;
      this.pendingConceptCode = null;
      postFocusConcept(conceptCode, this.frameWindow(), window.location.origin);
    }
  }

  /**
   * Si lo que hay dentro del marco es el diseñador.
   *
   * Se mira su `#root`, que es el ancla que su `index.html` trae siempre. Poder mirarlo es la otra
   * cara del mismo origen: si el documento fuese de otro origen, leerlo lanzaría — y ese caso
   * también es un error, porque este montaje sólo funciona en el mismo origen.
   *
   * El `#root` es un acuerdo con el otro repo, como los nombres de los mensajes, y está sujeto por
   * el mismo candado en `designer-embed.spec.ts`.
   */
  private frameHasDesigner(): boolean {
    try {
      return this.frame()?.nativeElement.contentDocument?.getElementById('root') != null;
    } catch {
      return false;
    }
  }

  onFrameError(): void {
    this.deadlineSub?.unsubscribe();
    this.deadlineSub = null;
    this.state.set('error');
  }

  retry(): void {
    this.restartFrame();
  }

  private frameWindow(): Window | null {
    return this.frame()?.nativeElement.contentWindow ?? null;
  }

  private restartFrame(): void {
    this.attempt += 1;
    this.state.set('loading');
    this.loadMillis.set(null);
    this.openedAt = performance.now();

    // El `intento` no es un parámetro del diseñador: es lo que hace que la dirección cambie y el
    // navegador vuelva a cargar el marco. Sin él, reintentar con la misma `src` no hace nada.
    const url = this.attempt === 1 ? this._url() : `${this._url()}?intento=${this.attempt}`;
    this.frameSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));

    this.deadlineSub?.unsubscribe();
    this.deadlineSub = this.deadline.subscribe(() => {
      if (this.state() === 'loading') this.state.set('unresponsive');
    });
  }
}
