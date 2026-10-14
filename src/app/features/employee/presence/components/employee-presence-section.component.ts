import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of, take } from 'rxjs';

import { PresenceRectificationField } from '../../../../core/api/clients/employee-presence-rectification.client';
import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { UiCatalogLabelComponent } from '../../../../shared/ui/catalog-label/ui-catalog-label.component';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeePresenceModel } from '../../models/employee-presence.model';
import { EmployeePresenceDateCorrectionComponent } from './employee-presence-date-correction.component';

export interface PresencePeriodRow extends TemporalSectionRow {
  presenceNumber: number;
  companyCode: string;
  companyName: string | null;
  entryReasonCode: string;
  entryReasonName: string | null;
  exitReasonCode: string | null;
  exitReasonName: string | null;
}

type LabelMap = Readonly<Record<string, string>>;

/** Qué presencia y qué fecha se está corrigiendo. */
interface PresenceCorrection {
  presenceNumber: number;
  field: PresenceRectificationField;
  currentDate: string;
}

/**
 * La presencia: la sección que gobierna sobre las demás (ADR-047). Es `TEMPORAL_APPEND_CLOSE`
 * como el contrato o la jornada y se ve igual que ellas; la única diferencia es la marca de que
 * gobierna. No ofrece «nuevo periodo»: los abren y los cierran los flujos de alta, cese y
 * readmisión, no una fila.
 *
 * Lo que sí ofrece es rectificar sus fechas (`b4rrhh/frontend#135`): «Corregir fecha de alta» en la
 * vigente o prevista y «Corregir fecha de cese» en la que tiene cese. No es editar el período: mueve
 * con él lo que empezó o acabó ese mismo día, y el servidor dice qué antes de confirmar.
 */
@Component({
  selector: 'app-employee-presence-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TemporalSectionComponent,
    UiCatalogLabelComponent,
    EmployeePresenceDateCorrectionComponent,
  ],
  templateUrl: './employee-presence-section.component.html',
})
export class EmployeePresenceSectionComponent {
  readonly employeeKey = input<EmployeeBusinessKey | null>(null);

  private readonly presenceStore = inject(EmployeePresenceStore);
  private readonly fieldCatalogService = inject(EmployeeFieldCatalogService);
  private readonly companyLabels = signal<LabelMap>({});
  private readonly entryReasonLabels = signal<LabelMap>({});
  private readonly exitReasonLabels = signal<LabelMap>({});
  private catalogRequestId = 0;

  protected readonly texts = employeeTexts;

  /** La corrección abierta, si la hay. */
  protected readonly correction = signal<PresenceCorrection | null>(null);

  // Desde la contratación recién hecha se llega con `?corregir=alta` (b4rrhh/frontend#135): la ficha
  // abre la corrección sin que haya que buscarla. Opcionales porque la sección no siempre vive bajo
  // una ruta (los specs).
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly requestedCorrection = toSignal(this.route?.queryParamMap ?? of(null), {
    initialValue: null,
  });

  // Sin ordenar: el orden es el del gateway, que aplica la regla común (frontend#37). Aquí se
  // volvía a ordenar por inicio ascendente y la vigente salía abajo (frontend#105).
  protected readonly rows = computed<ReadonlyArray<PresencePeriodRow>>(() =>
    this.presenceStore.presences().map((p) => this.toRow(p)),
  );

  constructor() {
    effect(() => {
      this.loadCatalogLabels(this.employeeKey()?.ruleSystemCode ?? null);
    });

    effect(() => {
      if (this.requestedCorrection()?.get('corregir') !== 'alta') return;
      const index = this.rows().findIndex((row) =>
        row.actions?.some((action) => action.id === 'correct-start'),
      );
      if (index < 0) return;
      this.actionClicked({ index, actionId: 'correct-start' });
      // Se consume: un F5 o volver atrás no lo vuelve a abrir.
      void this.router?.navigate([], {
        relativeTo: this.route,
        queryParams: { corregir: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  protected actionClicked(event: { index: number; actionId: string }): void {
    const row = this.rows()[event.index];
    if (!row) return;
    const field: PresenceRectificationField =
      event.actionId === 'correct-end' ? 'END_DATE' : 'START_DATE';
    const currentDate = field === 'END_DATE' ? row.endDate : row.startDate;
    if (!currentDate) return;
    this.correction.set({ presenceNumber: row.presenceNumber, field, currentDate });
  }

  /**
   * El alta se corrige en la presencia que no ha acabado —la vigente o la prevista—; el cese, en la que
   * lo tiene. Las demás no ofrecen nada: el servidor se negaría igual si ya se pagó, pero no se invita.
   */
  private actionsFor(p: EmployeePresenceModel): PresencePeriodRow['actions'] {
    const actions = [];
    if (!p.endDate || p.endDate >= currentLocalDate()) {
      actions.push({
        id: 'correct-start',
        label: this.texts.presenceCorrectStartAction,
        ariaLabel: `${this.texts.presenceCorrectStartAction} del ${formatDisplayDate(p.startDate)}`,
      });
    }
    if (p.endDate) {
      actions.push({
        id: 'correct-end',
        label: this.texts.presenceCorrectEndAction,
        ariaLabel: `${this.texts.presenceCorrectEndAction} del ${formatDisplayDate(p.endDate)}`,
      });
    }
    return actions;
  }

  private toRow(p: EmployeePresenceModel): PresencePeriodRow {
    return {
      startDate: p.startDate,
      endDate: p.endDate,
      isActive: p.isActive,
      canEdit: false,
      canDelete: false,
      actions: this.actionsFor(p),
      presenceNumber: p.presenceNumber,
      companyCode: p.companyCode,
      companyName: p.companyName ?? this.companyLabels()[p.companyCode] ?? null,
      entryReasonCode: p.entryReasonCode,
      entryReasonName: p.entryReasonName ?? this.entryReasonLabels()[p.entryReasonCode] ?? null,
      exitReasonCode: p.exitReasonCode,
      exitReasonName:
        p.exitReasonName ??
        (p.exitReasonCode ? (this.exitReasonLabels()[p.exitReasonCode] ?? null) : null),
    };
  }

  private loadCatalogLabels(ruleSystemCode: string | null): void {
    const requestId = ++this.catalogRequestId;
    if (!ruleSystemCode) {
      this.companyLabels.set({});
      this.entryReasonLabels.set({});
      this.exitReasonLabels.set({});
      return;
    }
    this.loadInto(
      requestId,
      this.companyLabels,
      this.fieldCatalogService.loadPresenceCompanyOptions(ruleSystemCode),
    );
    this.loadInto(
      requestId,
      this.entryReasonLabels,
      this.fieldCatalogService.loadPresenceEntryReasonOptions(ruleSystemCode),
    );
    this.loadInto(
      requestId,
      this.exitReasonLabels,
      this.fieldCatalogService.loadPresenceExitReasonOptions(ruleSystemCode),
    );
  }

  private loadInto(
    requestId: number,
    target: { set(value: LabelMap): void },
    options$: Observable<ReadonlyArray<{ value: string; label: string }>>,
  ): void {
    options$.pipe(take(1)).subscribe({
      next: (options) => {
        if (requestId !== this.catalogRequestId) return;
        target.set(Object.fromEntries(options.map((o) => [o.value, o.label])));
      },
      error: () => undefined,
    });
  }
}
