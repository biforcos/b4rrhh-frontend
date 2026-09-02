import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { RuleSystemClient } from '../client/rule-system.client';
import {
  mapFormModelToCreateRuleSystemRequest,
  mapFormModelToUpdateRuleSystemRequest,
} from '../mapper/rule-system-form.mapper';
import {
  mapRuleSystemResponseListToModel,
  mapRuleSystemResponseToModel,
} from '../mapper/rule-system.mapper';
import { RuleSystemFormModel } from '../models/rule-system-form.model';
import { RuleSystem } from '../models/rule-system.model';

@Injectable({
  providedIn: 'root',
})
export class RuleSystemGateway {
  private readonly ruleSystemClient = inject(RuleSystemClient);

  loadRuleSystems(): Observable<ReadonlyArray<RuleSystem>> {
    return this.ruleSystemClient
      .listRuleSystems()
      .pipe(map((response) => mapRuleSystemResponseListToModel(response)));
  }

  loadRuleSystem(code: string): Observable<RuleSystem> {
    return this.ruleSystemClient
      .getRuleSystemByCode(code)
      .pipe(map((response) => mapRuleSystemResponseToModel(response)));
  }

  createRuleSystem(formValue: RuleSystemFormModel): Observable<RuleSystem> {
    return this.ruleSystemClient
      .createRuleSystem(mapFormModelToCreateRuleSystemRequest(formValue))
      .pipe(map((response) => mapRuleSystemResponseToModel(response)));
  }

  updateRuleSystem(code: string, formValue: RuleSystemFormModel): Observable<RuleSystem> {
    return this.ruleSystemClient
      .updateRuleSystem(code, mapFormModelToUpdateRuleSystemRequest(formValue))
      .pipe(map((response) => mapRuleSystemResponseToModel(response)));
  }
}
