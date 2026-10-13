import { CreateLayerRuleEntityRequestModel } from '../models/create-layer-rule-entity.request';
import { CreateRuleEntityRequestModel } from '../models/create-rule-entity.request';
import { CreateRuleEntityFormModel } from '../models/create-rule-entity-form.model';

export function mapCreateRuleEntityFormToRequest(
  form: CreateRuleEntityFormModel,
  ruleSystemCode: string,
  ruleEntityTypeCode: string,
): CreateRuleEntityRequestModel {
  return {
    ruleSystemCode: ruleSystemCode.trim(),
    ...mapCreateRuleEntityFormToLayerRequest(form, ruleEntityTypeCode),
  };
}

/** El mismo formulario dado de alta en una capa: la capa va en la ruta (frontend#131). */
export function mapCreateRuleEntityFormToLayerRequest(
  form: CreateRuleEntityFormModel,
  ruleEntityTypeCode: string,
): CreateLayerRuleEntityRequestModel {
  const normalizedDescription = form.description.trim();
  const normalizedEndDate = form.endDate.trim();

  return {
    ruleEntityTypeCode: ruleEntityTypeCode.trim(),
    code: form.code.trim(),
    name: form.name.trim(),
    description: normalizedDescription.length > 0 ? normalizedDescription : null,
    startDate: form.startDate,
    endDate: normalizedEndDate.length > 0 ? normalizedEndDate : null,
  };
}
