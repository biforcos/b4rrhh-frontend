import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

import { EmployeeRetroMarkStore } from '../../data-access/employee-retro-mark.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import {
  EmployeeRetroMarkModel,
  canDiscardRetroMark,
} from '../../models/employee-retro-mark.model';
import { SectionHeadingComponent } from '../../../../shared/ui/section-heading/section-heading.component';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';

/**
 * Las correcciones a meses ya entregados de este empleado (`b4rrhh/frontend#86`,
 * `b4rrhh/backend#130`).
 *
 * <h2>Por qué es de sólo lectura salvo un verbo</h2>
 *
 * <p>Las marcas **no las pone nadie a mano**. Las ponen los escritores de cada vertical por un único
 * puerto, y hay un candado de arquitectura que dice que ninguna escritura con fecha se lo salta. Una
 * pantalla que dejara crear una sería una segunda puerta a esa tabla, y entonces el candado dejaría
 * de significar lo que dice.
 *
 * <h2>Y por qué descartar no borra</h2>
 *
 * <p>Porque el recibo tiene que poder contar que **había una corrección conocida que alguien decidió
 * no pagar**. Una fila borrada no cuenta nada: deja el mes igual que si nunca se hubiera tocado. Así
 * que descartar deja la fila donde está, en su estado, con quién y con por qué — y el motivo es
 * obligatorio, porque «descartada» sin porqué no explica nada seis meses después.
 *
 * <h2>El molde</h2>
 *
 * <p>El de la sección de ausencias (`b4rrhh/frontend#84`): lista con la acción en la propia fila, sin
 * modal. Es el molde de una lista de ocurrencias, que es lo que esto es. La diferencia con aquélla es
 * que ésta **no ofrece añadir**, y eso no es una simplificación: es la decisión de arriba.
 */
@Component({
  selector: 'app-employee-retro-mark-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, SectionHeadingComponent, UiButtonComponent],
  templateUrl: './employee-retro-mark-section.component.html',
  styleUrl: './employee-retro-mark-section.component.scss',
})
export class EmployeeRetroMarkSectionComponent {
  readonly employeeBusinessKey = input<EmployeeBusinessKey | null>(null);

  private readonly store = inject(EmployeeRetroMarkStore);

  protected readonly texts = employeeTexts;

  private readonly discardingIdState = signal<number | null>(null);
  private readonly discardReasonState = signal<string>('');

  protected readonly discardingId = this.discardingIdState.asReadonly();
  protected readonly discardReason = this.discardReasonState.asReadonly();

  protected readonly rows = computed(() => this.store.marks());
  protected readonly hasRows = computed(() => this.rows().length > 0);
  protected readonly busy = computed(() => this.store.loading() || this.store.mutating());

  protected readonly canDiscard = computed(() => this.discardReasonState().trim().length > 0);

  constructor() {
    effect(() => {
      const key = this.employeeBusinessKey();
      untracked(() => {
        this.store.loadMarks(key);
        this.resetLocal();
      });
    });

    effect(() => {
      if (!this.store.success()) return;
      untracked(() => this.resetLocal());
    });
  }

  /**
   * Los nombres de las verticales que avisan de una escritura con fecha.
   *
   * <p>Son un conjunto cerrado declarado en el backend (`DatedWriteSources`) y no un catálogo de
   * entidades de regla, así que el literal vive aquí: no hay ningún sitio del que leerlo. Una
   * vertical que no esté en este mapa sale **con su código**, que es lo que hace el resto de la
   * aplicación con un código sin nombre (ADR-052): un hueco no dice nada y un código sí.
   */
  private readonly verticalLabels: Readonly<Record<string, string>> = {
    ABSENCE: 'Ausencia',
    CONTRACT: 'Contrato',
    COST_CENTER: 'Centro de coste',
    EXTRA_PAYMENT_REGIME: 'Régimen de pagas extras',
    LABOR_CLASSIFICATION: 'Clasificación laboral',
    PAYROLL_INPUT: 'Entrada de nómina',
    WORK_CENTER: 'Centro de trabajo',
    WORKING_TIME: 'Jornada',
  };

  protected verticalLabel(row: EmployeeRetroMarkModel): string {
    return this.verticalLabels[row.sourceVerticalCode] ?? row.sourceVerticalCode;
  }

  /** «Desde 08/2026, presencia 1», que es lo que la marca dice: hasta qué mes alcanza. */
  protected describeOrigin(row: EmployeeRetroMarkModel): string {
    return `Desde ${formatPeriod(row.fromPeriodCode)}, presencia ${row.presenceNumber}`;
  }

  /**
   * En qué quedó la marca. **Sin la fecha**, que la pone la plantilla con el `DatePipe`.
   *
   * Y no es un detalle de reparto: las marcas traen un instante ISO con microsegundos y zona
   * (`2026-09-27T07:34:28.024180Z`), que `formatDisplayDate` devuelve tal cual porque espera una
   * fecha. Salía crudo en la pantalla. Quien sabe formatear un instante en este frontend es el
   * `DatePipe`, y ya lo hace en la propia fila para el `createdAt`.
   */
  protected describeStatus(row: EmployeeRetroMarkModel): string {
    const t = this.texts;
    if (row.status === 'DISCARDED') {
      const quien = row.discardedBy ?? 'alguien';
      return `${t.retroMarksDiscardedLabel} por ${quien}`;
    }
    if (row.status === 'CONSUMED') {
      const donde = row.consumedPeriodCode
        ? ` en el recibo de ${formatPeriod(row.consumedPeriodCode)}`
        : '';
      const corrida = row.consumedRunId === null ? '' : ` (ejecución #${row.consumedRunId})`;
      return `${t.retroMarksConsumedLabel}${donde}${corrida}`;
    }
    // Activa y sin nadie que la pague (b4rrhh/backend#139): «pendiente» diría algo que no va a pasar.
    if (row.withoutAReceiptToPayIt) {
      return t.retroMarksWithoutAReceiptLabel;
    }
    return t.retroMarksActiveLabel;
  }

  /** De qué fila salió: su clave o su id, o que ya no existe porque la escritura fue un borrado. */
  protected describeSource(row: EmployeeRetroMarkModel): string {
    return row.sourceRowLabel === null
      ? `${row.sourceTable} · la fila ya no existe`
      : `${row.sourceTable} · ${row.sourceRowLabel}`;
  }

  protected offersDiscard(row: EmployeeRetroMarkModel): boolean {
    return canDiscardRetroMark(row.status);
  }

  protected startDiscard(row: EmployeeRetroMarkModel): void {
    if (this.store.mutating()) return;
    this.store.clearFeedback();
    this.discardingIdState.set(row.id);
    this.discardReasonState.set('');
  }

  protected updateDiscardReason(value: string): void {
    this.discardReasonState.set(value);
    this.store.clearFeedback();
  }

  protected confirmDiscard(): void {
    const key = this.employeeBusinessKey();
    const id = this.discardingIdState();
    if (!key || id === null || !this.canDiscard() || this.store.mutating()) return;
    this.store.discardMark(key, id, this.discardReasonState().trim());
  }

  protected cancel(): void {
    this.store.clearFeedback();
    this.resetLocal();
  }

  private resetLocal(): void {
    this.discardingIdState.set(null);
    this.discardReasonState.set('');
  }
}

/** `202608` como `08/2026`: el mes se lee así en el recibo y aquí se lee igual. */
function formatPeriod(periodCode: string): string {
  if (periodCode.length !== 6) return periodCode;
  return `${periodCode.slice(4)}/${periodCode.slice(0, 4)}`;
}
