export interface RuleEntityTypeModel {
  code: string;
  name: string;
  /**
   * La etiqueta en el idioma de la sesión cuando dice otra cosa que `name`, que es el nombre
   * almacenado y el que se edita (backend#152, frontend#123); `null` si coinciden.
   */
  translatedLabel: string | null;
  active: boolean;
}
