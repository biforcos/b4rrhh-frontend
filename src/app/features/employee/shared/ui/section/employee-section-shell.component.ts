import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SectionCardComponent } from '../../../../../shared/ui/section-card/section-card.component';
import {
  SectionCardActionsDirective,
  SectionCardFooterDirective,
} from '../../../../../shared/ui/section-card/section-card-slots.directive';
import { UiButtonComponent } from '../../../../../shared/ui/button/ui-button.component';
import { SectionUiState } from './section-ui-state.model';

export type EmployeeSectionShellState = 'idle' | 'loading' | 'error' | 'success';

export interface EmployeeSectionShellAction {
  label: string;
  icon?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-employee-section-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionCardComponent,
    SectionCardActionsDirective,
    SectionCardFooterDirective,
    UiButtonComponent,
  ],
  templateUrl: './employee-section-shell.component.html',
  styleUrl: './employee-section-shell.component.scss',
})
export class EmployeeSectionShellComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly actions = input<readonly EmployeeSectionShellAction[]>([]);
  readonly state = input.required<SectionUiState | EmployeeSectionShellState>();

  protected readonly hasSubtitle = computed(() => {
    const subtitle = this.subtitle()?.trim() ?? '';
    return subtitle.length > 0;
  });
  protected readonly hasActions = computed(() => this.actions().length > 0);
  protected readonly showBusy = computed(() => {
    const state = this.state();
    return typeof state === 'string' ? state === 'loading' : state.busy;
  });
  protected readonly hasFooterState = computed(() => this.showBusy());
}
