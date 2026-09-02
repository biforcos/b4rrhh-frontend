import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Observable, take } from 'rxjs';

import { TemporalSectionRow } from '../../../../shared/ui/temporal-section/temporal-section-row.model';
import { TemporalSectionComponent } from '../../../../shared/ui/temporal-section/temporal-section.component';
import { UiCatalogLabelComponent } from '../../../../shared/ui/catalog-label/ui-catalog-label.component';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeePresenceModel } from '../../models/employee-presence.model';

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

/**
 * La presencia: la sección que gobierna sobre las demás (ADR-047). Es `TEMPORAL_APPEND_CLOSE`
 * como el contrato o la jornada y se ve igual que ellas; la única diferencia es la marca de que
 * gobierna. No ofrece «nuevo periodo»: los abren y los cierran los flujos de alta, cese y
 * readmisión, no una fila.
 */
@Component({
  selector: 'app-employee-presence-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TemporalSectionComponent, UiCatalogLabelComponent],
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

  protected readonly rows = computed<ReadonlyArray<PresencePeriodRow>>(() =>
    [...this.presenceStore.presences()]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((p) => this.toRow(p)),
  );

  constructor() {
    effect(() => {
      this.loadCatalogLabels(this.employeeKey()?.ruleSystemCode ?? null);
    });
  }

  private toRow(p: EmployeePresenceModel): PresencePeriodRow {
    return {
      startDate: p.startDate,
      endDate: p.endDate,
      isActive: p.isActive,
      canEdit: false,
      canDelete: false,
      presenceNumber: p.presenceNumber,
      companyCode: p.companyCode,
      companyName: p.companyName ?? this.companyLabels()[p.companyCode] ?? null,
      entryReasonCode: p.entryReasonCode,
      entryReasonName: p.entryReasonName ?? this.entryReasonLabels()[p.entryReasonCode] ?? null,
      exitReasonCode: p.exitReasonCode,
      exitReasonName:
        p.exitReasonName ?? (p.exitReasonCode ? (this.exitReasonLabels()[p.exitReasonCode] ?? null) : null),
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
    this.loadInto(requestId, this.companyLabels, this.fieldCatalogService.loadPresenceCompanyOptions(ruleSystemCode));
    this.loadInto(requestId, this.entryReasonLabels, this.fieldCatalogService.loadPresenceEntryReasonOptions(ruleSystemCode));
    this.loadInto(requestId, this.exitReasonLabels, this.fieldCatalogService.loadPresenceExitReasonOptions(ruleSystemCode));
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
