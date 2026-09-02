import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BASE_PATH } from '../../../core/api/generated/variables';
import { RuleSystemResponse } from '../../../core/api/generated/model/rule-system-response';
import { CreateRuleSystemRequest } from '../models/create-rule-system.request';
import { UpdateRuleSystemRequest } from '../models/update-rule-system.request';

@Injectable({
  providedIn: 'root',
})
export class RuleSystemClient {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);
  private readonly resourcePath = '/rule-systems';

  listRuleSystems(): Observable<ReadonlyArray<RuleSystemResponse>> {
    return this.http.get<ReadonlyArray<RuleSystemResponse>>(this.buildUrl(this.resourcePath));
  }

  getRuleSystemByCode(code: string): Observable<RuleSystemResponse> {
    const normalizedCode = this.normalizeCode(code);
    return this.http.get<RuleSystemResponse>(
      this.buildUrl(`${this.resourcePath}/${encodeURIComponent(normalizedCode)}`),
    );
  }

  createRuleSystem(payload: CreateRuleSystemRequest): Observable<RuleSystemResponse> {
    return this.http.post<RuleSystemResponse>(this.buildUrl(this.resourcePath), payload);
  }

  updateRuleSystem(code: string, payload: UpdateRuleSystemRequest): Observable<RuleSystemResponse> {
    const normalizedCode = this.normalizeCode(code);
    return this.http.put<RuleSystemResponse>(
      this.buildUrl(`${this.resourcePath}/${encodeURIComponent(normalizedCode)}`),
      payload,
    );
  }

  private normalizeCode(code: string): string {
    return code.trim();
  }

  private buildUrl(path: string): string {
    const normalizedBasePath = this.basePath.endsWith('/')
      ? this.basePath.slice(0, -1)
      : this.basePath;
    return `${normalizedBasePath}${path}`;
  }
}
