import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { B4IconComponent } from '../icon/b4-icon.component';

/** Prefijo de las claves de `localStorage` donde se recuerda el estado de los huecos plegables. */
export const PAGE_SKELETON_STORAGE_PREFIX = 'b4rrhh.page-skeleton';

/**
 * El esqueleto de página (ADR-050): un único plano al que las pantallas se acogen, con cuatro
 * huecos nombrados.
 *
 * | Hueco        | Slot                 | Dónde                                           |
 * |--------------|----------------------|-------------------------------------------------|
 * | identidad    | `[slot=identidad]`   | Franja superior, ancho completo                 |
 * | raíl         | `[slot=rail]`        | Izquierda; se pliega entero, estado recordado   |
 * | principal    | contenido por defecto| El contenido, con medida de lectura             |
 * | contextual   | `[slot=contextual]`  | Derecha; abre o pliega según el ancho, recordado   |
 *
 * Las reglas del ADR que aquí se cumplen: las acciones de página van en `identidad`; el estado
 * inicial del contextual lo decide el ancho y lo que elija el usuario se recuerda y manda; el raíl
 * se pliega entero, no por partes; los huecos se dimensionan una vez, aquí — ninguna pantalla
 * ajusta anchos por su cuenta.
 *
 * Sobre el ancho: la medida de lectura manda. `principal` no pasa de `--page-measure` aunque
 * sobre pantalla; el espacio que sobra se usa para poner el contextual al lado, no para estirar.
 * De ahí el estado inicial del contextual (ADR-050 §2): si desplegarlo deja a `principal` por
 * encima de la medida, se abre —el sitio que sobra vale más con algo al lado que vacío—; si la
 * deja por debajo, se pliega. Se mide una vez, tras el primer render, y no al cambiar el tamaño
 * de la ventana: mover el panel bajo los pies de quien está leyendo es peor que dejarlo donde está.
 */
@Component({
  selector: 'app-page-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [B4IconComponent],
  templateUrl: './page-skeleton.component.html',
  styleUrl: './page-skeleton.component.scss',
  host: {
    '[class.page-skeleton-host--rail]': 'rail()',
    '[class.page-skeleton-host--rail-collapsed]': 'rail() && railCollapsed()',
    '[class.page-skeleton-host--contextual]': 'hasContextual()',
    '[class.page-skeleton-host--contextual-open]': 'contextualOpen()',
  },
})
export class PageSkeletonComponent {
  /**
   * Identifica la página en `localStorage`; sin clave, los estados no se recuerdan. Se
   * recomienda uno por tipo de página (`employee-detail`, `employee-directory`…), no por entidad.
   */
  readonly storageKey = input<string | null>(null);
  /** Hay hueco de raíl (se proyecta `[slot=rail]`). */
  readonly rail = input(false);
  /** Título del hueco contextual; `null` cuando la página no lo tiene. */
  readonly contextualTitle = input<string | null>(null);
  /** Nombre accesible del botón que pliega/despliega el raíl. */
  readonly railToggleLabel = input('Plegar o desplegar el raíl');
  /**
   * Fuerza el contextual abierto (p. ej. mientras dura un flujo que vive ahí). No toca el
   * estado recordado: cuando deja de forzarse, vuelve a lo que el usuario había elegido.
   */
  readonly contextualForcedOpen = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  private readonly railCollapsedState = signal(false);
  private readonly contextualOpenState = signal(false);
  /** Lo que el ancho decidió en el primer render; `null` hasta que se mide. */
  private readonly contextualFitsState = signal<boolean | null>(null);

  readonly railCollapsed = this.railCollapsedState.asReadonly();
  readonly hasContextual = computed(() => this.contextualTitle() !== null);
  readonly contextualOpen = computed(
    () => this.hasContextual() && (this.contextualForcedOpen() || this.contextualOpenState()),
  );

  constructor() {
    // Al cambiar de página (de clave), se recupera lo recordado para esa página. Si no hay nada
    // recordado, decide el ancho —lo medido en el primer render—, y no «plegado siempre».
    effect(() => {
      const key = this.storageKey();
      const fits = this.contextualFitsState();
      untracked(() => {
        this.railCollapsedState.set(this.read(key, 'rail-collapsed') === 'true');
        const remembered = this.read(key, 'contextual-open');
        this.contextualOpenState.set(remembered === null ? (fits ?? false) : remembered === 'true');
      });
    });

    // Hace falta el DOM para medir: tras el primer render, y solo esa vez. No se escucha
    // `resize` a propósito (ADR-050 §2).
    afterNextRender(() => this.contextualFitsState.set(this.contextualFits()));
  }

  /**
   * ¿Cabe el contextual abierto sin dejar a `principal` por debajo de la medida de lectura?
   * Se mide lo que `principal` tiene ahora y se le resta el ancho del contextual desplegado.
   */
  private contextualFits(): boolean {
    const main = this.main().nativeElement;
    const mainStyle = getComputedStyle(main);
    const available =
      main.clientWidth - this.toPx(mainStyle.paddingLeft) - this.toPx(mainStyle.paddingRight);
    const hostStyle = getComputedStyle(this.host.nativeElement);
    const contextual = this.toPx(hostStyle.getPropertyValue('--page-contextual'));
    const measure = this.toPx(hostStyle.getPropertyValue('--page-measure'));
    // Sin medida (los estilos no han cargado, o no hay layout) no hay decisión: plegado.
    if (measure <= 0 || contextual <= 0) return false;
    return available - contextual >= measure;
  }

  /** Las medidas del esqueleto están en `px` o en `rem`; jsdom devuelve cadenas vacías. */
  private toPx(value: string): number {
    const trimmed = value.trim();
    const amount = parseFloat(trimmed);
    if (Number.isNaN(amount)) return 0;
    return trimmed.endsWith('rem')
      ? amount * parseFloat(getComputedStyle(document.documentElement).fontSize)
      : amount;
  }

  toggleRail(): void {
    const next = !this.railCollapsedState();
    this.railCollapsedState.set(next);
    this.write(this.storageKey(), 'rail-collapsed', String(next));
  }

  toggleContextual(): void {
    const next = !this.contextualOpenState();
    this.contextualOpenState.set(next);
    this.write(this.storageKey(), 'contextual-open', String(next));
  }

  private read(key: string | null, name: string): string | null {
    return key
      ? (this.getStorage()?.getItem(`${PAGE_SKELETON_STORAGE_PREFIX}.${key}.${name}`) ?? null)
      : null;
  }

  private write(key: string | null, name: string, value: string): void {
    if (key) {
      this.getStorage()?.setItem(`${PAGE_SKELETON_STORAGE_PREFIX}.${key}.${name}`, value);
    }
  }

  private getStorage(): Storage | null {
    return typeof localStorage === 'undefined' ? null : localStorage;
  }
}
