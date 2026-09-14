import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PayrollCalculationStepModel } from '../models/payroll-calculation-step.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';

const NATURES = new Set([
  'EARNING',
  'DEDUCTION',
  'BASE',
  'TECHNICAL',
  'INFORMATIONAL',
  'TOTAL_EARNING',
  'TOTAL_DEDUCTION',
  'NET_PAY',
]);

/** El ámbito cuyo paso cubre el período entero y, por eso, no tiene fechas de segmento. */
const PERIOD_SCOPE = 'PERIOD';

export type ValorizacionView = 'recibo' | 'calculo';

/**
 * La Valorización, en dos vistas (`b4rrhh/frontend#65`).
 *
 * **Recibo** son las 14 líneas que se pagan, ordenadas por su orden de folio. Es el documento, y
 * es lo que este cajón enseñaba hasta ahora.
 *
 * **Cálculo** son los 35 pasos que el motor dio para llegar a esas 14, en el orden en que los dio.
 * Ahí están las bases y los técnicos que se calculaban y se tiraban: los que explican de dónde
 * sale el número.
 *
 * Van en dos pestañas y no en una lista más larga porque **son dos órdenes incompatibles**: una
 * lista única de 35 filas ordenada por folio deja de ser un recibo sin llegar a ser una
 * explicación. El orden es lo que hace legible a cada una.
 */
@Component({
  selector: 'app-recibos-valorizacion-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" (click)="onClose()"></div>

    <!--
      El cajon se ensancha en «Calculo» y vuelve a su ancho en «Recibo». Las dos vistas no
      necesitan lo mismo: el recibo son siete columnas estrechas y los pasos son nueve, con el
      orden de ejecucion delante y el de folio detras. A 460 px la columna que se salia era
      justo la del folio, que es la que distingue los pasos que se imprimen de los que no.
    -->
    <div class="drawer" [class.drawer-wide]="view() === 'calculo'">
      <div class="drawer-header">
        <div>
          <div class="drawer-title">Valorización</div>
          <div class="drawer-subtitle">{{ payrollKey }}</div>
        </div>
        <button class="close-btn" (click)="onClose()">✕</button>
      </div>

      <div class="tabs" role="tablist">
        <button
          class="tab"
          role="tab"
          [class.tab-active]="view() === 'recibo'"
          [attr.aria-selected]="view() === 'recibo'"
          (click)="showRecibo()"
        >
          Recibo
        </button>
        <button
          class="tab"
          role="tab"
          [class.tab-active]="view() === 'calculo'"
          [attr.aria-selected]="view() === 'calculo'"
          (click)="showCalculo()"
        >
          Cálculo
        </button>
      </div>

      <div class="search-bar">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input
            class="search-input"
            type="text"
            placeholder="Buscar por código o concepto…"
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
          />
        </div>
      </div>

      <div class="legend">
        @for (item of legendItems; track item.nature) {
          <span class="legend-item" [class]="natureClass(item.nature)">■ {{ item.label }}</span>
        }
      </div>

      @if (view() === 'recibo') {
        <div class="table-wrap">
          @if (loading) {
            <div class="loading-msg">Cargando conceptos…</div>
          } @else if (filteredConcepts().length === 0) {
            <div class="loading-msg">Sin resultados.</div>
          } @else {
            <table class="val-table">
              <thead>
                <tr>
                  <th class="col-stripe"></th>
                  <th class="col-period">Período</th>
                  <th>Clave</th>
                  <th>Concepto</th>
                  <th class="col-num">Cant.</th>
                  <th class="col-num">Tarifa</th>
                  <th class="col-num">Importe</th>
                </tr>
              </thead>
              <tbody>
                @for (c of filteredConcepts(); track c.lineNumber) {
                  <tr class="val-row">
                    <td class="col-stripe-cell" [class]="natureClass(c.conceptNatureCode)"></td>
                    <td class="col-period-cell">{{ c.originPeriodCode ?? '—' }}</td>
                    <td class="col-code-cell">{{ c.conceptCode }}</td>
                    <td class="col-label-cell">{{ c.conceptLabel }}</td>
                    <td class="col-num-cell">{{ c.quantity != null ? fmt(c.quantity) : '—' }}</td>
                    <td class="col-num-cell">{{ c.rate != null ? fmt(c.rate) : '—' }}</td>
                    <td class="col-num-cell col-amount" [class]="natureClass(c.conceptNatureCode)">
                      {{ c.amount != null ? fmt(c.amount) : '—' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      } @else {
        <div class="table-wrap">
          @if (stepsLoading) {
            <div class="loading-msg">Cargando los pasos del cálculo…</div>
          } @else if (stepsError) {
            <div class="loading-msg">
              No se han podido cargar los pasos del cálculo. Inténtalo de nuevo.
            </div>
          } @else if (thisPayrollHasNoSteps()) {
            <!--
              Vacío con motivo. Un panel vacío y mudo es indistinguible de «no hay nada que
              explicar», y es justo el defecto que estamos quitando en todas partes. Los 873
              recibos de la semilla están así: se calcularon antes de que el motor guardara sus
              pasos, y no se les inventan derivándolos de las líneas del recibo.
            -->
            <div class="empty-with-reason">
              <p class="empty-title">Este recibo no tiene pasos guardados.</p>
              <p class="empty-body">
                Se calculó antes de que el motor guardara sus pasos. Recalcúlalo para verlos.
              </p>
              <p class="empty-note">
                No es que no tenga conceptos: sus {{ conceptCount() }} líneas siguen en la pestaña
                «Recibo». Lo que falta es la explicación de cómo se llegó a ellas.
              </p>
            </div>
          } @else if (filteredSteps().length === 0) {
            <div class="loading-msg">Sin resultados.</div>
          } @else {
            <table class="val-table steps-table">
              <thead>
                <tr>
                  <th class="col-stripe"></th>
                  <th class="col-order">#</th>
                  <th>Clave</th>
                  <th>Concepto</th>
                  <th class="col-num">Cant.</th>
                  <th class="col-num">Tarifa</th>
                  <th class="col-num">Importe</th>
                  <th class="col-folio">Folio</th>
                </tr>
              </thead>
              <tbody>
                <!--
                  La clave de fila es executionOrder y no conceptCode: en los cinco empleados del
                  mes partido el 101 sale dos veces, con dos segmentos y dos precios, y un track
                  por concepto se comería una de las dos.
                -->
                @for (s of filteredSteps(); track s.executionOrder) {
                  <tr class="val-row" [class.step-on-payslip]="s.payslipOrderCode !== null">
                    <td class="col-stripe-cell" [class]="natureClass(s.functionalNature)"></td>
                    <td class="col-order-cell">{{ s.executionOrder }}</td>
                    <td class="col-code-cell">{{ s.conceptCode }}</td>
                    <td class="col-label-cell">
                      {{ s.conceptMnemonic }}
                      <span class="step-meta">{{ scopeLabel(s) }} · {{ s.calculationType }}</span>
                    </td>
                    <td class="col-num-cell">{{ s.quantity != null ? fmt(s.quantity) : '—' }}</td>
                    <td class="col-num-cell">{{ s.rate != null ? fmt(s.rate) : '—' }}</td>
                    <td class="col-num-cell col-amount" [class]="natureClass(s.functionalNature)">
                      {{ fmt(s.amount) }}
                    </td>
                    <td class="col-folio-cell">{{ s.payslipOrderCode ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>

            <!--
              La columna de importes no se suma, y por eso no hay fila de totales aquí: los pasos
              incluyen bases y técnicos, y su suma no es nada. Los totales son los del recibo.
            -->
            <p class="steps-note">
              {{ stepsOnPayslipCount() }} de {{ steps.length }} pasos llegaron al recibo, y son los
              que llevan orden de folio. Los demás son bases y técnicos: su columna de importes no
              se suma — los totales están en la pestaña «Recibo».
            </p>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './recibos-valorizacion-panel.component.scss',
})
export class RecibosValorizacionPanelComponent {
  private readonly _concepts = signal<ReadonlyArray<PayrollConceptModel>>([]);
  private readonly _steps = signal<ReadonlyArray<PayrollCalculationStepModel>>([]);

  @Input() set concepts(val: ReadonlyArray<PayrollConceptModel>) {
    this._concepts.set(val);
  }

  @Input() set steps(val: ReadonlyArray<PayrollCalculationStepModel>) {
    this._steps.set(val);
  }

  get steps(): ReadonlyArray<PayrollCalculationStepModel> {
    return this._steps();
  }

  @Input() loading = false;
  @Input() stepsLoading = false;
  @Input() stepsError = false;

  /**
   * Si los pasos de este recibo ya se han pedido y han vuelto.
   *
   * Sin esto, «todavía no los he pedido» y «los pedí y no hay ninguno» serían la misma lista
   * vacía, y la pestaña diría «se calculó antes de la V129» mientras la petición está en el aire.
   */
  @Input() stepsLoaded = false;

  @Input() payrollKey = '';

  @Output() close = new EventEmitter<void>();

  /** La primera vez que alguien abre «Cálculo». Quien sólo mira el recibo no pide los 35 pasos. */
  @Output() stepsRequested = new EventEmitter<void>();

  readonly view = signal<ValorizacionView>('recibo');
  readonly searchTerm = signal('');

  readonly filteredConcepts = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this._concepts();
    return this._concepts().filter(
      (c) =>
        c.conceptCode.toLowerCase().includes(term) || c.conceptLabel.toLowerCase().includes(term),
    );
  });

  readonly filteredSteps = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this._steps();
    return this._steps().filter(
      (s) =>
        s.conceptCode.toLowerCase().includes(term) ||
        s.conceptMnemonic.toLowerCase().includes(term),
    );
  });

  /** Vacío porque no hay, no porque no se haya preguntado ni porque el filtro los haya quitado. */
  readonly thisPayrollHasNoSteps = computed(() => this.stepsLoaded && this._steps().length === 0);

  readonly stepsOnPayslipCount = computed(
    () => this._steps().filter((s) => s.payslipOrderCode !== null).length,
  );

  readonly conceptCount = computed(() => this._concepts().length);

  readonly legendItems = [
    { nature: 'EARNING', label: 'Devengo' },
    { nature: 'DEDUCTION', label: 'Deducción' },
    { nature: 'BASE', label: 'Base' },
    { nature: 'TECHNICAL', label: 'Técnico' },
    { nature: 'INFORMATIONAL', label: 'Informativo' },
    { nature: 'NET_PAY', label: 'Totales/Liq.' },
  ];

  showRecibo(): void {
    this.view.set('recibo');
  }

  showCalculo(): void {
    this.view.set('calculo');
    this.stepsRequested.emit();
  }

  /**
   * El ámbito del paso, en palabras, y su segmento cuando lo tiene.
   *
   * Se lee de `executionScope` y no de que las fechas vengan nulas: el backend lo sirve como campo
   * propio justo para que aquí no se deduzca un hecho de la ausencia de otro.
   */
  scopeLabel(step: PayrollCalculationStepModel): string {
    if (step.executionScope === PERIOD_SCOPE) return 'Período';
    if (step.segmentStartDate === null || step.segmentEndDate === null) return 'Segmento';
    return `${shortDate(step.segmentStartDate)} – ${shortDate(step.segmentEndDate)}`;
  }

  /** El color de cada naturaleza vive en el .scss, no aqui. */
  natureClass(nature: string): string {
    return 'nature-' + (NATURES.has(nature) ? nature.toLowerCase() : 'unknown');
  }

  fmt(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  onClose(): void {
    this.close.emit();
  }
}

/** `2025-04-16` a `16/04`: en una celda de dos líneas el año sobra, y los dos son del período. */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}
