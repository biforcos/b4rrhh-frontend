import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { RecibosStore } from '../store/recibos.store';
import { readPayrollBusinessKeyFromParamMap } from '../routing/payroll-route-key.util';
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
            [seniorityDate]="store.seniorityDate()"
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
    } @else if (store.conceptsLoading()) {
      <div class="no-selection">Cargando el recibo…</div>
    } @else if (store.conceptsError() === 'not-found') {
      <div class="no-selection">
        <p class="no-selection-title">No hay ningún recibo en esta dirección.</p>
        <p>{{ addressLabel() }}</p>
      </div>
    } @else if (store.conceptsError()) {
      <div class="no-selection">No se ha podido cargar el recibo. Inténtalo de nuevo.</div>
    } @else if (badAddress()) {
      <div class="no-selection">
        <p class="no-selection-title">Esta dirección no es la de ningún recibo.</p>
        <p>
          El tipo de nómina tiene que ser <code>NORMAL</code> o <code>EXTRA</code>, y el número de
          presencia un entero positivo.
        </p>
      </div>
    } @else {
      <div class="no-selection">Selecciona una nómina de la lista para ver el detalle.</div>
    }
  `,
  styleUrl: './recibos-detail.component.scss',
})
export class RecibosDetailComponent {
  protected readonly store = inject(RecibosStore);
  private readonly route = inject(ActivatedRoute);

  readonly drawerOpen = signal(false);
  /** La URL nombra un recibo imposible: el tipo o el número de presencia no valen. */
  protected readonly badAddress = signal(false);
  protected readonly addressLabel = signal('');

  constructor() {
    effect(() => {
      this.store.selectedKey();
      this.drawerOpen.set(false);
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((paramMap) => {
      if (paramMap.keys.length === 0) {
        this.badAddress.set(false);
        this.addressLabel.set('');
        this.store.clearSelection();
        return;
      }

      const key = readPayrollBusinessKeyFromParamMap(paramMap);
      if (!key) {
        this.badAddress.set(true);
        this.addressLabel.set('');
        this.store.clearSelection();
        return;
      }

      this.badAddress.set(false);
      this.addressLabel.set(
        `${key.employeeNumber} · ${key.payrollPeriodCode} · ${key.payrollTypeCode} · presencia ${key.presenceNumber}`,
      );
      this.store.selectPayroll(key);
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
