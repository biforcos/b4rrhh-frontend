import { Injectable, inject, isDevMode } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { CatalogsService } from '../../../core/api/generated/api/catalogs.service';
import {
  CatalogFieldBindingResponse,
  CatalogFieldBindingResponseCatalogKindEnum,
} from '../../../core/api/generated/model/catalog-field-binding-response';
import { DirectCatalogOptionResponse } from '../../../core/api/generated/model/direct-catalog-option-response';
import { SlotKeyOption } from '../../employee/shared/ui/section/editable-slot-section.model';
import { getCatalogDisplay } from '../../employee/shared/utils/catalog-display.util';
import { currentLocalDate, formatDisplayDate } from '../../../shared/utils/local-date.util';

const WORK_CENTER_CONTACT_RESOURCE_CODE = 'work_center.contact';
const CONTACT_TYPE_RULE_ENTITY_TYPE_CODE = 'CONTACT_TYPE';
const CONTACT_TYPE_FIELD_CODE = 'contactTypeCode';

@Injectable({
  providedIn: 'root',
})
export class WorkCenterFieldCatalogService {
  private readonly api = inject(CatalogsService);

  private readonly bindingsByResourceCache = new Map<
    string,
    Observable<ReadonlyArray<CatalogFieldBindingResponse>>
  >();
  private readonly optionsByDirectCatalogCache = new Map<
    string,
    Observable<ReadonlyArray<SlotKeyOption<string>>>
  >();

  loadContactTypeOptions(ruleSystemCode: string): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    const normalizedRuleSystemCode = this.normalizeRequiredValue(ruleSystemCode);
    if (!normalizedRuleSystemCode) {
      return throwError(
        () => new Error('Rule system code is required to load work center contact type options.'),
      );
    }

    return this.resolveContactTypeRuleEntityTypeCode().pipe(
      switchMap((ruleEntityTypeCode) =>
        this.getDirectOptions(normalizedRuleSystemCode, ruleEntityTypeCode),
      ),
    );
  }

  private resolveContactTypeRuleEntityTypeCode(): Observable<string> {
    return this.getBindingsByResource(WORK_CENTER_CONTACT_RESOURCE_CODE).pipe(
      map((bindings) => this.resolveBoundRuleEntityTypeCode(bindings)),
      catchError(() => {
        this.reportDevWarning(
          `Missing catalog binding for ${WORK_CENTER_CONTACT_RESOURCE_CODE}.${CONTACT_TYPE_FIELD_CODE}. Falling back to CONTACT_TYPE.`,
        );
        return of(CONTACT_TYPE_RULE_ENTITY_TYPE_CODE);
      }),
    );
  }

  private resolveBoundRuleEntityTypeCode(
    bindings: ReadonlyArray<CatalogFieldBindingResponse>,
  ): string {
    const binding = this.findDirectBinding(bindings, CONTACT_TYPE_FIELD_CODE);
    const ruleEntityTypeCode = binding?.ruleEntityTypeCode?.trim() ?? '';

    if (!ruleEntityTypeCode) {
      this.reportDevWarning(
        `No active DIRECT binding found for ${WORK_CENTER_CONTACT_RESOURCE_CODE}.${CONTACT_TYPE_FIELD_CODE}. Falling back to CONTACT_TYPE.`,
      );
      return CONTACT_TYPE_RULE_ENTITY_TYPE_CODE;
    }

    if (ruleEntityTypeCode !== CONTACT_TYPE_RULE_ENTITY_TYPE_CODE) {
      this.reportDevWarning(
        `Unexpected ruleEntityTypeCode ${ruleEntityTypeCode} for ${WORK_CENTER_CONTACT_RESOURCE_CODE}.${CONTACT_TYPE_FIELD_CODE}. Using CONTACT_TYPE instead.`,
      );
    }

    return CONTACT_TYPE_RULE_ENTITY_TYPE_CODE;
  }

  private getBindingsByResource(
    resourceCode: string,
  ): Observable<ReadonlyArray<CatalogFieldBindingResponse>> {
    const normalizedResourceCode = this.normalizeRequiredValue(resourceCode);
    const cached = this.bindingsByResourceCache.get(normalizedResourceCode);
    if (cached) {
      return cached;
    }

    const request = this.api
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
  ): Observable<ReadonlyArray<SlotKeyOption<string>>> {
    const normalizedRuleEntityTypeCode = this.normalizeRequiredValue(ruleEntityTypeCode);
    if (!normalizedRuleEntityTypeCode) {
      return of([]);
    }

    const cacheKey = `${ruleSystemCode}|${normalizedRuleEntityTypeCode}`;
    const cached = this.optionsByDirectCatalogCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const request = this.api
      .getDirectCatalogOptions({ ruleSystemCode, ruleEntityTypeCode: normalizedRuleEntityTypeCode })
      .pipe(
        map((response) => response.items ?? []),
        map((items) => this.mapOptions(items)),
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
   * Ya no se filtra por `active` (b4rrhh/backend#32): lo dado de baja el backend no lo
   * devuelve nunca, y `active` es ahora la marca de vigencia a la fecha —aquí, hoy—. Las
   * vigentes primero y las demás debajo, marcadas y con su período.
   */
  private mapOptions(
    items: ReadonlyArray<DirectCatalogOptionResponse>,
  ): ReadonlyArray<SlotKeyOption<string>> {
    const today = currentLocalDate();

    return items
      .map((item) => {
        const display = getCatalogDisplay(item.name, item.code);
        const effective = item.active === true;

        return {
          value: item.code,
          label: display.code ? `${display.label} · ${display.code}` : display.label,
          effective,
          note: effective ? null : this.describeValidity(item, today),
        };
      })
      .sort((left, right) => {
        if (left.effective !== right.effective) {
          return left.effective ? -1 : 1;
        }
        return left.label.localeCompare(right.label);
      });
  }

  private describeValidity(item: DirectCatalogOptionResponse, reference: string): string | null {
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

    console.warn(`[WorkCenterFieldCatalogService] ${message}`);
  }
}
