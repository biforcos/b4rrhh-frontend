import { ChangeDetectionStrategy, Component } from '@angular/core';

import {
  EmployeeSectionShellAction,
  EmployeeSectionShellComponent,
} from '../../shared/ui/section/employee-section-shell.component';
import { EmployeePageHeaderComponent } from '../components/employee-page-header.component';
import { EmployeeTimelinePanelComponent } from '../components/employee-timeline-panel.component';

@Component({
  selector: 'app-employee-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmployeePageHeaderComponent,
    EmployeeSectionShellComponent,
    EmployeeTimelinePanelComponent,
  ],
  templateUrl: './employee-page.component.html',
  styleUrl: './employee-page.component.scss',
})
export class EmployeePageComponent {
  protected readonly sectionState = 'idle' as const;
  protected readonly fullName = 'Ana Garcia Ruiz';
  protected readonly employeeNumber = 'EMP-24018';
  protected readonly ruleSystemCode = 'LABOR_ES';
  protected readonly employeeTypeCode = 'STAFF';
  protected readonly status = 'ACTIVE' as const;
  protected readonly companyCode = 'B4 ES';
  protected readonly workCenterCode = 'MADRID HQ';
  protected readonly hireDate = '2023-02-01';
  protected readonly email = 'ana.garcia@b4rrhh.local';
  protected readonly phone = '+34 600 111 222';

  protected readonly contactActions: ReadonlyArray<EmployeeSectionShellAction> = [
    { label: 'Add contact', icon: '[+]' },
    { label: 'Manage', icon: '[...]' },
  ];

  protected readonly identifierActions: ReadonlyArray<EmployeeSectionShellAction> = [
    { label: 'Add identifier', icon: '[+]' },
    { label: 'Edit', icon: '[edit]' },
  ];

  protected readonly addressActions: ReadonlyArray<EmployeeSectionShellAction> = [
    { label: 'Add address', icon: '[+]' },
    { label: 'Close', icon: '[x]' },
  ];
}
