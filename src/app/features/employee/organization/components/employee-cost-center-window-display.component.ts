import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { employeeTexts } from '../../employee.texts';
import { EmployeeCostCenterWindowModel } from '../../models/employee-cost-center.model';

@Component({
  selector: 'app-employee-cost-center-window-display',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="window-display">
      <div class="window-header">
        <span class="window-period">
          <strong>{{ texts.costCenterSectionStartDateLabel }}:</strong> {{ window().startDate }}
          @if (window().endDate) {
            - {{ window().endDate }}
          } @else {
            - {{ texts.costCenterSectionCurrentPeriodLabel }}
          }
        </span>
        <span class="window-total">
          <strong>{{ texts.costCenterSectionTotalLabel }}:</strong>
          {{ window().totalAllocationPercentage }}%
        </span>
      </div>

      <ul class="window-items">
        @for (item of window().items; track item.costCenterCode) {
          <li class="window-item">
            <span class="item-code">{{ item.costCenterCode }}</span>
            <span class="item-name" [title]="item.costCenterName">{{ item.costCenterName }}</span>
            <span class="item-perc">{{ item.allocationPercentage }}%</span>
          </li>
        }
      </ul>
    </div>
  `,
  styleUrl: './employee-cost-center-window-display.component.scss',
})
export class EmployeeCostCenterWindowDisplayComponent {
  readonly window = input.required<EmployeeCostCenterWindowModel>();
  readonly texts = employeeTexts;
}
