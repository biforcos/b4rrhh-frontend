import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { LayerClient, LayerRuleEntityOccurrenceKey } from '../client/layer.client';
import { RuleEntityClient } from '../client/rule-entity.client';
import { RuleEntityTypeClient } from '../client/rule-entity-type.client';
import { RuleSystemClient } from '../client/rule-system.client';
import { mapLayerResponseToModel } from '../mapper/layer.mapper';
import {
  mapLayerRuleEntityResponseToModel,
  mapRuleEntityResponseToModel,
} from '../mapper/rule-entity.mapper';
import { CreateLayerRuleEntityRequestModel } from '../models/create-layer-rule-entity.request';
import { LayerModel } from '../models/layer.model';
import { mapRuleEntityTypeResponseToModel } from '../mapper/rule-entity-type.mapper';
import { CloseRuleEntityRequestModel } from '../models/close-rule-entity.request';
import { CreateRuleEntityRequestModel } from '../models/create-rule-entity.request';
import { CorrectRuleEntityRequestModel } from '../models/correct-rule-entity.request';
import { mapRuleSystemResponseToModel } from '../mapper/rule-system.mapper';
import { RuleEntityModel } from '../models/rule-entity.model';
import { RuleEntityTypeModel } from '../models/rule-entity-type.model';
import { RuleSystemModel } from '../models/rule-system.model';
import { RuleEntityOccurrenceBusinessKey } from '../client/rule-entity.client';

@Injectable({
  providedIn: 'root',
})
export class CatalogGateway {
  private readonly ruleSystemClient = inject(RuleSystemClient);
  private readonly ruleEntityTypeClient = inject(RuleEntityTypeClient);
  private readonly ruleEntityClient = inject(RuleEntityClient);
  private readonly layerClient = inject(LayerClient);

  loadRuleSystems(): Observable<ReadonlyArray<RuleSystemModel>> {
    return this.ruleSystemClient
      .listRuleSystems()
      .pipe(map((items) => items.map((item) => mapRuleSystemResponseToModel(item))));
  }

  loadRuleEntityTypes(): Observable<ReadonlyArray<RuleEntityTypeModel>> {
    return this.ruleEntityTypeClient
      .listRuleEntityTypes()
      .pipe(map((items) => items.map((item) => mapRuleEntityTypeResponseToModel(item))));
  }

  loadRuleEntities(
    ruleSystemCode: string,
    ruleEntityTypeCode: string,
  ): Observable<ReadonlyArray<RuleEntityModel>> {
    return this.ruleEntityClient
      .listRuleEntities({ ruleSystemCode, ruleEntityTypeCode })
      .pipe(map((items) => items.map((item) => mapRuleEntityResponseToModel(item))));
  }

  createRuleEntity(request: CreateRuleEntityRequestModel): Observable<RuleEntityModel> {
    return this.ruleEntityClient
      .createRuleEntity(request)
      .pipe(map((created) => mapRuleEntityResponseToModel(created)));
  }

  correctRuleEntityByBusinessKey(
    businessKey: RuleEntityOccurrenceBusinessKey,
    request: CorrectRuleEntityRequestModel,
  ): Observable<RuleEntityModel> {
    return this.ruleEntityClient
      .correctRuleEntityByBusinessKey(businessKey, request)
      .pipe(map((updated) => mapRuleEntityResponseToModel(updated)));
  }

  closeRuleEntityByBusinessKey(
    businessKey: RuleEntityOccurrenceBusinessKey,
    request: CloseRuleEntityRequestModel,
  ): Observable<RuleEntityModel> {
    return this.ruleEntityClient
      .closeRuleEntityByBusinessKey(businessKey, request)
      .pipe(map((updated) => mapRuleEntityResponseToModel(updated)));
  }

  deleteRuleEntityByBusinessKey(businessKey: RuleEntityOccurrenceBusinessKey): Observable<void> {
    return this.ruleEntityClient.deleteRuleEntityByBusinessKey(businessKey);
  }

  // Por capa (frontend#131): donde se mantiene una entidad de COM o de INT.

  loadLayers(): Observable<ReadonlyArray<LayerModel>> {
    return this.layerClient
      .listLayers()
      .pipe(map((items) => items.map((item) => mapLayerResponseToModel(item))));
  }

  loadLayerRuleEntities(
    layerCode: string,
    ruleEntityTypeCode: string,
  ): Observable<ReadonlyArray<RuleEntityModel>> {
    return this.layerClient
      .listLayerRuleEntities(layerCode, ruleEntityTypeCode)
      .pipe(map((items) => items.map((item) => mapLayerRuleEntityResponseToModel(item))));
  }

  createLayerRuleEntity(
    layerCode: string,
    request: CreateLayerRuleEntityRequestModel,
  ): Observable<RuleEntityModel> {
    return this.layerClient
      .createLayerRuleEntity(layerCode, request)
      .pipe(map((created) => mapLayerRuleEntityResponseToModel(created)));
  }

  correctLayerRuleEntity(
    key: LayerRuleEntityOccurrenceKey,
    request: CorrectRuleEntityRequestModel,
  ): Observable<RuleEntityModel> {
    return this.layerClient
      .correctLayerRuleEntity(key, request)
      .pipe(map((updated) => mapLayerRuleEntityResponseToModel(updated)));
  }

  closeLayerRuleEntity(
    key: LayerRuleEntityOccurrenceKey,
    request: CloseRuleEntityRequestModel,
  ): Observable<RuleEntityModel> {
    return this.layerClient
      .closeLayerRuleEntity(key, request)
      .pipe(map((updated) => mapLayerRuleEntityResponseToModel(updated)));
  }

  deleteLayerRuleEntity(key: LayerRuleEntityOccurrenceKey): Observable<void> {
    return this.layerClient.deleteLayerRuleEntity(key);
  }
}
