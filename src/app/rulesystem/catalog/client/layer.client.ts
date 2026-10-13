import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { LayersService } from '../../../core/api/generated/api/layers.service';
import { CloseRuleEntityRequest } from '../../../core/api/generated/model/close-rule-entity-request';
import { CorrectRuleEntityRequest } from '../../../core/api/generated/model/correct-rule-entity-request';
import { CreateLayerRuleEntityRequest } from '../../../core/api/generated/model/create-layer-rule-entity-request';
import { LayerResponse } from '../../../core/api/generated/model/layer-response';
import { LayerRuleEntityResponse } from '../../../core/api/generated/model/layer-rule-entity-response';

/** La clave de una ocurrencia vista desde su capa, no desde una reglamentación (frontend#131). */
export interface LayerRuleEntityOccurrenceKey {
  layerCode: string;
  ruleEntityTypeCode: string;
  code: string;
  startDate: string;
}

@Injectable({
  providedIn: 'root',
})
export class LayerClient {
  private readonly api = inject(LayersService);

  listLayers(): Observable<ReadonlyArray<LayerResponse>> {
    return this.api.listLayers();
  }

  listLayerRuleEntities(
    layerCode: string,
    ruleEntityTypeCode: string,
  ): Observable<ReadonlyArray<LayerRuleEntityResponse>> {
    return this.api.listLayerRuleEntities({
      layerCode: layerCode.trim(),
      ruleEntityTypeCode: ruleEntityTypeCode.trim(),
    });
  }

  createLayerRuleEntity(
    layerCode: string,
    payload: CreateLayerRuleEntityRequest,
  ): Observable<LayerRuleEntityResponse> {
    return this.api.createLayerRuleEntity({
      layerCode: layerCode.trim(),
      createLayerRuleEntityRequest: payload,
    });
  }

  correctLayerRuleEntity(
    key: LayerRuleEntityOccurrenceKey,
    payload: CorrectRuleEntityRequest,
  ): Observable<LayerRuleEntityResponse> {
    return this.api.correctLayerRuleEntity({
      ...trimmed(key),
      correctRuleEntityRequest: payload,
    });
  }

  closeLayerRuleEntity(
    key: LayerRuleEntityOccurrenceKey,
    payload: CloseRuleEntityRequest,
  ): Observable<LayerRuleEntityResponse> {
    return this.api.closeLayerRuleEntity({
      ...trimmed(key),
      closeRuleEntityRequest: payload,
    });
  }

  deleteLayerRuleEntity(key: LayerRuleEntityOccurrenceKey): Observable<void> {
    return this.api.deleteLayerRuleEntity(trimmed(key));
  }
}

function trimmed(key: LayerRuleEntityOccurrenceKey): LayerRuleEntityOccurrenceKey {
  return {
    layerCode: key.layerCode.trim(),
    ruleEntityTypeCode: key.ruleEntityTypeCode.trim(),
    code: key.code.trim(),
    startDate: key.startDate,
  };
}
