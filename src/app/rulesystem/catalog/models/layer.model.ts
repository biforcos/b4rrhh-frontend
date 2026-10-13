/**
 * Una capa (ADR-077): donde vive una entidad. No es una reglamentación y el Ámbito no la ofrece;
 * `mountedBy` son las reglamentaciones que la montan, las que ven lo que se cambie en ella
 * (frontend#131).
 */
export interface LayerModel {
  code: string;
  name: string;
  level: number;
  mountedBy: ReadonlyArray<string>;
}
