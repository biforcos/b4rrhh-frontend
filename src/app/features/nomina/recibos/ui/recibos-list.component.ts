import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecibosStore } from '../store/recibos.store';
import { RecibosFilters } from '../models/recibos-filters.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import {
  arePayrollBusinessKeysEqual,
  buildPayrollDetailRouteCommands,
} from '../routing/payroll-route-key.util';

const STATUS_LABELS: Record<string, string> = {
  CALCULATED: 'CALCULADA',
  NOT_VALID: 'INVÁLIDA',
  EXPLICIT_VALIDATED: 'VALIDADA',
  DEFINITIVE: 'DEFINITIVA',
};

@Component({
  selector: 'app-recibos-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="list-panel">
      <div class="filters">
        <div class="filter-row">
          <div class="filter-field">
            <label>PERÍODO</label>
            <input
              [ngModel]="filters().payrollPeriodCode"
              (ngModelChange)="patchFilter('payrollPeriodCode', $event)"
              placeholder="202604"
            />
          </div>
          <div class="filter-field">
            <label>ESTADO</label>
            <select [ngModel]="filters().status" (ngModelChange)="patchFilter('status', $event)">
              <option value="">Todos</option>
              <option value="CALCULATED">CALCULADA</option>
              <option value="NOT_VALID">INVÁLIDA</option>
              <option value="EXPLICIT_VALIDATED">VALIDADA</option>
              <option value="DEFINITIVE">DEFINITIVA</option>
            </select>
          </div>
        </div>
        <div class="filter-field">
          <label>EMPLEADO</label>
          <input
            [ngModel]="filters().employeeNumber"
            (ngModelChange)="patchFilter('employeeNumber', $event)"
            placeholder="Número o nombre..."
          />
        </div>
        <button class="search-btn" (click)="search()">Buscar</button>
      </div>

      <div class="results">
        @for (payroll of store.payrolls(); track trackPayroll(payroll)) {
          <!--
            Enlace y no click: un recibo tiene dirección propia (frontend#64), y una fila que
            navega por código no se puede abrir en otra pestaña ni copiar.
          -->
          <a
            class="payroll-row"
            [class.selected]="isSelected(payroll)"
            [routerLink]="routeCommands(payroll)"
          >
            <div class="row-top">
              <span class="employee-number" [class.bold]="isSelected(payroll)">{{
                payroll.employeeNumber
              }}</span>
              <span class="status-badge" [class]="'badge-' + payroll.status.toLowerCase()">{{
                statusLabel(payroll.status)
              }}</span>
            </div>
            <div class="row-sub">
              {{ payroll.payrollPeriodCode }} · {{ payroll.payrollTypeCode }} · presencia
              {{ payroll.presenceNumber }}
            </div>
          </a>
        }
        @if (store.listLoading()) {
          <div class="list-msg">Buscando...</div>
        }
        @if (store.listError()) {
          <div class="list-msg error">Error al cargar las nóminas.</div>
        }
      </div>

      <div class="list-footer">{{ store.payrolls().length }} nóminas encontradas</div>
    </div>
  `,
  styleUrl: './recibos-list.component.scss',
})
export class RecibosListComponent {
  protected readonly store = inject(RecibosStore);
  protected readonly filters = signal<RecibosFilters>({
    payrollPeriodCode: '',
    employeeNumber: '',
    status: '',
  });

  patchFilter<K extends keyof RecibosFilters>(key: K, value: RecibosFilters[K]): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
  }

  search(): void {
    this.store.search(this.filters());
  }

  routeCommands(payroll: PayrollSummaryModel): ReadonlyArray<string | number> {
    return buildPayrollDetailRouteCommands(payroll);
  }

  isSelected(payroll: PayrollSummaryModel): boolean {
    return arePayrollBusinessKeysEqual(this.store.selectedKey(), payroll);
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  trackPayroll(payroll: PayrollSummaryModel): string {
    return `${payroll.ruleSystemCode}-${payroll.employeeTypeCode}-${payroll.employeeNumber}-${payroll.payrollPeriodCode}-${payroll.payrollTypeCode}-${payroll.presenceNumber}`;
  }
}
