import { RuleEntityResponse } from '../../../core/api/generated/model/rule-entity-response';

import { NATIONAL_LEVEL } from '../models/catalog-level';
import { RuleEntityModel } from '../models/rule-entity.model';

/**
 * La etiqueta del servidor sólo si dice otra cosa que el nombre almacenado: Catálogos es
 * mantenimiento, enseña el nombre que se edita y, al lado, la traducción cuando la hay. Una
 * diferencia sólo de mayúsculas no cuenta: no es otra cosa que decir.
 */
export function translatedLabelOf(name: string, label: string | null | undefined): string | null {
  const translated = label?.trim() ?? '';
  const same = translated.localeCompare(name.trim(), 'es', { sensitivity: 'accent' }) === 0;
  return translated.length > 0 && !same ? translated : null;
}

export function mapRuleEntityResponseToModel(source: RuleEntityResponse): RuleEntityModel {
  const national = source.level === NATIONAL_LEVEL;
  return {
    occurrenceKey: `${source.code}|${source.startDate}`,
    ruleSystemCode: source.ruleSystemCode,
    layerCode: source.layerCode,
    level: source.level,
    definedIn: national ? null : source.layerCode,
    ruleEntityTypeCode: source.ruleEntityTypeCode,
    code: source.code,
    name: source.name,
    translatedLabel: translatedLabelOf(source.name, source.label),
    description: source.description ?? null,
    active: source.active,
    startDate: source.startDate,
    endDate: source.endDate ?? null,
    canCorrect: national,
    canClose: national && source.active,
    canDelete: national,
  };
}
