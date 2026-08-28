import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecibosStore } from '../store/recibos.store';
import { RecibosFolioComponent } from './recibos-folio.component';
import { RecibosValorizacionPanelComponent } from './recibos-valorizacion-panel.component';

const STATUS_LABELS: Record<string, string> = {
  CALCULATED: 'CALCULADA',
  NOT_VALID: 'INVÁLIDA',
  EXPLICIT_VALIDATED: 'VALIDADA',
  DEFINITIVE: 'DEFINITIVA',
};

@Component({
  selector: 'app-recibos-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RecibosFolioComponent, RecibosValorizacionPanelComponent],
  template: `
    @if (store.selectedPayroll(); as payroll) {
      <div class="action-bar">
        <div class="action-bar-info">
          <span class="payroll-key"
            >{{ payroll.employeeNumber }} · Período {{ payroll.payrollPeriodCode }}</span
          >
          <span class="status-badge" [class]="'badge-' + payroll.status.toLowerCase()">
            {{ statusLabel(payroll.status) }}
          </span>
        </div>
        <div class="action-bar-buttons">
          @if (payroll.status === 'CALCULATED') {
            <button
              class="btn btn-invalidar"
              [disabled]="store.transitioning()"
              (click)="invalidate()"
            >
              Invalidar
            </button>
            <button class="btn btn-validar" [disabled]="store.transitioning()" (click)="validate()">
              Validar
            </button>
          }
          @if (payroll.status === 'NOT_VALID') {
            <button
              class="btn btn-recalcular"
              [disabled]="store.transitioning()"
              (click)="recalculate()"
            >
              Recalcular
            </button>
          }
          @if (!store.conceptsLoading()) {
            <button class="btn btn-valorizacion" (click)="drawerOpen.set(true)">
              ⊞ Valorización
            </button>
          }
        </div>
      </div>

      @if (store.transitionError()) {
        <div class="transition-error">{{ store.transitionError() }}</div>
      }

      <div class="folio-wrapper">
        @if (store.conceptsLoading()) {
          <div class="loading-msg">Cargando conceptos...</div>
        } @else {
          <app-recibos-folio
            [concepts]="store.concepts()"
            [employeeNumber]="payroll.employeeNumber"
            [payrollPeriodCode]="payroll.payrollPeriodCode"
            [companyProfile]="store.companyProfile()"
            [employeeProfile]="store.employeeProfile()"
            [agreementProfile]="store.agreementProfile()"
            [presenceStartDate]="store.presenceStartDate()"
            [presenceEndDate]="store.presenceEndDate()"
            [workCenterCode]="store.workCenterCode()"
            [workCenterName]="store.workCenterName()"
          />
        }
      </div>

      @if (drawerOpen()) {
        <app-recibos-valorizacion-panel
          [concepts]="store.concepts()"
          [loading]="store.conceptsLoading()"
          [payrollKey]="payroll.employeeNumber + ' · Período ' + payroll.payrollPeriodCode"
          (close)="drawerOpen.set(false)"
        />
      }
    } @else {
      <div class="no-selection">Selecciona una nómina de la lista para ver el detalle.</div>
    }
  `,
  styleUrl: './recibos-detail.component.scss',
})
export class RecibosDetailComponent {
  protected readonly store = inject(RecibosStore);
  readonly drawerOpen = signal(false);

  constructor() {
    effect(() => {
      this.store.selectedKey();
      this.drawerOpen.set(false);
    });
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  invalidate(): void {
    const key = this.store.selectedKey();
    if (key) this.store.invalidate(key);
  }

  validate(): void {
    const key = this.store.selectedKey();
    if (key) this.store.validate(key);
  }

  recalculate(): void {
    const key = this.store.selectedKey();
    if (key) this.store.recalculate(key);
  }
}
