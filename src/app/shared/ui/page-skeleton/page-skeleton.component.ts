import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
  untracked,
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
 * | contextual   | `[slot=contextual]`  | Derecha; plegado por defecto, estado recordado  |
 *
 * Las reglas del ADR que aquí se cumplen: las acciones de página van en `identidad`; el
 * contextual está plegado por defecto y su estado se recuerda; el raíl se pliega entero, no por
 * partes; los huecos se dimensionan una vez, aquí — ninguna pantalla ajusta anchos por su cuenta.
 *
 * Sobre el ancho: la medida de lectura manda. `principal` no pasa de `--page-measure` aunque
 * sobre pantalla; el espacio que sobra se usa para poner el contextual al lado, no para estirar.
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

  private readonly railCollapsedState = signal(false);
  private readonly contextualOpenState = signal(false);

  readonly railCollapsed = this.railCollapsedState.asReadonly();
  readonly hasContextual = computed(() => this.contextualTitle() !== null);
  readonly contextualOpen = computed(
    () => this.hasContextual() && (this.contextualForcedOpen() || this.contextualOpenState()),
  );

  constructor() {
    // Al cambiar de página (de clave), se recupera lo recordado para esa página.
    effect(() => {
      const key = this.storageKey();
      untracked(() => {
        this.railCollapsedState.set(this.read(key, 'rail-collapsed') === 'true');
        this.contextualOpenState.set(this.read(key, 'contextual-open') === 'true');
      });
    });
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
