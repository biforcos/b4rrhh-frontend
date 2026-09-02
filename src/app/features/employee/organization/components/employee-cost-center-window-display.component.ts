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
  styles: [
    `
      .window-display {
        padding: 1.25rem;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-base, 8px);
        background: var(--color-surface-raised, #f9fafb);
        box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
      }
      .window-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1rem;
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
        border-bottom: 1px solid var(--color-divider, #e5e7eb);
        padding-bottom: 0.5rem;
      }
      .window-items {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .window-item {
        display: flex;
        gap: 1rem;
        align-items: center;
        font-size: 0.875rem;
        color: var(--color-text-primary);
      }
      .item-code {
        font-weight: 700;
        font-family: var(--font-mono, monospace);
        color: var(--color-primary-600, #2563eb);
        min-width: 5rem;
      }
      .item-name {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .item-perc {
        font-weight: 600;
        text-align: right;
        min-width: 3.5rem;
        color: var(--color-success-700, #15803d);
      }
    `,
  ],
})
export class EmployeeCostCenterWindowDisplayComponent {
  readonly window = input.required<EmployeeCostCenterWindowModel>();
  readonly texts = employeeTexts;
}
