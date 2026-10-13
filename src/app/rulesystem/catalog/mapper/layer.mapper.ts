import { LayerResponse } from '../../../core/api/generated/model/layer-response';

import { LayerModel } from '../models/layer.model';

export function mapLayerResponseToModel(source: LayerResponse): LayerModel {
  return {
    code: source.code,
    name: source.name,
    level: source.level,
    mountedBy: [...source.mountedBy],
  };
}
