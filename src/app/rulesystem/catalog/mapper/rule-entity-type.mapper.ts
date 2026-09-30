import { RuleEntityTypeResponse } from '../../../core/api/generated/model/rule-entity-type-response';

import { RuleEntityTypeModel } from '../models/rule-entity-type.model';
import { translatedLabelOf } from './rule-entity.mapper';

export function mapRuleEntityTypeResponseToModel(
  source: RuleEntityTypeResponse,
): RuleEntityTypeModel {
  return {
    code: source.code,
    name: source.name,
    translatedLabel: translatedLabelOf(source.name, source.label),
    active: source.active,
  };
}
