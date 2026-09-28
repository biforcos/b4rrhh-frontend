import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { formatValor } from '../format/recibos.format';
import { ArrearExplanationModel } from '../models/arrear-explanation.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';

/**
 * «De dónde sale esta línea», a un clic desde el folio (`b4rrhh/frontend#93`).
 *
 * <p>Dos formas, porque hay dos clases de línea:
 *
 * <ul>
 *   <li><b>Una línea de atraso</b> no viene de ningún paso de este cálculo, así que no se explica
 *       con el grafo sino con tres números (`backend#134`): lo que su mes vale hoy, lo que ya se
 *       pagó por él —y en qué recibos—, y la diferencia, que es la línea. Si no cuadran, se dice:
 *       tres números que no suman escondidos son peor que un aviso.</li>
 *   <li><b>Una línea normal</b> se explica con cantidad por tarifa, cuando las tiene, y a un clic sus
 *       pasos en la valorización.</li>
 * </ul>
 */
@Component({
  selector: 'app-recibos-linea-explicada',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="linea-explicada" aria-live="polite">
      <header class="linea-explicada__cabecera">
        <p class="linea-explicada__titulo">
          De dónde sale · <strong>{{ concept().conceptCode }} {{ concept().conceptLabel }}</strong>
          @if (esAtraso()) {
            <span class="linea-explicada__origen">de {{ mes(concept().originPeriodCode!) }}</span>
          }
        </p>
        <button
          type="button"
          class="linea-explicada__cerrar"
          aria-label="Cerrar la explicación"
          (click)="closed.emit()"
        >
          ×
        </button>
      </header>

      @if (esAtraso()) {
        @if (arrear(); as a) {
          <ol class="linea-explicada__cuenta">
            <li>
              Hoy vale <strong>{{ num(a.currentValue) }}</strong
              >: lo que {{ mes(a.originPeriodCode) }} da calculado ahora.
            </li>
            <li>
              Ya se pagó <strong>{{ num(a.alreadyPaid) }}</strong>
              @if (a.paidIn.length > 0) {
                ({{ desglose(a) }}).
              } @else {
                (ningún recibo había pagado nada por ese mes).
              }
            </li>
            <li class="linea-explicada__resultado">
              {{ num(a.currentValue) }} − {{ num(a.alreadyPaid) }} =
              <strong>{{ num(a.difference) }}</strong
              >, que es esta línea.
            </li>
          </ol>
          @if (!a.addsUp) {
            <p class="linea-explicada__aviso">
              La diferencia no cuadra con la línea ({{ num(a.lineAmount) }}): esta línea se pagó en
              un cálculo anterior y desde entonces el mes se ha vuelto a calcular.
            </p>
          }
        } @else {
          <p class="linea-explicada__nota">Cargando de dónde sale…</p>
        }
      } @else {
        @if (multiplicacion(); as m) {
          <p class="linea-explicada__cuenta-simple">
            {{ m.cantidad }} × {{ m.tarifa }} = <strong>{{ m.importe }}</strong>
          </p>
        } @else {
          <p class="linea-explicada__cuenta-simple">
            Importe: <strong>{{ importe() }}</strong
            >. No lleva cantidad ni tarifa: sale de otros conceptos, y sus pasos lo dicen.
          </p>
        }
        <button type="button" class="linea-explicada__pasos" (click)="stepsRequested.emit()">
          Ver sus pasos en la valorización
        </button>
      }
    </section>
  `,
  styleUrl: './recibos-linea-explicada.component.scss',
})
export class RecibosLineaExplicadaComponent {
  readonly concept = input.required<PayrollConceptModel>();
  readonly payrollPeriodCode = input.required<string>();
  /** La explicación de esta línea si es de atraso; `null` mientras no ha llegado. */
  readonly arrear = input<ArrearExplanationModel | null>(null);

  readonly stepsRequested = output<void>();
  readonly closed = output<void>();

  protected readonly esAtraso = computed(() => {
    const origin = this.concept().originPeriodCode;
    return origin !== null && origin !== this.payrollPeriodCode();
  });

  protected readonly multiplicacion = computed(() => {
    const c = this.concept();
    if (c.quantity == null || c.rate == null || c.amount == null) return null;
    return {
      cantidad: formatValor(c.quantity),
      tarifa: formatValor(c.rate),
      importe: formatValor(c.amount),
    };
  });

  protected readonly importe = computed(() => {
    const amount = this.concept().amount;
    return amount == null ? '—' : formatValor(amount);
  });

  protected num(value: number): string {
    return formatValor(value);
  }

  /** `202607` como `07/2026`, como se lee en el recibo. */
  protected mes(period: string): string {
    return period.length === 6 ? `${period.slice(4)}/${period.slice(0, 4)}` : period;
  }

  protected desglose(a: ArrearExplanationModel): string {
    return a.paidIn
      .map((p) => `en el recibo de ${this.mes(p.payrollPeriodCode)}: ${formatValor(p.amount)}`)
      .join('; ');
  }
}
