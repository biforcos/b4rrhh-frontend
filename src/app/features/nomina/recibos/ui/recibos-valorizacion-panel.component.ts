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

@Component({
  selector: 'app-recibos-valorizacion-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" (click)="onClose()"></div>

    <div class="drawer">
      <div class="drawer-header">
        <div>
          <div class="drawer-title">Valorización</div>
          <div class="drawer-subtitle">{{ payrollKey }}</div>
        </div>
        <button class="close-btn" (click)="onClose()">✕</button>
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
    </div>
  `,
  styleUrl: './recibos-valorizacion-panel.component.scss',
})
export class RecibosValorizacionPanelComponent {
  private readonly _concepts = signal<ReadonlyArray<PayrollConceptModel>>([]);

  @Input() set concepts(val: ReadonlyArray<PayrollConceptModel>) {
    this._concepts.set(val);
  }

  @Input() loading = false;
  @Input() payrollKey = '';

  @Output() close = new EventEmitter<void>();

  readonly searchTerm = signal('');

  readonly filteredConcepts = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this._concepts();
    return this._concepts().filter(
      (c) =>
        c.conceptCode.toLowerCase().includes(term) || c.conceptLabel.toLowerCase().includes(term),
    );
  });

  readonly legendItems = [
    { nature: 'EARNING', label: 'Devengo' },
    { nature: 'DEDUCTION', label: 'Deducción' },
    { nature: 'BASE', label: 'Base' },
    { nature: 'TECHNICAL', label: 'Técnico' },
    { nature: 'INFORMATIONAL', label: 'Informativo' },
    { nature: 'NET_PAY', label: 'Totales/Liq.' },
  ];

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
