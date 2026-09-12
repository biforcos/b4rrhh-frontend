import { Injectable, inject, isDevMode } from '@angular/core';
import { Observable, map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { CatalogsService } from '../../../core/api/generated/api/catalogs.service';
import {
  CatalogFieldBindingResponse,
  CatalogFieldBindingResponseCatalogKindEnum,
} from '../../../core/api/generated/model/catalog-field-binding-response';
import { DirectCatalogOptionResponse } from '../../../core/api/generated/model/direct-catalog-option-response';
import { SlotKeyOption } from '../shared/ui/section/editable-slot-section.model';
import { getCatalogDisplay } from '../shared/utils/catalog-display.util';
import { currentLocalDate, formatDisplayDate } from '../../../shared/utils/local-date.util';

const employeeCatalogFields = {
  contactType: { resourceCode: 'employee.contact', fieldCode: 'contactTypeCode' },
  identifierType: { resourceCode: 'employee.identifier', fieldCode: 'identifierTypeCode' },
  addressType: { resourceCode: 'employee.address', fieldCode: 'addressTypeCode' },
  workCenter: { resourceCode: 'employee.work_center', fieldCode: 'workCenterCode' },
  contractType: { resourceCode: 'employee.contract', fieldCode: 'contractTypeCode' },
  laborClassificationAgreement: {
    resourceCode: 'employee.labor_classification',
    fieldCode: 'agreementCode',
  },
  presenceCompany: { resourceCode: 'employee.presence', fieldCode: 'companyCode' },
  presenceEntryReason: { resourceCode: 'employee.presence', fieldCode: 'entryReasonCode' },
  presenceExitReason: { resourceCode: 'employee.presence', fieldCode: 'exitReasonCode' },
  costCenter: { resourceCode: 'employee.cost_center', fieldCode: 'costCenterCode' },
} as const;

type CatalogFieldSpec = (typeof employeeCatalogFields)[keyof typeof employeeCatalogFields];

@Injectable({
  providedIn: 'root',
})
export class EmployeeFieldCatalogService {
  private readonly catalogsApi = inject(CatalogsService);

  private readonly bindingsByResourceCache = new Map<
    string,
    Observable<ReadonlyArray<CatalogFieldBindingResponse>>
  >();
  private readonly optionsByDirectCatalogCache = new Map<
    string,
    Observable<ReadonlyArray<SlotKeyOption<string>>>
  >();

  loadContactTypeOptions(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    return this.loadDirectOptionsByField(
      ruleSystemCode,
      employeeCatalogFields.contactType,
      referenceDate,
    );
  }

  loadIdentifierTypeOptions(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    return this.loadDirectOptionsByField(
      ruleSystemCode,
      employeeCatalogFields.identifierType,
      referenceDate,
    );
  }

  loadAddressTypeOptions(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    return this.loadDirectOptionsByField(
      ruleSystemCode,
      employeeCatalogFields.addressType,
      referenceDate,
    );
  }

  loadWorkCenterOptions(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    return this.loadDirectOptionsByField(
      ruleSystemCode,
      employeeCatalogFields.workCenter,
      referenceDate,
    );
  }

  loadWorkCenterOptionsByCompany(
    ruleSystemCode: string,
    companyCode: string,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    const normalizedRuleSystemCode = this.normalizeRequiredValue(ruleSystemCode);
    const normalizedCompanyCode = this.normalizeRequiredValue(companyCode);

    if (!normalizedRuleSystemCode || !normalizedCompanyCode) {
      return of([]);
    }

    const cacheKey = `work-centers-by-company|${normalizedRuleSystemCode}|${normalizedCompanyCode}`;
    const cached = this.optionsByDirectCatalogCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const request = this.catalogsApi
      .getWorkCentersByCompany({
        ruleSystemCode: normalizedRuleSystemCode,
        companyCode: normalizedCompanyCode,
      })
      .pipe(
        map((response) => response.items ?? []),
        map((items) =>
          items
            .map((item) => {
              const display = getCatalogDisplay(item.name, item.code);
              const label = display.code ? `${display.label} · ${display.code}` : display.label;

              return {
                value: item.code,
                label,
              };
            })
            .sort((left, right) => left.label.localeCompare(right.label)),
        ),
        shareReplay(1),
      );

    this.optionsByDirectCatalogCache.set(cacheKey, request);
    return request;
  }

  loadContractTypeOptions(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    return this.loadDirectOptionsByField(
      ruleSystemCode,
      employeeCatalogFields.contractType,
      referenceDate,
    );
  }

  loadLaborClassificationAgreementOptions(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    return this.loadDirectOptionsByField(
      ruleSystemCode,
      employeeCatalogFields.laborClassificationAgreement,
      referenceDate,
    );
  }

  loadPresenceCompanyOptions(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    return this.loadDirectOptionsByField(
      ruleSystemCode,
      employeeCatalogFields.presenceCompany,
      referenceDate,
    );
  }

  loadPresenceEntryReasonOptions(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    return this.loadDirectOptionsByField(
      ruleSystemCode,
      employeeCatalogFields.presenceEntryReason,
      referenceDate,
    );
  }

  loadPresenceExitReasonOptions(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    return this.loadDirectOptionsByField(
      ruleSystemCode,
      employeeCatalogFields.presenceExitReason,
      referenceDate,
    );
  }

  loadCostCenterOptions(
    ruleSystemCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    return this.loadDirectOptionsByField(
      ruleSystemCode,
      employeeCatalogFields.costCenter,
      referenceDate,
    );
  }

  private loadDirectOptionsByField(
    ruleSystemCode: string,
    fieldSpec: CatalogFieldSpec,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    const normalizedRuleSystemCode = this.normalizeRequiredValue(ruleSystemCode);
    if (!normalizedRuleSystemCode) {
      return throwError(
        () => new Error('Rule system code is required to load direct catalog options.'),
      );
    }

    return this.getBindingsByResource(fieldSpec.resourceCode).pipe(
      map((bindings) => this.findDirectBinding(bindings, fieldSpec.fieldCode)),
      switchMap((binding) => {
        if (!binding?.ruleEntityTypeCode) {
          const message = `Missing active DIRECT binding for ${fieldSpec.resourceCode}.${fieldSpec.fieldCode}.`;
          this.reportDevWarning(message);
          return throwError(() => new Error(message));
        }

        return this.getDirectOptions(
          normalizedRuleSystemCode,
          binding.ruleEntityTypeCode,
          referenceDate,
        );
      }),
    );
  }

  private getBindingsByResource(
    resourceCode: string,
  ): Observable<ReadonlyArray<CatalogFieldBindingResponse>> {
    const normalizedResourceCode = this.normalizeRequiredValue(resourceCode);
    const cached = this.bindingsByResourceCache.get(normalizedResourceCode);
    if (cached) {
      return cached;
    }

    const request = this.catalogsApi
      .getCatalogBindingsByResourceCode({ resourceCode: normalizedResourceCode })
      .pipe(
        map((response) => response.fields ?? []),
        shareReplay(1),
      );

    this.bindingsByResourceCache.set(normalizedResourceCode, request);
    return request;
  }

  private getDirectOptions(
    ruleSystemCode: string,
    ruleEntityTypeCode: string,
    referenceDate?: string | null,
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    const normalizedRuleEntityTypeCode = this.normalizeRequiredValue(ruleEntityTypeCode);
    if (!normalizedRuleEntityTypeCode) {
      return of([]);
    }

    // La fecha entra en la clave: dos períodos distintos ven el mismo catálogo con marcas
    // distintas, y una sola entrada de caché los mezclaría.
    const normalizedReferenceDate = referenceDate?.trim() || null;
    const cacheKey = `${ruleSystemCode}|${normalizedRuleEntityTypeCode}|${normalizedReferenceDate ?? 'hoy'}`;
    const cached = this.optionsByDirectCatalogCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const request = this.catalogsApi
      .getDirectCatalogOptions({
        ruleSystemCode,
        ruleEntityTypeCode: normalizedRuleEntityTypeCode,
        referenceDate: normalizedReferenceDate ?? undefined,
      })
      .pipe(
        map((response) => response.items ?? []),
        map((items) => this.mapOptions(items, normalizedReferenceDate)),
        shareReplay(1),
      );

    this.optionsByDirectCatalogCache.set(cacheKey, request);
    return request;
  }

  private findDirectBinding(
    bindings: ReadonlyArray<CatalogFieldBindingResponse>,
    fieldCode: string,
  ): CatalogFieldBindingResponse | null {
    const normalizedFieldCode = this.normalizeRequiredValue(fieldCode);

    return (
      bindings.find(
        (binding) =>
          binding.active === true &&
          binding.fieldCode.trim() === normalizedFieldCode &&
          binding.catalogKind === CatalogFieldBindingResponseCatalogKindEnum.Direct,
      ) ?? null
    );
  }

  /**
   * Las opciones, con su vigencia a la fecha pedida (b4rrhh/backend#32).
   *
   * Ya no se filtra por `active`: el backend devuelve el catálogo entero y `active` es
   * ahora la **marca** de vigencia a esa fecha, no una lista de las que se pueden elegir.
   * Filtrarlas aquí sería volver a esconder lo que el backend acaba de dejar de esconder.
   *
   * Las vigentes van primero y las demás debajo, cada una con su período, que es lo que el
   * desplegable necesita para agruparlas.
   */
  private mapOptions(
    items: ReadonlyArray<DirectCatalogOptionResponse>,
    referenceDate: string | null,
  ): ReadonlyArray<SlotKeyOption<string>> {
    return items
      .map((item) => {
        const display = getCatalogDisplay(item.name, item.code);
        const label = display.code ? `${display.label} · ${display.code}` : display.label;
        const effective = item.active === true;

        return {
          value: item.code,
          label,
          effective,
          note: effective ? null : this.describeValidity(item, referenceDate),
        };
      })
      .sort((left, right) => {
        if (left.effective !== right.effective) {
          return left.effective ? -1 : 1;
        }
        return left.label.localeCompare(right.label);
      });
  }

  /**
   * Por qué una opción no está vigente: «cerrado el 31/12/2020», «empieza el 01/01/2030».
   *
   * Cuál de las dos depende de la fecha, no de qué campo venga: un código con inicio y fin
   * puede no estar vigente por cualquiera de los dos lados. Sin fecha pedida, hoy.
   */
  private describeValidity(
    item: DirectCatalogOptionResponse,
    referenceDate: string | null,
  ): string | null {
    const reference = referenceDate ?? currentLocalDate();

    if (item.endDate && item.endDate < reference) {
      return `cerrado el ${formatDisplayDate(item.endDate)}`;
    }
    if (item.startDate && item.startDate > reference) {
      return `empieza el ${formatDisplayDate(item.startDate)}`;
    }
    return null;
  }

  private normalizeRequiredValue(value: string): string {
    return value.trim();
  }

  private reportDevWarning(message: string): void {
    if (!isDevMode()) {
      return;
    }

    console.warn(`[EmployeeFieldCatalogService] ${message}`);
  }
}
