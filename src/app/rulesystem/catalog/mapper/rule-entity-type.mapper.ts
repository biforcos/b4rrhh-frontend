import { RuleEntityTypeResponse } from '../../../core/api/generated/model/rule-entity-type-response';

import { RuleEntityTypeModel } from '../models/rule-entity-type.model';

export function mapRuleEntityTypeResponseToModel(
  source: RuleEntityTypeResponse,
): RuleEntityTypeModel {
  return {
    code: source.code,
    name: source.name,
    active: source.active,
  };
}
