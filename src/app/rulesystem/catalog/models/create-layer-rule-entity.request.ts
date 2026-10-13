/** El alta en una capa: la capa la dice la ruta, no el cuerpo (frontend#131). */
export interface CreateLayerRuleEntityRequestModel {
  ruleEntityTypeCode: string;
  code: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
}
