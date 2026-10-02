export interface RuleEntityModel {
  occurrenceKey: string;
  ruleSystemCode: string;
  /** La capa en la que vive y su nivel, del contrato (backend#157); nada se deduce aquí. */
  layerCode: string;
  level: number;
  /**
   * La capa de la que viene cuando no es la nacional, que es la única que se edita desde una
   * reglamentación (frontend#127); `null` si es nacional.
   */
  definedIn: string | null;
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
