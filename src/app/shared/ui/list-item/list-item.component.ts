import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { UiTagComponent } from '../tag/ui-tag.component';

@Component({
  selector: 'app-list-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiTagComponent],
  templateUrl: './list-item.component.html',
  styleUrl: './list-item.component.scss',
})
export class ListItemComponent {
  readonly selected = input(false);
  readonly status = input<string | null>(null);
  readonly statusSeverity = input<'success' | 'warn' | 'secondary' | 'contrast'>('secondary');
}
