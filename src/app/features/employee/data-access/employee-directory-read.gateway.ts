import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeReadClient } from '../../../core/api/clients/employee-read.client';
import {
  mapEmployeeDirectoryApiToDirectoryModel,
  EmployeeDirectoryReadModel,
} from '../../../core/api/mappers/employee-directory.mapper';
import {
  EmployeeDirectoryPageModel,
  EmployeeDirectoryQuery,
  EmployeeListItemModel,
} from '../models/employee-list-item.model';

@Injectable({
  providedIn: 'root',
})
export class EmployeeDirectoryReadGateway {
  private readonly employeeReadClient = inject(EmployeeReadClient);

  readDirectory(query: EmployeeDirectoryQuery): Observable<EmployeeDirectoryPageModel> {
    return this.employeeReadClient
      .readDirectory({
        q: query.q,
        status: query.status,
        page: query.page,
        size: query.size,
      })
      .pipe(
        map((page) => ({
          items: page.items.map((employee) =>
            this.toEmployeeListItemModel(mapEmployeeDirectoryApiToDirectoryModel(employee)),
          ),
          page: page.page,
          size: page.size,
          total: page.total,
        })),
      );
  }

  private toEmployeeListItemModel(source: EmployeeDirectoryReadModel): EmployeeListItemModel {
    return {
      ruleSystemCode: source.ruleSystemCode,
      employeeTypeCode: source.employeeTypeCode,
      employeeNumber: source.employeeNumber,
      displayName: source.displayName,
      workCenter: source.workCenter,
      statusLabel: source.statusLabel,
    };
  }
}
