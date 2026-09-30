export interface RuleEntityModel {
  occurrenceKey: string;
  ruleSystemCode: string;
  ruleEntityTypeCode: string;
  code: string;
  name: string;
  /**
   * La etiqueta en el idioma de la sesión cuando dice otra cosa que `name`, que es el nombre
   * almacenado y el que se edita (backend#152, frontend#123); `null` si coinciden.
   */
  translatedLabel: string | null;
  description: string | null;
  active: boolean;
  startDate: string;
  endDate: string | null;
  canCorrect: boolean;
  canClose: boolean;
  canDelete: boolean;
}
