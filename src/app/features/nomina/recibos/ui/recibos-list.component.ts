import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecibosStore } from '../store/recibos.store';
import { RecibosFilters } from '../models/recibos-filters.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';

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
  imports: [CommonModule, FormsModule],
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
          <div class="payroll-row" [class.selected]="isSelected(payroll)" (click)="select(payroll)">
            <div class="row-top">
              <span class="employee-number" [class.bold]="isSelected(payroll)">{{
                payroll.employeeNumber
              }}</span>
              <span class="status-badge" [class]="'badge-' + payroll.status.toLowerCase()">{{
                statusLabel(payroll.status)
              }}</span>
            </div>
            <div class="row-sub">
              {{ payroll.payrollPeriodCode }} · {{ payroll.payrollTypeCode }}
            </div>
          </div>
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

  select(payroll: PayrollSummaryModel): void {
    this.store.selectPayroll(payroll);
  }

  isSelected(payroll: PayrollSummaryModel): boolean {
    const key = this.store.selectedKey();
    return (
      key?.ruleSystemCode === payroll.ruleSystemCode &&
      key?.employeeTypeCode === payroll.employeeTypeCode &&
      key?.employeeNumber === payroll.employeeNumber &&
      key?.payrollPeriodCode === payroll.payrollPeriodCode &&
      key?.payrollTypeCode === payroll.payrollTypeCode &&
      key?.presenceNumber === payroll.presenceNumber
    );
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  trackPayroll(payroll: PayrollSummaryModel): string {
    return `${payroll.ruleSystemCode}-${payroll.employeeTypeCode}-${payroll.employeeNumber}-${payroll.payrollPeriodCode}-${payroll.payrollTypeCode}-${payroll.presenceNumber}`;
  }
}
