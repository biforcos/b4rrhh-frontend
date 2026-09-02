import { ChangeDetectionStrategy, Component, computed, contentChild, input } from '@angular/core';

import {
  SectionCardActionsDirective,
  SectionCardFooterDirective,
} from './section-card-slots.directive';

@Component({
  selector: 'app-section-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './section-card.component.html',
  styleUrl: './section-card.component.scss',
})
export class SectionCardComponent {
  readonly title = input<string | null>(null);
  readonly description = input<string | null>(null);
  private readonly actionsSlot = contentChild(SectionCardActionsDirective);
  private readonly footerSlot = contentChild(SectionCardFooterDirective);

  protected readonly hasHeader = computed(() => {
    const title = this.title()?.trim() ?? '';
    const description = this.description()?.trim() ?? '';
    return title.length > 0 || description.length > 0 || !!this.actionsSlot();
  });
  protected readonly hasFooter = computed(() => !!this.footerSlot());
}
